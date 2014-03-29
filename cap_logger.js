/*
 * The logging function used in Noun CAPTCHA game modules
 */ 

var pg = require('pg').native;
// Dev db URL and prod DB url, if DEV does not exist use prod
var PG_URL = process.env.HEROKU_POSTGRESQL_WHITE_URL || process.env.HEROKU_POSTGRESQL_CYAN_URL;

exports.cap_log = function(event, uuid, content) {
	pg.connect(PG_URL, function(err, client, done) {
		if (err) {
			return console.error('Error establishing connection to client', err);
		}

		var query = 'INSERT INTO game_log (event, uuid, data)'
			+ ' VALUES ($1, $2, $3);';

		client.query(query, [event, uuid, content], function(err, data) {
			done();
			if (err) {
				return console.error('error running query (log data)', err);
			}
		});
	});
}
