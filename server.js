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

// Number of ms to wait before a "seed game" will accept its final guess
var seed_timeout = 7000;
// Min guesses to automatically progress through a "seed round"
var min_seed_guesses = 5;
// Number of ms to wait before a skip is approved
var skip_delay = 1500;
// Number of times a tag must occur to be considered "taboo"
var taboo_count = 5;
// Max number of skips an image can have and be used in the game
var max_skips = 3;
// Max number of flags an image can have and be used in the game
var max_flags = 3;

io.sockets.on('connection', function (socket) {
	socket.uuid = uuid.v4();
	socket.playing = true;
	socket.guesses = [];

	start_game(socket);

	socket.on('guess', guess_handler(socket));

	socket.on('flag image', flag_handler(socket));

	socket.on('request skip', skip_handler(socket));

	socket.on('last image', function() {
		socket.playing = false;
	});

	socket.on('game_over', function() {
		socket.playing = false;
	});

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
	socket.guesses.push(data.guess);
	
	var partner_guesses = socket.partner_guesses;
	if(partner_guesses &&
		partner_guesses.indexOf(data.guess) == -1) {
		// This guess was not in the partner's guesses
		return;
	} else if (!partner_guesses && 
		!socket.wait_over &&
		socket.guesses.length < min_seed_guesses) {
		// Make the player guess at least 5 times or wait 
		// for wait_over to be set to true
		return;
	}
	
	if(socket.partner_guesses) {
		save_match(socket.image.img_id, data.guess);
		log_data('match', 
			socket.uuid,
			{
				guesses: socket.guesses,
				partner: partner_guesses,
				taboo: socket.image.taboo,
				match: data.guess,
				image_id: socket.image.img_id,
				image_url: socket.image.url
			}
		);
	} else {
		log_data('seed guesses generated', 
			socket.uuid,
			{
				guesses: socket.guesses,
				taboo: socket.image.taboo,
				image_id: socket.image.img_id,
				image_url: socket.image.url
			}
		);
	}
	
	expire_guesses(socket.partner_guess_id);
	save_guesses(socket.image.img_id, socket.guesses);

	socket.emit('add points');
	send_prompt(socket);
}
}

function flag_handler(socket) {
return function() {
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
	log_data('skip', 
		socket.uuid,
		{
			guesses: socket.guesses,
			partner: socket.partner_guesses,
			taboo: socket.image.taboo,
			image_id: socket.image.img_id,
			image_url: socket.image.url
		}
	);
	
	// Make the player wait to discourage skipping
	socket.skip = true;
	socket.skip_timeout = setTimeout(function() {
		if(!socket.skip) {
			return;
		}
		image_skipped(
			socket.image.img_id, 
			socket.partner_guess_id
		);
		socket.emit('image skipped');
		if(socket.guesses.length) {
			expire_guesses(socket.partner_guess_id);
			save_guesses(socket.image.img_id, socket.guesses);
		}
		send_prompt(socket);
	}, skip_delay);
}
}


////////////////////////// Socket Helper Functions /////////////////////////////


function send_prompt(socket) {
	if(socket.skip_timeout){
		clearTimeout(socket.skip_timeout);
		socket.skip_timeout = null;
	}
	if(socket.match_timeout){
		clearTimeout(socket.match_timeout);
	}
	if(!socket.playing) {
		// If player is done, do not emit a new prompt
		return;
	}
	socket.guesses = [];

	pg.connect(PG_URL, function(err, client, done) {
		if (err) {
			socket.emit('database error');
			return console.error('Error establishing connection to client', err);
		}

		var query = 'SELECT * FROM images'
			+ ' WHERE skip_count < ' + max_flags + ' AND flag_count <' + max_flags 
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

			query = 'SELECT * FROM guesses'
				+ ' where img_id = $1' 
				+ ' ORDER BY RANDOM() LIMIT 1;';

			client.query(query, [socket.image.img_id], function(err, data2) {
				if (err) {
					socket.emit('database error');
					return console.error('error running query (get guesses)', err);
				}

				if(!data2.rows.length) {
					socket.partner_guesses = null;
					socket.wait_over = false;
				} else {
					socket.partner_guesses = data2.rows[0].guesses;
					socket.partner_guess_id = data2.rows[0].guess_id;
				}

				query = 'SELECT noun, img_id FROM tags'
				+ ' WHERE img_id = $1 AND count >= ' + taboo_count;
				
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

					socket.match_timeout = setTimeout(function() {
						socket.wait_over = true;
					}, seed_timeout);
				});
			});
		});
	});
}

function save_match (image_id, match) {
	// Save the matched word
	pg.connect(PG_URL, function(err, client, done) {
		if (err) {
			return console.error('Error establishing connection to client', err);
		}

		// Insert the tag if it doesn't exist with count = 0
		var query = 'INSERT INTO tags (img_id, noun)'
				+ ' SELECT $1, $2'
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
}

function expire_guesses(guess_id) {
	if(!guess_id) {
		return;
	}
	pg.connect(PG_URL, function(err, client, done) {
		if (err) {
			return console.error('Error establishing connection to client', err);
		}

		var query = 'DELETE FROM guesses WHERE guess_id = $1;';

		client.query(query, [guess_id], function(err, data) {
			done();
			if (err) {
				return console.error('error running query (expire guesses)', err);
			}
		});
	});
}

function save_guesses (image_id, guesses) {
	pg.connect(PG_URL, function(err, client, done) {
		if (err) {
			return console.error('Error establishing connection to client', err);
		}

		var query = 'INSERT INTO guesses (img_id, guesses) VALUES ($1, $2);';
		guesses = JSON.stringify(guesses);

		client.query(query, [image_id, guesses], function(err, data) {
			done();
			if (err) {
				return console.error('error running query (save guesses)', err);
			}
		});
	});
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

function image_skipped (image_id, partner_guess_id) {
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

function log_data(event, uuid, content) {
	pg.connect(PG_URL, function(err, client, done) {
		if (err) {
			return console.error('Error establishing connection to client', err);
		}

		var query = 'INSERT INTO game_log (event, uuid, data)'
			+ ' VALUES ($1, $2, $3);';

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

		var query = 'SELECT COUNT(*) count FROM images WHERE skip_count < '
			+ max_skips+' AND flag_count < ' + max_flags + ';';

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

		var query = 'INSERT INTO images(url, attribution_url)'
		 + ' VALUES ($1, $2);'

		client.query(query, [s3_url, attr_url], function(err, data) {
			done();
			if (err) {
				return console.error('error running query (save images)', err);
			}
		});
	});
}
