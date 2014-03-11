/*
 * HTTP handlers for non-nested directories
 */

exports.partner_up = function(pg) {
return function(req, res) {
	res.render('get_partners', {link: '/game'});
};
};

exports.game = function(pg) {
return function(req, res) {
	res.render('guessing_game', {
		continue_message: 'Press okay to play again.',
		link: '/game_survey'
	});
};
};

exports.trial_partner_up = function(pg) {
return function(req, res) {
	res.render('get_partners', {link: '/trial_game'});
};
};

exports.trial_game = function(pg) {
return function(req, res) {
	res.render('guessing_game', {
		continue_message: 'Please press okay to take a quick survey.',
		link: '/game_survey'
	});
};
};



