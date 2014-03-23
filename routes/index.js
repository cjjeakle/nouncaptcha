/*
 * HTTP handlers for non-nested directories
 */

var PG_URL = process.env.HEROKU_POSTGRESQL_WHITE_URL || process.env.HEROKU_POSTGRESQL_CYAN_URL;

exports.game = function(pg) {
return function(req, res) {
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

exports.submit_game_survey = function(pg) {
return function(req, res) {
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

		var query = 'INSERT INTO game_survey (time, uuid, language, english, country, state, age, sex, education,' 
			+ ' input, enjoyed, followed_rules, nouns_only, image_quality, how_found, suggestions, comments)'
			+ ' VALUES (now(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16);'

		client.query(query, input, function(err, data) {
			if (err) {
				return console.error('error running query (save form)', err);
				res.send(500, 'Database error.');
			}
			done();
			res.redirect('/game_debrief');
		});
	});	
}
}

exports.game_debrief = function(req, res) {
	res.render('game_survey_debrief');
}





