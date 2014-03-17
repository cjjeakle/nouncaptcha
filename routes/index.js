/*
 * HTTP handlers for non-nested directories
 */

exports.game = function(req, res) {
	res.render('guessing_game', {
		continue_message: 'Press okay to play again.',
		link: '/game'
	});
};

exports.game_info = function(req, res) {
	if(!req.query.key) {
		res.send(401, 'No user key provided.');
		return;
	}

	// TODO: Search pg to ensure key is valid and unused

	req.session.game_survey_key = req.query.key;

	res.render('game_info', {});
};

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
	// TODO: search pg for key and get the corresponding token 
	// TODO: store the token in user's cookie
	req.session.game_survey_token = null;
	res.redirect('/game_debrief')
}
}

exports.game_debrief = function(req, res) {
	if(!req.session.game_survey_token) {
		res.send(401, 'Error: no user key found. Don\'t forget to enable cookies.');
		return;
	}

	// TODO: Write page

	res.render('game_debrief', {
		token: req.session.game_survey_token
	});
}





