/*
 * HTTP handlers for non-nested directories
 */

exports.partner_up = function(pg) {
return function(req, res) {
	req.session.test = 'test';
	res.render('get_partners', {});
};
};

exports.game = function(pg) {
return function(req, res) {
	req.session.test = 'test';
	res.render('guessing_game', {});
};
};



