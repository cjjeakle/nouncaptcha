// Web Server

//////////////////////////////////// Setup /////////////////////////////////////


var express = require('express');
var http = require('http');
var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);

var cookie = require('cookie')
var connect = require('connect');

var logfmt = require('logfmt');
var routes = require('./routes');
var path = require('path');
var pg = require('pg').native;

var Flickr = require("flickrapi");
var flickrOptions = {
	api_key: process.env.FLICKRKEY,
	secret: process.env.FLICKRSECRET
};

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logfmt.requestLogger());
app.use(express.favicon());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.session({secret: process.env.SECRET || 'secret', key: 'express.sid'}));
app.use(app.router);
app.use(express.static(__dirname + '/static'));

// Only serve static content from the /public/... directory
app.use(express.static(path.join(__dirname, 'public')));

// Listen on the environment's desired port or at 5000
var port = process.env.PORT || 3000;
server.listen(port, function() {
	console.log('Listening on ' + port);
});

// Development error handling
if ('development' == app.get('env')) {
	app.use(express.errorHandler());
}

// Make the generated HTML more readable in development
app.configure('development', function(){
  app.use(express.errorHandler());
  app.locals.pretty = true;
});


///////////////////////////////// HTTP Handlers ////////////////////////////////


// Get requests
app.get('/', function(req, res) {res.redirect('/trial_partner_up');})
app.get('/trail_consent', function(req, res){res.redirect('/')});
app.get('/trial_partner_up', routes.trial_partner_up);
app.get('/trial_game', routes.trial_game);
app.get('/game_survey', function(req, res){res.redirect('/')});

// Post requests
app.post('/submit_game_survey', function(){});

//////////////////////////////// Socket Handlers ///////////////////////////////

// list of UIDs waiting to be paired
var waiters = [];

// map user UID -> user socket
var player_sockets = {};

// map user UID -> partner UID, game UID, and array of guesses
var user_data = {};

// map of a user UID to an array of images and taboo words. 
// (also contains a list of guesses and timings in single player)
var game_data = {};

// time between buckets
var bucket_time = 30;

// Timer to pair players in 30 second buckets
setInterval(function() {
	if(bucket_time == 0) {
		var waiters_temp = waiters;
		waiters = [];
		partner_up(waiters_temp);
		bucket_time = 31;
	}
	bucket_time -= 1;
}, 1000);


io.set('authorization', function (handshakeData, accept) {
	// Parse passed cookie to get user's express sid
	if (handshakeData.headers.cookie) {
		handshakeData.cookie = cookie.parse(handshakeData.headers.cookie);
		handshakeData.sessionID = connect.utils.parseSignedCookie(
			handshakeData.cookie['express.sid'], process.env.SECRET || 'secret'
		);
		
		if (handshakeData.cookie['express.sid'] == handshakeData.sessionID) {
			return accept('Cookie is invalid.', false);
		}
	} else {
		return accept('No cookie transmitted.', false);
	}
	
	accept(null, true);
});


io.sockets.on('connection', function (_socket) {
	var context = {
		socket: _socket,
		sid: _socket.handshake.sessionID,
		waiting: false,
		in_game: false
	};
	
	_socket.on('waiting', partner_handler(context));

	_socket.on('start game', start_game(context));
	
	_socket.on('guess', guess_handler(context));

	_socket.on('request skip', skip_handler(context));


	///// Close Connections /////
	_socket.on('disconnect', function() {
		if(context.in_game) {
			var game = game_data[user_data[context.sid].gameID];
			if(game && user_data[context.sid].partner) {
				var partner_socket = player_sockets[user_data[context.sid].partner];
				partner_socket.emit('partner disconnect', {});
				delete game_data[user_data[context.sid].gameID];
			}
			delete user_data[context.sid];
		} else if (context.waiting) {
			var index = waiters.indexOf(context.sid);
			waiters.splice(index, 1);
		} else {
			// no cleanup needed
			return;
		}
		delete player_sockets[context.sid];
	});
});


////////////////////////// Socket Handler Functions ////////////////////////////

///// Partnering Handler /////
function partner_handler(context) {
return function() {
	// If already in game, do not allow user to attempt another pairing
	if(user_data[context.sid] || waiters.indexOf(context.sid) != -1) {
		context.socket.emit('already connected', {});
		return;
	}

	context.waiting = true;
	waiters.push(context.sid);

	// Save user socket for wake-up when partnered
	player_sockets[context.sid] = context.socket;

	// Let the waiting user know their approx. wait time (~2 sec added for pairing)
	context.socket.emit('wait time', {time: bucket_time + 2});
}
}

function start_game(context) {
return function() {
	if(!user_data[context.sid]) {
		context.socket.emit('not partnered', {});
		return;
	}
	context.in_game = true;
	player_sockets[context.sid] = context.socket;

	context.socket.emit('game time', {time: 150});

	var game = game_data[user_data[context.sid].gameID];
	context.socket.emit('new image', {
		image: game.images[game.cur_image],
		taboo: game.taboo[game.cur_image]
	});
}
}

function guess_handler(context) {
return function(data) {
	var user = user_data[context.sid];
	var game = game_data[user.gameID];
	var partner_guesses = user.partner ? user_data[user.partner].guesses : user.ai_guesses[game.cur_image];

	user.guesses.push(data.guess);

	if(partner_guesses.indexOf(data.guess) == -1) {
		// This guess was not in the partner's guesses
		return;
	}
	
	if(user.partner) {
		save_match(
			user.guesses, 
			partner_guesses, 
			game.taboo[game.cur_image], 
			data.guess, 
			game.image_ids[game.cur_image]
		);
	} else {
		save_match(
			user.guesses, 
			null, 
			game.taboo[game.cur_image], 
			data.guess, 
			game.image_ids[game.cur_image]
		);
	}
	
	var partner_socket = user.partner ? player_sockets[user.partner] : null;
	broadcast_message(context.sid, 'add points');
	
	game.cur_image++;
	if(game.cur_image < game.images.length) {
		send_cur_image(context.sid, game);
	} else {
		end_game(context.sid);
	}
}
}

function skip_handler(context) {
return function() {
	var user = user_data[context.sid];
	var game = game_data[user.gameID];
	user.pass_requested = true;

	if(!user.partner || user_data[user.partner].pass_requested) {

		image_skipped(user.guesses, game.image_ids[game.cur_image]);

		game.cur_image++;
		if(game.cur_image < game.images.length) {
			send_cur_image(context.sid, game);
			broadcast_message(context.sid, 'image skipped');
		} else {
			broadcast_message(context.sid, 'image skipped');
			end_game(context.sid);
		}
	} else {
		player_sockets[user.partner].emit('skip requested', {});
	}
}
}

////////////////////////// Socket Helper Functions /////////////////////////////

function broadcast_message (player_id, msg) {
	var player = player_sockets[player_id];
	partner_id = user_data[player_id].partner;
	var partner = partner_id ? player_sockets[partner_id] : null;
	player.emit(msg, {});
	if(partner) {
		partner.emit(msg, {});
	}
}

function send_cur_image (player_id, game) {
	var player_socket = player_sockets[player_id];
	var player_data = user_data[player_id];
	var partner_id = player_data.partner;
	var partner_scoket = partner_id ? player_sockets[partner_id] : null;
	var partner_data = partner_id ? user_data[partner_id] : null;

	// reset skip flags and guess arrays
	player_data.pass_requested = false;
	player_data.guesses = [];
	if(partner_data) {
		partner_data.pass_requested = false;
		partner_data.guesses = [];
	}

	// broadcast next image and its taboo list
	player_socket.emit('new image', {
		image: game.images[game.cur_image],
		taboo: game.taboo[game.cur_image]
	});
	if(partner_scoket) {
		partner_scoket.emit('new image', {
			image: game.images[game.cur_image],
			taboo: game.taboo[game.cur_image]
		});
	}
}

function end_game (player_id) {
	var player = player_sockets[player_id];
	partner_id = user_data[player_id].partner;
	var partner = partner_id ? player_sockets[partner_id] : null;
	player.emit('game over', {});
	if(partner) {
		partner.emit('game over', {});
	}
	delete game_data[user_data[player_id].gameID];
}

// players is a list of player UIDs
function partner_up(players) {
	while(players.length) {
		var index = Math.floor(Math.random() * players.length);
		var player1 = players[index];
		players.splice(index, 1);

		user_data[player1] = {};
		user_data[player1].gameID = player1;
		user_data[player1].guesses = [];
		game_data[player1] = {cur_image: 0};

		var player2 = null;

		if(players.length) {
			index = Math.floor(Math.random() * players.length);
			player2 = players[index];

			players.splice(index, 1);

			user_data[player2] = {};
			user_data[player2].gameID = player1;
			user_data[player2].guesses = [];
			user_data[player2].partner = player1;
		} else {
			user_data[player1].ai_guesses = [];
		}

		user_data[player1].partner = player2;

		prepare_game(player1, player2);
	}
}

function prepare_game (player1, player2) {
	game = game_data[player1];
	user = user_data[player1];
	pg.connect(process.env.HEROKU_POSTGRESQL_CYAN_URL, function(err, client, done) {
		if (err) {
			broadcast_message(player1, 'database error');
			return console.error('Error establishing connection to client', err);
		}

		var query = 'SELECT * FROM (SELECT DISTINCT i.url, i.img_id FROM images i'
			+ ' INNER JOIN images_in_use use'
			+ ' on i.img_id = use.img_id';	
		if(!player2) {
			query += ' INNER JOIN image_guesses g'
			+ ' ON i.img_id = g.img_id';
		}
		query += ') AS temp ORDER BY RANDOM() LIMIT 15;'

		user.ai_guesses = [];
		game.images = [];
		game.image_ids = [];
		game.taboo = [];

		client.query(query, function(err, data) {
			if (err) {
				broadcast_message(player1, 'database error');
				return console.error('error running query', err);
			}

			data.rows.forEach(function(row){
				game.images.push(row.url);
				game.image_ids.push(row.img_id);
			});

			var images = game.image_ids;
			if(player2) {

				query = 'SELECT t.noun, t.img_id FROM taboo_tags t'
				+ ' WHERE t.img_id = ' + images[0];
				
				for(var i = 1; i < images.length; i++) {
					query += ' UNION SELECT t.noun, t.img_id FROM taboo_tags t'
					+ ' WHERE t.img_id = ' + images[i];
				}
			} else {
				query = 'SELECT * FROM (' 
				+ ' SELECT * FROM image_guesses g'
				+ ' where g.img_id = ' + images[0] 
				+ ' ORDER BY RANDOM() LIMIT 1'
				+ ' ) AS temp';
				
				for(var i = 1; i < images.length; i++) {
					query += ' UNION ALL SELECT * FROM (' 
					+ ' SELECT * FROM image_guesses g'
					+ ' where g.img_id = ' + images[i] 
					+ ' ORDER BY RANDOM() LIMIT 1'
					+ ' ) AS temp';
				}
			}
			query += ';';

			client.query(query, function(err, data) {
				done();

				if (err) {
					broadcast_message(player1, 'database error');
					return console.error('error running query', err);
				}

				if(player2) {
					// Player has a human partner
					for(var i = 0; i < images.length; i++) {
						game.taboo.push([]);
					}
					data.rows.forEach(function(row){
						game.taboo[images.indexOf(row.img_id)].push(row.noun);
					});
				} else {
					// Single player mode
					data.rows.forEach(function(row){
						user.ai_guesses.push(row.guesses);
						game.taboo.push(row.taboo);
					});
				}

				// Put the paired players in game
				broadcast_message(player1, 'wait complete');
			});
		});
	});
}

function save_match (player_guesses, partner_guesses, taboo_list, match, image_id) {
	// Save the matched word
	pg.connect(process.env.HEROKU_POSTGRESQL_CYAN_URL, function(err, client, done) {
		if (err) {
			return console.error('Error establishing connection to client', err);
		}

		// Insert the tag if it doesn't exist with count = 0
		var query = 'INSERT INTO tags (img_id, noun, count)'
					+ ' SELECT $1, $2, 0'
					+ ' WHERE NOT EXISTS'
					+ ' (select 1 from tags WHERE img_id = $1 AND noun = $2);'
		var inputs = [image_id, match.toString()];
		
		client.query(query, inputs, function(err, data) {
			if (err) {
				return console.error('error running query', err);
			}

			// Increment count of either the inserted tag or the existing one
			query = 'UPDATE tags'
					+ ' SET count = count + 1'
					+ ' WHERE img_id = $1 AND noun = $2;';
			
			client.query(query, inputs, function(err, data) {
				done();
				if (err) {
					return console.error('error running query', err);
				}
			});
		});
	});

	save_guesses (player_guesses, partner_guesses, taboo_list, image_id);
}

function image_skipped (player_guesses, partner_guesses, taboo_list, image_id) {
	pg.connect(process.env.HEROKU_POSTGRESQL_CYAN_URL, function(err, client, done) {
		if (err) {
			return console.error('Error establishing connection to client', err);
		}

		var query = 'UPDATE images_in_use'
		+ ' SET skip_count = skip_count + 1'
		+ ' WHERE img_id = $1;';

		client.query(query, [image_id], function(err, data) {
			done();
			if (err) {
				return console.error('error running query', err);
			}
		});
	});
}

function save_guesses (player_guesses, partner_guesses, taboo_list, image_id) {
	pg.connect(process.env.HEROKU_POSTGRESQL_CYAN_URL, function(err, client, done) {
		if (err) {
			return console.error('Error establishing connection to client', err);
		}

		var query = 'INSERT INTO image_guesses (img_id, taboo, guesses) VALUES ($1, $2, $3)';
		var inputs = [image_id, JSON.stringify(taboo_list), JSON.stringify(player_guesses)];
		if(partner_guesses) {
			query += ' ,($1, $2, $4)';
			inputs.push(JSON.stringify(partner_guesses));
		}
		query += ';';

		client.query(query, inputs, function(err, data) {
			done();
			if (err) {
				return console.error('error running query', err);
			}
		});
	});
}

function get_new_images() {

	Flickr.authenticate(flickrOptions, function(error, flickr) {
		flickr.photos.getRecent({
			user_id: flickr.options.user_id,
			page: 1,
			per_page: 25
		}, function(err, result) {
			if(err) {
				console.log('error: ', err);
				return;
			}
			console.log(JSON.stringify(result));
		});
	});
	
	return;

	var images = [];

	pg.connect(process.env.HEROKU_POSTGRESQL_CYAN_URL, function(err, client, done) {
		if (err) {
			return console.error('Error establishing connection to client', err);
		}

		var query = '';
		var inputs = [];
		query += ';';

		client.query(query, inputs, function(err, data) {
			done();
			if (err) {
				return console.error('error running query', err);
			}
		});
	});
}
