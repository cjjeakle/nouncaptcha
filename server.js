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
var PG_URL = process.env.HEROKU_POSTGRESQL_CYAN_URL;

var Flickr = require("flickrapi");
var flickrOptions = {
	api_key: process.env.FLICKRKEY,
	secret: process.env.FLICKRSECRET,
	user_ud: process.env.FLICKR_USER_ID,
	access_token: process.env.FLICKR_ACCESS_TOKEN,
	access_token_secret: process.env.FLICKR_ACCESS_TOKEN_SECRET
};

var request = require('request').defaults({ encoding: null });

var AWS = require('aws-sdk');
AWS.config.region = '';

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

io.enable('browser client etag');
io.set('log level', 1);
io.set('transports', [
	'websocket'
	, 'flashsocket'
	, 'htmlfile'
	, 'xhr-polling'
	, 'jsonp-polling'
]);

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
app.get('/', function(req, res) {res.redirect('/start_game_survey');});
app.get('/game', routes.game(pg));
app.get('/game_HIT', routes.game_HIT);
app.get('/game_HIT_debrief', routes.game_HIT_debrief);
app.get('/start_game_survey', routes.game_info);
app.get('/game_test', routes.game_test);
app.get('/game_survey', routes.game_survey);
app.get('/game_survey_debrief', routes.game_debrief);

// Post requests
app.post('/submit_game_survey', routes.submit_game_survey(pg));


//////////////////////////////// Socket Handlers ///////////////////////////////


// map of a user UID to an array of images and taboo words. 
// (also contains a list of guesses and timings in single player)
var game_data = {};

io.sockets.on('connection', function (socket) {
	socket.uuid = uuid.v4();

	start_game(socket);

	socket.on('guess', guess_handler(socket));

	socket.on('flag image', flag_handler(socket));

	socket.on('request skip', skip_handler(socket));

	socket.on('disconnect', function() {
		log_data('disconnect', 
			socket.uuid,
			null
		);
	});
});


////////////////////////// Socket Handler Functions ////////////////////////////


function start_game(socket) {
	pg.connect(PG_URL, function(err, client, done) {
		if (err) {
			broadcast_message(player1, 'database error');
			return console.error('Error establishing connection to client', err);
		}

		query = 'INSERT INTO game_tokens (uuid, token) VALUES($1, $2)';
		var token_ = uuid.v4();

		client.query(query, [socket.uuid, token_], function(err, data) {
			done();
			if (err) {
				return console.error('error running query (save token)', err);
				res.send(500, 'Database error.');
			}
			socket.emit('token', {
				token: token_,
				uuid: socket.uuid
			});
			send_prompt(socket);
		});
	});
}

function guess_handler(socket) {
return function(data) {
	var game = game_data[socket.game_id];
	var partner_guesses = null;
	if(socket.partner) {
		partner_guesses = socket.partner.guesses;
	} else if (game.ai_guesses) {
		partner_guesses = game.ai_guesses[game.cur_image];
	} else {
		log_data('error, no ai guesses', 
			socket.uuid,
			null
		);
		
		broadcast_message(socket, 'add points');
	
		game.cur_image++;
		if(game.cur_image < game.images.length) {
			send_cur_image(socket, game);
		} else {
			end_game(socket);
		}
		return;
	}

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

	log_data('match', 
		socket.uuid,
		{
			guesses: socket.guesses,
			taboo: socket.image.taboo,
			match: data.guess,
			image_id: socket.image.img_id,
			image_url: socket.image.url
		}
	);

	broadcast_message(socket, 'add points');
	
	game.cur_image++;
	if(game.cur_image < game.images.length) {
		send_cur_image(socket, game);
	} else {
		end_game(socket);
	}
}
}

function flag_handler(socket) {
return function() {
	var game = game_data[socket.game_id];
	socket.flag = true;

	log_data('flag requested',
		socket.uuid,
		null
	);

	socket.emit('image flagged');

	log_data('flagged', 
		socket.uuid,
		{
			image_id: socket.image.img_id,
			image_url: socket.image.url
		}
	);

	save_flag(socket.image.img_id);
	send_prompt(socket);
}
}

function skip_handler(socket) {
return function() {
	var game = game_data[socket.game_id];
	socket.pass_requested = true;

	log_data('skip requested',
		socket.uuid,
		null
	);

	if(!socket.partner || socket.partner.pass_requested) {
		var partner_guesses = null;
		if(socket.partner) {
			partner_guesses = socket.partner.guesses;
		} else if (game.ai_guesses) {
			partner_guesses = game.ai_guesses[game.cur_image];
		}
		log_data('skip', 
			socket.uuid,
			{
				player1_guesses: socket.guesses,
				player2_guesses: partner_guesses,
				taboo: game.taboo[game.cur_image],
				image_id: game.image_ids[game.cur_image],
				image_url: game.images[game.cur_image]
			}
		);

		if(socket.partner) {
			// Only save skips if the player has a partner
			image_skipped(game.image_ids[game.cur_image]);
		}

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


function send_prompt(socket) {
	pg.connect(PG_URL, function(err, client, done) {
		if (err) {
			socket.emit('database error');
			return console.error('Error establishing connection to client', err);
		}

		var query = 'SELECT * FROM images'
			+ ' WHERE skip_count < 3 AND flag_count < 2'
			+ ' ORDER BY RANDOM() LIMIT 1;'

		client.query(query, function(err, data) {
			if (err) {
				socket.emit('database error');
				return console.error('error running query (get images)', err);
			}

			if(!data.rows.length) {
				socket.emit('database error');
				return console.error('no images available (get images)', err);;
			}

			socket.image = {};
			socket.image.img_id = data.rows[0].img_id;
			socket.image.url = data.rows[0].url;
			socket.image.attribution_url = data.rows[0].attribution_url;

			query = 'SELECT * FROM image_guesses'
				+ ' where img_id = $1 and skip_count < 3' 
				+ ' ORDER BY RANDOM() LIMIT 1;';

			client.query(query, [socket.image.img_id], function(err, data2) {
				if (err) {
					socket.emit('database error');
					return console.error('error running query (get guesses)', err);
				}

				if(!data2.rows.length) {
					socket.partner_guesses = null;
				} else {
					socket.partner_guesses = data2.rows[0].guesses;
				}

				query = 'SELECT t.noun, t.img_id FROM tags t'
				+ ' WHERE t.img_id = $1 AND t.count >= 5';
				
				client.query(query, [socket.image.img_id], function(err, data3) {
					done();
					if (err) {
						socket.emit('database error');
						return console.error('error running query (get taboo)', err);
					}

					socket.image.taboo = [];
					data3.rows.forEach(function(row){
						socket.image.taboo.push(row.noun);
					});

					// Put the paired players in game
					socket.emit('new image', {
						image: socket.image
					});

					log_data('starting',
						socket.uuid,
						null
					);
				});
			});
		});
	});
}

function save_match (player_guesses, partner_guesses, taboo_list, match, image_id) {
	// Save the matched word
	pg.connect(PG_URL, function(err, client, done) {
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

				client.query(query, [image_id], function(err, data) {
					if (err) {
						return console.error('error running query (decrement skip)', err);
					}
					query = 'UPDATE images'
						+ ' SET flag_count = 0'
						+ ' WHERE img_id = $1;';

					client.query(query, [image_id], function(err, data) {
						done();
						if (err) {
							return console.error('error running query (reset flags)', err);
						}
					});
				});
			});
		});
	});

	save_guesses (player_guesses, partner_guesses, taboo_list, image_id);
}

function save_flag(image_id) {
	pg.connect(PG_URL, function(err, client, done) {
		if (err) {
			return console.error('Error establishing connection to client', err);
		}

		var query = 'UPDATE images'
			+ ' SET flag_count = flag_count + 1'
			+ ' WHERE img_id = $1;';

		client.query(query, [image_id], function(err, data) {
			done();
			if (err) {
				return console.error('error running query (flag image)', err);
			}
		});
	});
}

function image_skipped (image_id) {
	pg.connect(PG_URL, function(err, client, done) {
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
	pg.connect(PG_URL, function(err, client, done) {
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

function log_data(event, uuid, content) {
	pg.connect(PG_URL, function(err, client, done) {
		if (err) {
			return console.error('Error establishing connection to client', err);
		}

		var query = 'INSERT INTO game_log (time, event, uuid, data)'
			+ ' VALUES (now(), $1, $2, $3);';

		client.query(query, [event, uuid, content], function(err, data) {
			done();
			if (err) {
				return console.error('error running query (log data)', err);
			}
		});
	});
}

function check_and_get_images() {
	pg.connect(PG_URL, function(err, client, done) {
		if (err) {
			return console.error('Error establishing connection to client', err);
		}

		var query = 'SELECT COUNT(*) count FROM images WHERE skip_count < 3 AND flag_count < 2;';

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

		var options = {
			sort: 'interestingness-desc',		// Interesting images first
			license: [1, 2, 3, 4, 5, 6],		// Attribution licenses
			privacy_filter: 1,					// Public images only
			safe_search: 1,						// Safe (rather than moderate/restricted)
			content_type: 7,					// Only photos and "Other"
			media: 'photos',
			page: 1,
			per_page: 50
		};

		flickr.photos.search(options, function(err, result) {
			if(err) {
				console.error('flickr error: ', err);
				return;
			}
			result.photos.photo.forEach(function(image) {
				process_image(image);
			});
		});
	});	
}

function process_image (image) {
	Flickr.authenticate(flickrOptions, function(error, flickr) {
		var url = 'http://farm' + image.farm + '.staticflickr.com/' 
		+ image.server + '/' + image.id + '_' + image.secret + '.jpg';

		options = {
			user_id: flickr.options.user_id,
			photo_id: image.id
		};

		flickr.photos.getInfo(options, function (err, result) {
			if(result.photo.usage.candownload == 1 && 
				result.photo.usage.canshare == 1 &&
				result.photo.license > 0 &&
				result.photo.license < 7) {
				var attr_url = 'something failed';
				if(result.photo.urls && result.photo.urls.url.length > 0) {
					attr_url = result.photo.urls.url[0]._content;
				}
				store_image(url, attr_url);
			}
		});
	});	
};

function store_image(url, attr_url) {
	request.get(url, function (err, res, body) {
		if(err) {
			console.error('error grabbing image');
			return;
		}

		image = new Buffer(body);
		var s3bucket = new AWS.S3();

		var s3_id = 'images/' + uuid.v4();
		s3_id += '.jpg';

		s3bucket.createBucket(function() {
			data = {
				Bucket: process.env.S3_BUCKET_NAME,
				Key: s3_id,
				ContentType: 'image/jpeg',
				ContentLength: image.length,
				Body: image
			};

			s3bucket.putObject(data, function(err, data) {
				if (err) {
					console.error('Error uploading data', err);
					return;
				}
				console.log('Successful image upload');
				var s3_url = 'https://' + process.env.S3_BUCKET_NAME + '.s3.amazonaws.com/'+ s3_id;
				index_image(s3_url, attr_url);
			});
		});
	});	
};

function index_image(s3_url, attr_url) {
	pg.connect(PG_URL, function(err, client, done) {
		if (err) {
			return console.error('Error establishing connection to client', err);
		}

		var query = 'INSERT INTO images(url, attribution_url, skip_count, flag_count)'
		 + ' VALUES ($1, $2, 0, 0);'

		client.query(query, [s3_url, attr_url], function(err, data) {
			done();
			if (err) {
				return console.error('error running query (save images)', err);
			}
		});
	});
}
