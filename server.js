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
app.get('/', function(req, res) {res.redirect('/game');});
app.get('/game', routes.game(pg));
app.get('/start_game_survey', routes.game_info(uuid));
app.get('/game_test', routes.game_test);
app.get('/game_survey', routes.game_survey);
app.get('/game_debrief', routes.game_debrief);

// Post requests
app.post('/submit_game_survey', routes.submit_game_survey(pg));


//////////////////////////////// Socket Handlers ///////////////////////////////


// list of sockets waiting to be paired
var waiter = null;

// A map of ip addresses currently in game
var connected_ips = {};

// map of a user UID to an array of images and taboo words. 
// (also contains a list of guesses and timings in single player)
var game_data = {};

io.sockets.on('connection', function (socket) {
	socket.uuid = uuid.v4();
	socket.ip_address = socket.manager.handshaken[socket.id].remoteAddress;

	check_and_get_images();
	
	socket.on('waiting', partner_handler(socket));

	socket.on('start single player', start_single_player(socket));

	socket.on('player ready', ready_handler(socket));
	
	socket.on('guess', guess_handler(socket));

	socket.on('request skip', skip_handler(socket));

	///// Close Connections /////
	socket.on('disconnect', function() {
		// erase from connected ips if this is their game connection
		if(socket.first_connection) {
			delete connected_ips[socket.ip_address];
		}

		// delete waiter if this user is waiting
		if(waiter && waiter.uuid == socket.uuid) {
			waiter = null;
		}

		if(socket.partner) {
			socket.partner.emit('partner disconnect', {});
			socket.disconnect = true;
		}

		// If user is in a game, and not partnered or partner has disconnected, 
		// delete the game
		if(socket.game_id && (!socket.partner || !socket.partner.manager.connected)) {
			console.log('deleting game');
			delete game_data[socket.game_id];
		}
	});
});


////////////////////////// Socket Handler Functions ////////////////////////////

///// Partnering Handler /////
function partner_handler(socket) {
return function() {
	if(connected_ips[socket.ip_address]) {
		socket.emit('already connected', {});
		return;
	} else {
		connected_ips[socket.ip_address] = true;
	}

	// Let the waiting user know their max wait time
	socket.emit('wait time', {time: 300 });

	log_data('connect', {
		user_uuid: socket.uuid
	});

	if(waiter) {
		var temp = waiter;
		partner_up(socket, waiter);
		waiter = null;
	} else {
		waiter = socket;
	}
}
}

function start_single_player(socket) {
return function() {
	if(waiter && waiter.uuid == socket.uuid) {
		waiter = null;
		partner_up(socket, null);
	}
}
}

function ready_handler(socket) {
return function() {
	var game = game_data[socket.game_id];

	if(socket.partner && socket.partner.disconnect) {
		socket.emit('partner disconnect', {});
	}

	if(socket.partner && !socket.partner.ready) {
		socket.ready = true;
		return;
	}

	// Put the paired players in game
	socket.emit('start game', {time: 150});
	socket.emit('new image', {
		image: game.images[game.cur_image],
		taboo: game.taboo[game.cur_image]
	});
	if(socket.partner) {
		socket.partner.emit('start game', {time: 150});
		socket.partner.emit('new image', {
			image: game.images[game.cur_image],
			taboo: game.taboo[game.cur_image]
		});
	}
}
}

function guess_handler(socket) {
return function(data) {
	var game = game_data[socket.game_id];
	var partner_guesses = socket.partner ? 
		socket.partner.guesses : game.ai_guesses[game.cur_image];

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

	log_data('match', {
		game_id: socket.game_id,
		player1_id: socket.uuid,
		player1_guesses: socket.guesses,
		player2_id: socket.partner ? socket.partner.uuid : null,
		player2_guesses: partner_guesses,
		taboo: game.taboo[game.cur_image],
		match: data.guess,
		image_id: game.image_ids[game.cur_image],
		image_url: game.images[game.cur_image]
	});


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

	log_data('skip requested', {
		requester: socket.uuid
	});

	if(!socket.partner || socket.partner.pass_requested) {
		var partner_guesses = socket.partner ? 
			socket.partner.guesses : game.ai_guesses[game.cur_image];
		log_data('skip', {
			game_id: socket.game_id,
			player1_id: socket.uuid,
			player1_guesses: socket.guesses,
			player2_id: socket.partner ? socket.partner.uuid : null,
			player2_guesses: partner_guesses,
			taboo: game.taboo[game.cur_image],
			image_id: game.image_ids[game.cur_image],
			image_url: game.images[game.cur_image]
		});

		game.cur_image++;
		if(game.cur_image < game.images.length) {
			send_cur_image(socket, game);
			broadcast_message(socket, 'image skipped');
		} else {
			broadcast_message(socket, 'image skipped');
			end_game(socket);
		}

		if(socket.partner) {
			// Only save skips if the player has a partner
			image_skipped(game.image_ids[game.cur_image]);
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
		socket.partner.emit(msg, {});
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
	pg.connect(process.env.HEROKU_POSTGRESQL_CYAN_URL, function(err, client, done) {
		if (err) {
			broadcast_message(player1, 'database error');
			return console.error('Error establishing connection to client', err);
		}

		var query = 'SELECT * FROM (SELECT DISTINCT i.url, i.img_id FROM images i';

		if(!player2) {
			query += ' INNER JOIN image_guesses g'
			+ ' ON i.img_id = g.img_id';
		} else {
			query += ' where i.skip_count < 5';
		}
		query += ') AS temp ORDER BY RANDOM() LIMIT 15;'

		client.query(query, function(err, data) {
			if (err) {
				broadcast_message(player1, 'database error');
				return console.error('error running query (get images)', err);
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
					return console.error('error running query (get taboo/guesses)', err);
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
				player1.emit('game ready');
				if(player2) {
					player2.emit('game ready');
				}
				log_data('starting', {
					game_id: player1.game_id,
					player1: player1.uuid,
					player2: player2 ? player2.uuid : null
				});
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
				return console.error('error running query (save match)', err);
			}

			// Increment count of either the inserted tag or the existing one
			query = 'UPDATE tags'
				+ ' SET count = count + 1'
				+ ' WHERE img_id = $1 AND noun = $2;';
			
			client.query(query, inputs, function(err, data) {
				if (err) {
					return console.error('error running query (increment tags)', err);
				}

				query = 'UPDATE images'
					+ ' SET skip_count = skip_count - 1'
					+ ' WHERE img_id = $1 AND skip_count > 0;';
				inputs = [image_id];

				client.query(query, inputs, function(err, data) {
					done();
					if (err) {
						return console.error('error running query (decrement skip)', err);
					}
				});
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
				return console.error('error running query (image skip)', err);
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
				return console.error('error running query (save guesses)', err);
			}
		});
	});
}

function log_data(event, data) {
	pg.connect(process.env.HEROKU_POSTGRESQL_CYAN_URL, function(err, client, done) {
		if (err) {
			return console.error('Error establishing connection to client', err);
		}

		var query = 'INSERT INTO game_log (time, event, data) VALUES (now(), $1, $2)';

		client.query(query, [event, data], function(err, data) {
			done();
			if (err) {
				return console.error('error running query (log data)', err);
			}
		});
	});
}

function check_and_get_images() {
	// TODO: Safe-search/High popularity, attribution, flagging
	pg.connect(process.env.HEROKU_POSTGRESQL_CYAN_URL, function(err, client, done) {
		if (err) {
			return console.error('Error establishing connection to client', err);
		}

		var query = 'SELECT COUNT(*) count FROM images WHERE skip_count < 5;';

		client.query(query, function(err, data) {
			done();
			if (err) {
				return console.error('error running query (log data)', err);
			}

			if(data.rows[0].count < 20) {
				get_flickr_images();
			}
		});
	});
}

function get_flickr_images() {
	Flickr.authenticate(flickrOptions, function(error, flickr) {
		flickr.photos.getRecent({
			user_id: flickr.options.user_id,
			safe_search: 1,
			page: 1,
			per_page: 15
		}, function(err, result) {
			if(err) {
				console.log('error: ', err);
				return;
			}
			var images = [];
			result.photos.photo.forEach(function(image) {
				if(image.ispublic) {
					var url = 'http://farm' + image.farm + '.staticflickr.com/' 
					+ image.server + '/' + image.id + '_' + image.secret + '.jpg';
					images.push(url);
				}
			});
			save_images(images);
		});
	});	
}

function save_images(images) {
	pg.connect(process.env.HEROKU_POSTGRESQL_CYAN_URL, function(err, client, done) {
		if (err) {
			return console.error('Error establishing connection to client', err);
		}

		var query = 'INSERT INTO images(url, attribution_url, skip_count) VALUES'
		for(var i = 0; i < images.length; i++) {
			if(i > 0) {
				query += ',';
			}
			query += ' ($' + (i + 1) + ',' + 'null' +', 0)'
		}
		query += ';';

		client.query(query, images, function(err, data) {
			done();
			if (err) {
				return console.error('error running query (save images)', err);
			}
		});
	});
}