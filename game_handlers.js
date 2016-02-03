/*
 * The Following functions handle user interaction with 'The Guessing Game'
 */

var pg = require('pg').native;
var PG_URL = require('./globals').database_url;

// Number of ms to wait before a "seed game" will accept its final guess
var seed_timeout = 7000;
// Min guesses to automatically progress through a "seed round"
var min_seed_guesses = 5;
// Number of ms to wait before a skip is approved
var skip_delay = 1500;
// Number of times a tag must occur to be considered "taboo"
var taboo_count = 5;
// Max number of skips an image can have and be used in the game
var max_skips = 5;
// Max number of flags an image can have and be used in the game
var max_flags = 3;

// The running score total, and running game count
var total_score = 5950;
var game_count = 1;

// The lowest and highest img_id image that will be displayed in the game. 
// Use to limit the presented set size and maximize tag coverage.
// Note: postgres serial min value is 1, 0 is just a better default val I feel.
var min_img_id = 0;
var max_img_id = 50;



/////////////////////////// Socket Event Functions /////////////////////////////
////////////////////////////////////////////////////////////////////////////////



exports.start_game = function(socket) {
return function(data) {
	socket.playing = true;
	socket.game_mode = true;
	socket.guesses = [];
	socket.images_seen = [];

	send_prompt(socket);
}
}

exports.guess_handler = function(socket) {
return function(data) {
	if(error_handler(socket)) {
		return;
	}

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
	}

	socket.emit('add points');
	send_prompt(socket);
}
}

exports.flag_handler = function(socket) {
return function(data) {
	if(error_handler(socket)) {
		return;
	}
	if(socket.image.img_id != data.img_id) {
		return;
	}

	socket.emit('image flagged');

	save_flag(socket.image.img_id);
	send_prompt(socket);
}
}

exports.skip_handler = function(socket) {
return function(data) {
	if(error_handler(socket)) {
		return;
	}
	
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

exports.score_handler = function(socket) {
return function(data) {
	if(error_handler(socket)) {
		return;
	}

	total_score += data.score;
	game_count++;
}
}


////////////////////// Socket DB Interaction Functions /////////////////////////
////////////////////////////////////////////////////////////////////////////////


function error_handler(socket) {
	if(!socket.game_mode) {
		// Prevent server crashing from Dyno idleing
		socket.emit('connection error');
		return true;
	}
	return false;
}

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
			socket.emit('connection error');
			return console.error('Error establishing connection to client', err);
		}

		var query = 'SELECT * FROM images'
			+ ' WHERE skip_count < ' + max_skips + ' AND flag_count <' + max_flags
			+ ' AND img_id >= ' + min_img_id + ' AND img_id <= ' + max_img_id; 
			for(var i = 0; i < socket.images_seen.length; ++i) {
				query += ' AND img_id != ' + socket.images_seen[i];
			}
		query += ' ORDER BY RANDOM() LIMIT 1;'

		client.query(query, function(err, data) {
			if (err) {
				socket.emit('connection error');
				return console.error('error running query (get images)', err);
			}

			if(!data.rows.length) {
				socket.emit('connection error');
				return console.error('no images available (get images)', err);;
			}

			socket.image = {};
			socket.images_seen.push(data.rows[0].img_id);
			socket.image.img_id = data.rows[0].img_id;
			socket.image.url = data.rows[0].url;
			socket.image.attribution_url = data.rows[0].attribution_url;

			query = 'SELECT * FROM guesses'
				+ ' where img_id = $1' 
				+ ' ORDER BY RANDOM() LIMIT 1;';

			client.query(query, [socket.image.img_id], function(err, data2) {
				if (err) {
					socket.emit('connection error');
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
						socket.emit('connection error');
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
		
		client.query(query, [image_id, match], function(err, data) {
			if (err) {
				return console.error('error running query (save match)', err);
			}

			// Increment count of either the inserted tag or the existing one
			query = 'UPDATE tags'
				+ ' SET count = count + 1'
				+ ' WHERE img_id = $1 AND noun = $2'
				+ ' RETURNING count;';
			
			client.query(query, [image_id, match], function(err, data2) {
				if (err) {
					return console.error('error running query (increment tags)', err);
				}

				if(data2.rows.length && data2.rows[0].count == taboo_count) {
					// If there is a new taboo tag, existing guesses are invalid
					clear_guesses(image_id);
				}

				query = 'UPDATE images'
					+ ' SET skip_count = skip_count - 1'
					+ ' WHERE img_id = $1 AND skip_count > 0;';

				client.query(query, [image_id], function(err, data3) {
					if (err) {
						return console.error('error running query (decrement skip)', err);
					}
					query = 'UPDATE images'
						+ ' SET flag_count = 0'
						+ ' WHERE img_id = $1;';

					client.query(query, [image_id], function(err, data4) {
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

// Remove all of an image's guess vectors, used when a new taboo word is added
// so that guess vectors of taboo words don't frustrate users
function clear_guesses(img_id) {
	pg.connect(PG_URL, function(err, client, done) {
		if (err) {
			return console.error('Error establishing connection to client', err);
		}

		var query = 'DELETE FROM guesses WHERE img_id = $1;';

		client.query(query, [img_id], function(err, data) {
			done();
			if (err) {
				return console.error('error running query (expire guesses)', err);
			}
		});
	});
}

// Delete the specified guess vector
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

// Save a new guess vector for a given image
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


