// Web Server

//////////////////////////////////// Setup /////////////////////////////////////


var express = require('express');
var http = require('http');
var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);

var uuid = require('node-uuid');

var logfmt = require('logfmt');
var routes = require('./routes');
var path = require('path');
var pg = require('pg').native;

var Flickr = require("flickrapi");
var flickrOptions = {
	api_key: process.env.FLICKRKEY,
	secret: process.env.FLICKRSECRET,
	user_ud: process.env.FLICKR_USER_ID,
	access_token: process.env.FLICKR_ACCESS_TOKEN,
	access_token_secret: process.env.FLICKR_ACCESS_TOKEN_SECRET
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
app.get('/', function(req, res) {res.redirect('/trial_game');})
app.get('/trail_consent', function(req, res){res.redirect('/')});
app.get('/trial_game', routes.trial_game);
app.get('/game_survey', function(req, res){res.redirect('/')});

// Post requests
app.post('/submit_game_survey', function(){});

//////////////////////////////// Socket Handlers ///////////////////////////////

// list of sockets waiting to be paired
var waiter = {};

// A map of ip addresses currently in game
var connected_ips = {};

// map of a user UID to an array of images and taboo words. 
// (also contains a list of guesses and timings in single player)
var game_data = {};

io.sockets.on('connection', function (socket) {
	socket.uuid = uuid.v4();
	socket.ip_address = socket.manager.handshaken[socket.id].address.address;

	console.log('\n\n\n', socket.ip_address, '\n\n\n');

	socket.on('waiting', partner_handler(socket));

	socket.on('start single player', start_single_player(socket));
	
	socket.on('guess', guess_handler(socket));

	socket.on('request skip', skip_handler(socket));


	///// Close Connections /////
	socket.on('disconnect', function() {
		// erase from connected ips if this is their game connection
		if(socket.first_connection) {
			delete connected_ips[socket.ip_address];
		} else {
			return;
		}

		// delete waiter if this user is waiting
		if(waiter.uuid == socket.uuid) {
			waiter = {};
		}

		// If user is in a game, and not partnered or partner has disconnected, 
		// delete the game
		if(socket.game_id && (!socket.partner || !socket.partner.manager.connected)) {
			delete game_data[socket.game_id];
		}
	});
});


////////////////////////// Socket Handler Functions ////////////////////////////

///// Partnering Handler /////
function partner_handler(socket) {
return function() {
	if(connected_ips[socket.ip_address] && !socket.linked) {
		socket.emit('already connected', {});
		return;
	} else {
		connected_ips[socket.ip_address] = true;
	}
	socket.first_connection = true;

	if(waiter.uuid) {
		partner_up(socket, waiter);
		waiter = {};
	} else {
		waiter = socket;
	}

	// TODO: Log that user connected and is waiting

	// Let the waiting user know their approx. wait time (~2 sec added for pairing)
	socket.emit('wait time', {time: 300 });
}
}

function start_single_player(socket) {
return function() {
	waiter = {};
	partner_up(socket, null);
}
}

function guess_handler(socket) {
return function(data) {
	var game = game_data[socket.game_id];
	var partner_guesses = socket.partner ? socket.partner.guesses : game.ai_guesses[game.cur_image];

	socket.guesses.push(data.guess);

	if(partner_guesses.indexOf(data.guess) == -1) {
		// This guess was not in the partner's guesses
		return;
	}
	
	if(socket.partner) {
		save_match(
			socket.guesses, 
			partner_guesses, 
			game.taboo[game.cur_image], 
			data.guess, 
			game.image_ids[game.cur_image]
		);
	} else {
		save_match(
			socket.guesses, 
			null, 
			game.taboo[game.cur_image], 
			data.guess, 
			game.image_ids[game.cur_image]
		);
	}

	// TODO: Log the match with time, gameID, guesses, image_id
	
	broadcast_message(socket, 'add points');
	
	game.cur_image++;
	if(game.cur_image < game.images.length) {
		send_cur_image(socket, game);
	} else {
		end_game(socket);
	}
}
}

function skip_handler(socket) {
return function() {
	var game = game_data[socket.game_id];
	socket.pass_requested = true;

	if(!socket.partner || socket.partner.pass_requested) {

		image_skipped(game.image_ids[game.cur_image]);

		// TODO: Log the skip with time, gameID, guesses, and image_id

		game.cur_image++;
		if(game.cur_image < game.images.length) {
			send_cur_image(socket, game);
			broadcast_message(socket, 'image skipped');
		} else {
			broadcast_message(socket, 'image skipped');
			end_game(socket);
		}
	} else {
		socket.partner.emit('skip requested', {});
	}
}
}

////////////////////////// Socket Helper Functions /////////////////////////////

function broadcast_message (socket, msg) {
	if(socket){
		socket.emit(msg, {});
	}
	if(socket.partner) {
		socket.emit(msg, {});
	}
}

function send_cur_image (socket, game) {
	var partner = socket.partner ? socket.partner : null;

	// reset skip flags and guess arrays
	socket.pass_requested = false;
	socket.guesses = [];
	if(partner) {
		partner.pass_requested = false;
		partner.guesses = [];
	}

	// broadcast next image and its taboo list
	socket.emit('new image', {
		image: game.images[game.cur_image],
		taboo: game.taboo[game.cur_image]
	});
	if(partner) {
		partner.emit('new image', {
			image: game.images[game.cur_image],
			taboo: game.taboo[game.cur_image]
		});
	}
}

function end_game (socket) {
	game = game_data[socket.game_id];
	game.over = true;
	socket.emit('game over', {});
	if(socket.partner) {
		socket.partner.emit('game over', {});
	}
}

// players is a list of player UIDs
function partner_up(socket1, socket2) {
	var game_id = uuid.v4();
	socket1.game_id = game_id;
	socket1.guesses = [];
	socket1.pass_requested = false;
	socket1.partner = null;
	
	game_data[game_id] = {
		cur_image: 0,
		images: [],
		image_ids: [],
		taboo: [],
		over: false,
		num_players: 1
	};
	var game = game_data[game_id];

	if(socket2) {
		socket1.partner = socket2;
		socket2.game_id = game_id;
		socket2.guesses = [];
		socket2.partner = socket1;
		socket2.pass_requested = false;
		game.num_players++;
	} else {
		game.ai_guesses = [];
	}

	prepare_game(socket1, socket2, game);
}

function prepare_game (player1, player2, game) {

	// TODO: Log that the game is starting, timestamp, the player UUIDs (null for partner if none), the game's taboo list

	pg.connect(process.env.HEROKU_POSTGRESQL_CYAN_URL, function(err, client, done) {
		if (err) {
			broadcast_message(player1, 'database error');
			return console.error('Error establishing connection to client', err);
		}

		var query = 'SELECT * FROM (SELECT DISTINCT i.url, i.img_id FROM images i';

		if(!player2) {
			query += ' INNER JOIN image_guesses g'
			+ ' ON i.img_id = g.img_id';
		}
		query += ' where i.skip_count < 5) AS temp ORDER BY RANDOM() LIMIT 15;'

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

				query = 'SELECT t.noun, t.img_id FROM tags t'
				+ ' WHERE t.img_id = ' + images[0] + ' AND t.count >= 5';
				
				for(var i = 1; i < images.length; i++) {
					query += ' UNION SELECT t.noun, t.img_id FROM tags t'
					+ ' WHERE t.img_id = ' + images[i] + ' AND t.count >= 5';
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
						game.ai_guesses.push(row.guesses);
						game.taboo.push(row.taboo);
					});
				}

				// Put the paired players in game
				player1.emit('start game', {time: 150});
				player1.emit('new image', {
					image: game.images[game.cur_image],
					taboo: game.taboo[game.cur_image]
				});
				if(player2) {
					player2.emit('start game', {time: 150});
					player2.emit('new image', {
						image: game.images[game.cur_image],
						taboo: game.taboo[game.cur_image]
					});
				}
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

function image_skipped (image_id) {
	pg.connect(process.env.HEROKU_POSTGRESQL_CYAN_URL, function(err, client, done) {
		if (err) {
			return console.error('Error establishing connection to client', err);
		}

		var query = 'UPDATE images'
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
	// TODO: Implement image adding
	Flickr.authenticate(flickrOptions, function(error, flickr) {
		flickr.photos.getRecent({
			user_id: flickr.options.user_id,
			page: 1,
			per_page: 5
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
