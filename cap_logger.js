/*
 * The logging function used in Noun CAPTCHA game modules
 */ 

var pg = require('pg').native;
var PG_URL = require('./globals').database_url;

exports.cap_log = function(event, uuid, content) {
	// Logging disabled now that testing is over 
	// (to stay under free DB size limit)
	return;
	
	pg.connect(PG_URL, function(err, client, done) {
		if (err) {
			return console.error('Error establishing connection to client', err);
		}

		var query = 'INSERT INTO cap_log (event, uuid, data)'
			+ ' VALUES ($1, $2, $3);';

		client.query(query, [event, uuid, content], function(err, data) {
			done();
			if (err) {
				return console.error('error running query (log data)', err);
			}
		});
	});
}
