/*
 * HTTP handlers for non-nested directories
 */

exports.partner_up = function(pg) {
return function(req, res) {
	res.render('get_partners', {link: '/game'});
};
};

exports.trial_partner_up = function(pg) {
return function(req, res) {
	res.render('get_partners', {link: '/trial_game'});
};
};

exports.trial_game = function(pg) {
return function(req, res) {
	res.render('guessing_game', {trial_mode: true});
};
};



