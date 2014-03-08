/*
 * HTTP handlers for non-nested directories
 */

exports.partner_up = function(pg) {
return function(req, res) {
	res.render('get_partners', {});
};
};

exports.game = function(pg) {
return function(req, res) {
	res.render('guessing_game', {});
};
};



