/*
 * The Following functions handle user interaction with the CAPTCHA
 */

var pg = require('pg');
var PG_URL = require('./config').database_url;

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
max_contention = 2;


/////////////////////////// Socket Event Functions /////////////////////////////
////////////////////////////////////////////////////////////////////////////////


exports.start_CAPTCHA = function(socket) {
return function(data) {
	socket.cap_count = 0;
	socket.cap_score = 0;
	socket.cap_mode = true;
	socket.cap_images = [];

	send_prompt(socket);
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
			mark_contentious(socket.cap_image.img_id, choice, socket);
		}
	});
	data.not_chosen.forEach(function(choice) {
		if(socket.cap_answers[choice]) {
			mistake_count++;
		} else {
			not_contentious(socket.cap_image.img_id, choice, socket);
		}
	});
	socket.cap_score += 1 - (mistake_count * mistake_weight);

	// Don't evaluate score in practice mode
	if(data.practice) {
		if(socket.cap_count == max_attempts) {
			socket.emit('practice done');
		} else {
			send_prompt(socket);
		}
		return;
	}

	if(socket.cap_count == max_attempts && 
		socket.cap_score / success_threshold < 1) {
		socket.emit('CAPTCHA failed')
	} else if(socket.cap_count < min_for_approval ||
		socket.cap_score / success_threshold < 1) {
		send_prompt(socket);
	} else {
		socket.emit('CAPTCHA complete');
	}
}
}


////////////////////// Socket DB Interaction Functions /////////////////////////
////////////////////////////////////////////////////////////////////////////////


function error_handler(socket) {
	if(!socket.cap_mode) {
		// Prevent server crashing from Dyno idleing
		socket.emit('connection error');
		return true;
	}
	return false;
}

function send_prompt(socket) {
	pg.connect(PG_URL, function(err, client, done) {
		if (err) {
			socket.emit('connection error');
			return console.error('Error establishing connection to database client', err);
		}

		var query = 'SELECT * FROM images i INNER JOIN tags t'
			+ ' ON i.img_id = t.img_id'
			+ ' WHERE t.count >= ' + taboo_count;
		for(var i = 0; i < socket.cap_images.length; ++i) {
			query += ' AND i.img_id != $' + (i + 1); 
		}
		query += ' ORDER BY random() LIMIT 1;';

		client.query(query, socket.cap_images, function(err, data) {
			if (err || !data.rows.length) {
				res.send(500, 'connection error.');
				return console.error('error running query (cap image)', err);
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
					res.send(500, 'connection error.');
					return console.error('error running query (cap valid tag)', err);
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
						res.send(500, 'connection error.');
						return console.error('error running query (cap invalid tag)', err);
					}

					data3.rows.forEach(function(row) {
						socket.cap_prompts.push(row.noun);
					});

					socket.cap_count++;
					var percentage = socket.cap_count / min_for_approval * 60;
					if(socket.cap_count > min_for_approval) {
						percentage = 60;
						percentage += (socket.cap_count - min_for_approval) / max_attempts * 40; 
					}

					// Remove cap_answers from below in prod, only added to make survey easier
					socket.cap_prompts = shuffle(socket.cap_prompts);
					socket.emit('CAPTCHA prompt', {
						image: socket.cap_image,
						prompts: socket.cap_prompts,
						answers: socket.cap_answers,
						completion: percentage
					});
				});
			});
		});
	});
}

function mark_contentious(img_id, noun, socket) {
	pg.connect(PG_URL, function(err, client, done) {
		if (err) {
			socket.emit('connection error');
			return console.error('Error establishing connection to database client', err);
		}

		query = 'INSERT INTO contentious_tags (img_id, noun)' 
			+' SELECT $1, $2'
			+' WHERE NOT EXISTS'
			+' (SELECT 1 FROM contentious_tags where img_id = $1 AND noun = $2);';

		client.query(query, [img_id, noun], function(err, data) {
			if (err) {
				socket.emit('connection error');
				return console.error('error running query (mark contentious)', err);
			}
			query = 'UPDATE contentious_tags'
				+ ' SET count = count + 1'
				+ ' WHERE img_id = $1 AND noun like \'%\'||$2||\'%\''
				+ ' RETURNING count;';

			client.query(query, [img_id, noun], function(err, data) {
				done();
				if (err) {
					socket.emit('connection error');
					return console.error('error running query (mark contentious)', err);
				}
			});
		});
	});
}

function not_contentious(img_id, noun, socket) {
	pg.connect(PG_URL, function(err, client, done) {
		if (err) {
			socket.emit('connection error');
			return console.error('Error establishing connection to database client', err);
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
