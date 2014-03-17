/*
 * HTTP handlers for non-nested directories
 */

exports.game = function(req, res) {
	res.render('guessing_game', {
		continue_message: 'Press okay to play again.',
		link: '/game'
	});
}

exports.game_info = function(pg) {
return function(req, res) {
	if(!req.query.key) {
		res.send(401, 'No user key provided.');
		return;
	}

	pg.connect(process.env.HEROKU_POSTGRESQL_CYAN_URL, function(err, client, done) {
		if (err) {
			return console.error('Error establishing connection to client', err);
		}

		var query = 'SELECT token FROM game_tokens WHERE key = $1 AND used = FALSE'
		var input = [req.query.key];

		client.query(query, input, function(err, data) {
			done();

			if (err) {
				return console.error('error running query (save images)', err);
				res.send(500, 'Database error.');
			}

			if(data.rowCount) {
				req.session.game_survey_key = req.query.key;
				req.session.game_survey_token = req.query.token;
				res.render('game_info', {});
			} else {
				res.send(401, 'Invalid key provided.');
			}
		});
	});	
}
}

exports.game_test = function(req, res) {
	res.render('guessing_game', {
		continue_message: 'Please press okay to take a quick survey.',
		link: '/game_survey'
	});
};

exports.game_survey =  function(req, res) {
	if(!req.session.game_survey_key) {
		res.send(401, 'Error: no user key found. Don\'t forget to enable cookies.');
		return;
	}

	res.render('game_survey', {});
}

exports.submit_game_survey = function(pg) {
return function(req, res) {
	var key = [req.session.game_survey_key];
	var data = req.body;
	var input = [
		data.language,
		data.country,
		data.state,
		data.age,
		data.sex,
		data.education,
		data.input == 'Other' ? data.input : data.input_other,
		data.enjoyed,
		data.followed_rules,
		data.nouns_only,
		data.image_quality,
		data.suggestions,
		data.comments
	];

	console.log(input);

	pg.connect(process.env.HEROKU_POSTGRESQL_CYAN_URL, function(err, client, done) {
		if (err) {
			return console.error('Error establishing connection to client', err);
		}

		var query = 'INSERT INTO game_survey (time, language, country, state, age, sex,' 
			+ ' education, input, enjoyed, followed_rules, nouns_only, image_quality, suggestions, comments)'
			+ ' VALUES (now(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);'

		client.query(query, input, function(err, data) {
			if (err) {
				return console.error('error running query (save images)', err);
				res.send(500, 'Database error.');
			}

			query = 'UPDATE game_tokens'
				+ ' SET used = TRUE'
				+ ' WHERE key = $1;';

			client.query(query, key, function(err, data) {
				done();
				if (err) {
					return console.error('error running query (save images)', err);
					res.send(500, 'Database error.');
				}
				res.redirect('/game_debrief')
			});
		});
	});	
}
}

exports.game_debrief = function(req, res) {
	if(!req.session.game_survey_token) {
		res.send(401, 'Error: no user key found. Don\'t forget to enable cookies.');
		return;
	}

	res.render('game_debrief', {
		token: req.session.game_survey_token
	});
}





