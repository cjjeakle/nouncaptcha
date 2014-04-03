/*
 * The Following functions handle user interaction with the CAPTCHA
 */

var pg = require('pg').native;
// Dev db URL and prod DB url, if DEV does not exist use prod
var PG_URL = process.env.HEROKU_POSTGRESQL_WHITE_URL || process.env.HEROKU_POSTGRESQL_CYAN_URL;

var uuid = require('node-uuid');
var cap_log = require('./cap_logger').cap_log;

// Tag count required to be used
taboo_count = 5;
// Number of prompt nouns presented
max_options = 6;
// Running sum of passed prompts needed to complete the CAPTCHA
success_threshold = 2;
// Number of attempts required before approval is possible
min_for_approval = success_threshold;
// Max times a user can attempt CAPTCHA prompts in the same sequence
max_attempts = 5;
// Multiplier applied to mistakes in attempts, 1 point is awarded for submission
// and mistake_count * mistake_weight is subtracted from it. Mistake count has a 
// max value of max_options
mistake_weight = 1;
// Maximum number of times in a row a tag can be misattributed to an image before being
// disregarded.
max_contention = 3;


/////////////////////////// Socket Event Functions /////////////////////////////
////////////////////////////////////////////////////////////////////////////////


exports.start_CAPTCHA = function(socket) {
return function(data) {
	socket.cap_count = 0;
	socket.cap_score = 0;
	socket.cap_mode = true;
	socket.cap_images = [];

	cap_log('new CAPTCHA',
		socket.uuid,
		null
	);

	pg.connect(PG_URL, function(err, client, done) {
		if (err) {
			broadcast_message(player1, 'connection error');
			return console.error('Error establishing connection to client', err);
		}

		query = 'INSERT INTO cap_tokens (uuid, token) VALUES($1, $2)';
		var token_ = uuid.v4();

		client.query(query, [socket.uuid, token_], function(err, data) {
			done();
			if (err) {
				return console.error('error running query (cap token)', err);
				socket.emit('connection error');
			}
			socket.emit('cap token', {
				token: token_,
				uuid: socket.uuid
			});
			send_prompt(socket);
		});
	});
}
}


exports.submission_handler = function(socket) {
return function(data) {
	if(error_handler(socket)) {
		return;
	}

	var mistake_count = 0;
	data.choices.forEach(function(choice) {
		if(!socket.cap_answers[choice]) {
			mistake_count++;
			mark_contentious(socket.cap_image.img_id, choice);
		}
	});
	data.not_chosen.forEach(function(choice) {
		if(socket.cap_answers[choice]) {
			mistake_count++;
		} else {
			not_contentious(socket.cap_image.img_id, choice);
		}
	});
	socket.cap_score += 1 - (mistake_count * mistake_weight);

	cap_log('submission', 
		socket.uuid,
		{
			image: socket.cap_image,
			prompts: socket.cap_prompts,
			answers: socket.cap_answers,
			chosen: data.choices,
			not_chosen: data.not_chosen,
			attempt_count: socket.cap_count,
			score: socket.cap_score
		}
	);

	if(socket.cap_count == max_attempts && 
		socket.cap_score / success_threshold < 1) {
		cap_log('failed',
			socket.uuid,
			null
		);
		socket.emit('CAPTCHA failed')
	} else if(socket.cap_count < min_for_approval ||
		socket.cap_score / success_threshold < 1) {
		send_prompt(socket);
	} else {
		socket.emit('CAPTCHA complete');
		cap_log('success',
			socket.uuid,
			null
		);
	}
}
}


////////////////////// Socket DB Interaction Functions /////////////////////////
////////////////////////////////////////////////////////////////////////////////


function error_handler(socket) {
	if(!socket.cap_mode) {
		// Prevent server crashing from Dyno idleing
		socket.emit('connection error');
		cap_log('game issues',
			socket ? socket.uuid : null,
			{action: 'connection error'}
		);
		return true;
	}
	return false;
}

function send_prompt(socket) {
	pg.connect(PG_URL, function(err, client, done) {
		if (err) {
			broadcast_message(player1, 'connection error');
			return console.error('Error establishing connection to client', err);
		}

		// TODO: Prevent image repetition
		var query = 'SELECT * FROM images i INNER JOIN tags t'
			+ ' ON i.img_id = t.img_id'
			+ ' WHERE t.count >= ' + taboo_count;
		for(var i = 0; i < socket.cap_images.length; ++i) {
			query += ' AND i.img_id != $' + (i + 1); 
		}
		query += ' ORDER BY random() LIMIT 1;';

		client.query(query, socket.cap_images, function(err, data) {
			if (err || !data.rows.length) {
				return console.error('error running query (cap image)', err);
				res.send(500, 'connection error.');
			}

			var img_id = data.rows[0].img_id;
			socket.cap_images.push(img_id);
			socket.cap_image = {
				img_id: img_id,
				url: data.rows[0].url,
				attr: data.rows[0].attribution_url
			}

			query = 'SELECT * FROM tags t '
				+ 'WHERE t.img_id = $1 AND t.count >= ' + taboo_count
				+ 'LIMIT trunc(random() * (' + max_options + ' + 1));';

			client.query(query, [img_id], function(err, data2) {
				if (err) {
					return console.error('error running query (cap valid tag)', err);
					res.send(500, 'connection error.');
				}

				var nouns_needed = max_options - data2.rowCount;
				socket.cap_correct_count = data2.rowCount;
				socket.cap_prompts = [];
				socket.cap_answers = {};
				data2.rows.forEach(function(row) {
					socket.cap_prompts.push(row.noun);
					socket.cap_answers[row.noun] = true;
				});

				query = 'SELECT * FROM ('
					+ ' SELECT DISTINCT noun FROM tags t '
					+ ' WHERE t.count > 1 AND NOT EXISTS ('
					+ ' SELECT 1 FROM tags WHERE img_id = $1'
					+ ' AND noun like \'%\'||t.noun||\'%\''
					+ ' UNION SELECT 1 FROM contentious_tags WHERE img_id = $1'
					+ ' AND noun like \'%\'||t.noun||\'%\''
					+ ' AND count >= ' + max_contention + ')'
					+ ' ) as temp ORDER BY random() limit $2;';

				client.query(query, [img_id, nouns_needed], function(err, data3) {
					done();
					if (err) {
						return console.error('error running query (cap invalid tag)', err);
						res.send(500, 'connection error.');
					}

					data3.rows.forEach(function(row) {
						socket.cap_prompts.push(row.noun);
					});

					socket.cap_count++;
					var percentage = socket.cap_count / min_for_approval * 60;
					if(socket.cap_count > min_for_approval) {
						percentage = 50;
						percentage += socket.cap_count / max_attempts * 50; 
					}

					socket.cap_prompts = shuffle(socket.cap_prompts);
					socket.emit('CAPTCHA prompt', {
						image: socket.cap_image,
						prompts: socket.cap_prompts,
						completion: percentage
					});

					cap_log('new prompt',
						socket.uuid,
						{
							image: socket.cap_image,
							prompts: socket.cap_prompts
						}
					);
				});
			});
		});
	});
}

function mark_contentious(img_id, noun) {
	pg.connect(PG_URL, function(err, client, done) {
		if (err) {
			broadcast_message(player1, 'connection error');
			return console.error('Error establishing connection to client', err);
		}

		query = 'INSERT INTO contentious_tags (img_id, noun)' 
			+' SELECT $1, $2'
			+' WHERE NOT EXISTS'
			+' (SELECT 1 FROM contentious_tags where img_id = $1 AND noun = $2);';

		client.query(query, [img_id, noun], function(err, data) {
			if (err) {
				return console.error('error running query (mark contentious)', err);
				socket.emit('connection error');
			}
			query = 'UPDATE contentious_tags'
				+ ' SET count = count + 1'
				+ ' WHERE img_id = $1 AND noun like \'%\'||$2||\'%\''
				+ ' RETURNING count;';

			client.query(query, [img_id, noun], function(err, data) {
				done();
				if (err) {
					return console.error('error running query (mark contentious)', err);
					socket.emit('connection error');
				}
			});
		});
	});
}

function not_contentious(img_id, noun) {
	pg.connect(PG_URL, function(err, client, done) {
		if (err) {
			broadcast_message(player1, 'connection error');
			return console.error('Error establishing connection to client', err);
		}

		query = 'UPDATE contentious_tags'
				+ ' SET count = count - 1'
				+ ' WHERE img_id = $1 AND noun = $2'
				+ ' RETURNING count;';

		client.query(query, [img_id, noun], function(err, data) {
			done();
			if (err) {
				return console.error('error running query (not contentious)', err);
				socket.emit('connection error');
			}
		});
	});
}

//+ Jonas Raoni Soares Silva
//@ http://jsfromhell.com/array/shuffle [v1.0]
//link: http://dzone.com/snippets/array-shuffle-javascript
function shuffle(o){
    for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
};
