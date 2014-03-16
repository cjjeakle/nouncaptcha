/*
 * HTTP handlers for non-nested directories
 */

exports.game = function(req, res) {
	res.render('guessing_game', {
		continue_message: 'Press okay to play again.',
		link: '/game'
	});
};

exports.trial_game = function(req, res) {
	res.render('guessing_game', {
		continue_message: 'Please press okay to take a quick survey.',
		link: '/game_survey'
	});
};



