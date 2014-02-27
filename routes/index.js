/*
 * HTTP handlers for non-nested directories
 */

exports.nouncaptcha = function(pg) {
return function(req, res) {
	req.session.test = 'test';
	res.render('guessing_game', {});
};
};




