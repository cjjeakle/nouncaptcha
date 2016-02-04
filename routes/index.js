/*
 * HTTP handlers for non-nested directories
 */

var uuid = require('node-uuid');
var pg = require('pg');
pg.defaults.ssl = true;
var PG_URL = require('../globals').database_url;

exports.index = function(req, res) {
	res.render('index', {link: '/'});
}





// Game Stuff
///////////////////////////

exports.game = function(req, res) {
	pg.connect(PG_URL, function(err, client, done) {
		if (err) {
			return console.error('Error establishing connection to client', err);
		}

		var query = 'UPDATE game_count SET count = count + 1;';

		client.query(query, function(err, data) {
			done();
			if (err) {
				return console.error('error running query (game count)', err);
			}
		});
	});

	res.render('guessing_game', {
		continue_btn: 'Click here to play again',
		continue_message: 'Press okay to play again.',
		link: '/game'
	});
}

exports.game_HIT = function(req, res) {
	res.render('guessing_game', {
		continue_btn: 'Click here to get your token',
		continue_message: 'Press okay to continue to your token.',
		link: '/game_HIT_debrief'
	});
}

exports.game_HIT_debrief = function(req, res) {
	res.render('game_HIT_debrief');
}

exports.game_info = function(req, res) {
	res.render('game_info', {});
}

exports.game_test = function(req, res) {
	res.render('guessing_game', {
		continue_btn: 'Click here to take a quick survey.',
		continue_message: 'Please press okay to take a quick survey.',
		link: '/game_survey'
	});
};

exports.game_survey =  function(req, res) {
	res.render('game_survey', {});
}

exports.submit_game_survey = function(req, res) {
	var uuid = req.body.uuid;
	var data = req.body;
	var input = [
		data.uuid,
		data.language,
		data.english,
		data.country,
		data.state,
		data.age,
		data.sex,
		data.education,
		data.input == 'Other' ? data.input_other : data.input,
		data.enjoyed,
		data.followed_rules,
		data.nouns_only,
		data.image_quality,
		data.how_found,
		data.suggestions,
		data.comments
	];

	pg.connect(PG_URL, function(err, client, done) {
		if (err) {
			return console.error('Error establishing connection to client', err);
		}

		var query = 'INSERT INTO game_survey (uuid, language, english, country, state, age, sex, education,' 
			+ ' input, enjoyed, followed_rules, nouns_only, image_quality, how_found, suggestions, comments)'
			+ ' VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16);'

		client.query(query, input, function(err, data) {
			done();
			if (err) {
				return console.error('error running query (save form)', err);
				res.send(500, 'Database error.');
			}
			res.redirect('/game_survey_debrief');
		});
	});	
}

exports.game_debrief = function(req, res) {
	res.render('game_survey_debrief');
}




// CAPTCHA Stuff
///////////////////////////

exports.start_captcha_survey = function(req, res) {
	res.render('start_captcha_survey');
}

exports.recaptcha_test = function(req, res) {
	var token_ = uuid.v4();
	var uuid_ = uuid.v4();

	pg.connect(PG_URL, function(err, client, done) {
		if (err) {
			broadcast_message(player1, 'connection error');
			return console.error('Error establishing connection to client', err);
		}

		query = 'SELECT * FROM recap_prompts ORDER BY RANDOM() LIMIT 3';
		client.query(query, function(err, data) {
			if (err) {
				return console.error('error running query (recaptcha images)', err);
				res.send(500, 'database error');
			}

			var prompts_ = [];
			data.rows.forEach(function(row) {
				prompts_.push({
					cap_id: row.cap_id,
					url: row.url
				});
			});

			res.render('recaptcha_test', {
				uuid: uuid_,
				token: token_, 
				prompts: prompts_
			});

			query = 'INSERT INTO cap_tokens (uuid, token) VALUES($1, $2)';
			client.query(query, [uuid_, token_], function(err, data) {
				done();
				if (err) {
					return console.error('error running query (cap token)', err);
					res.send(500, 'database error');
				}
			});
		});
	});
}

exports.captcha_practice = function(req, res) {
	res.render('captcha_practice');
}

exports.captcha_test = function(req, res) {
	res.render('captcha', {link: '/captcha_survey'});
}

exports.captcha_survey = function(req, res) {
	res.render('captcha_survey');
}

exports.submit_captcha_survey = function(req, res) {
	var uuid = req.body.uuid;
	var data = req.body;

	var recap_data = JSON.parse(data.recap_data);
	var prac_data = JSON.parse(data.prac_data);
	var cap_data = JSON.parse(data.cap_data);

	var input = [
		data.uuid,
		cap_data.time,
		cap_data.success,
		data.language,
		data.english,
		data.country,
		data.state,
		data.age,
		data.sex,
		data.education,
		data.input == 'Other' ? data.input_other : data.input,
		data.understood,
		data.image_quality,
		data.prefer_check,
		data.cap_obv,
		data.recap_obv,
		data.easier,
		data.faster,
		data.preferable,
		data.how_found,
		data.comments
	];
	
	pg.connect(PG_URL, function(err, client, done) {
		if (err) {
			return console.error('Error establishing connection to client', err);
		}

		var query = 'INSERT INTO cap_survey (uuid, cap_time, cap_pass, language, english, country,'
			+ ' state, age, sex, education, input, understood, image_quality, prefer_check, cap_obv,'
			+ ' recap_obv, easier, faster, preferable, how_found, comments)'
			+ ' VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21);'

		client.query(query, input, function(err, data) {
			done();
			if (err) {
				return console.error('error running query (save cap survey)', err);
				res.send(500, 'Database error.');
			}
		});
	});	
	save_recaptcha(uuid, recap_data);
	save_practice(uuid, prac_data);

	res.redirect('/captcha_survey_debrief');
}

function save_recaptcha(uuid, recap_data) {
	pg.connect(PG_URL, function(err, client, done) {
		if (err) {
			return console.error('Error establishing connection to client', err);
		}

		var input = [];
		var query = 'INSERT INTO recap_data (uuid, cap_id, time, response) values ';
		for(var i = 0; i < recap_data.length; i++) {
			if(i > 0) {
				query += ',';
			}
			query += '($' + (i * 4 + 1) + ',$' + (i * 4 + 2) + ',$' + (i * 4 + 3) + ',$' + (i * 4 + 4) + ')';
			input.push(uuid);
			input.push(recap_data[i].cap_id);
			input.push(recap_data[i].time);
			input.push(recap_data[i].attempt);
		} 
		query += ';'

		client.query(query, input, function(err, data) {
			done();
			if (err) {
				return console.error('error running query (save recap)', err);
			}
		});
	});	
}

function save_practice(uuid, prac_data) {
	pg.connect(PG_URL, function(err, client, done) {
		if (err) {
			return console.error('Error establishing connection to client', err);
		}

		var input = [];
		var query = 'INSERT INTO prac_data (uuid, img_id, time, score) values ';
		for(var i = 0; i < prac_data.length; i++) {
			if(i > 0) {
				query += ',';
			}
			query += '($' + (i * 4 + 1) + ',$' + (i * 4 + 2) + ',$' + (i * 4 + 3) + ',$' + (i * 4 + 4) + ')';
			input.push(uuid);
			input.push(prac_data[i].image.img_id);
			input.push(prac_data[i].time);
			input.push(prac_data[i].score);
		} 
		query += ';'

		client.query(query, input, function(err, data) {
			done();
			if (err) {
				return console.error('error running query (save prac)', err);
			}
		});
	});	
}

exports.captcha_debrief = function(req, res) {
	res.render('captcha_debrief');
}

