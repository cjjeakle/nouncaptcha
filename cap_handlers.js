/*
 * The Following functions handle user interaction with the CAPTCHA
 */

var pg = require('pg').native;
// Dev db URL and prod DB url, if DEV does not exist use prod
var PG_URL = process.env.HEROKU_POSTGRESQL_WHITE_URL || process.env.HEROKU_POSTGRESQL_CYAN_URL;

var uuid = require('node-uuid');
var cap_log = require('./cap_logger').cap_log;


/////////////////////////// Socket Event Functions /////////////////////////////
////////////////////////////////////////////////////////////////////////////////


exports.start_CAPTCHA = function(socket) {
return function(data) {
	socket.cap_count = 0;
	socket.success_count = 0;
	socket.cap_mode = true;

	cap_log('new CAPTCHA',
		socket.uuid,
		null
	);

	pg.connect(PG_URL, function(err, client, done) {
		if (err) {
			broadcast_message(player1, 'database error');
			return console.error('Error establishing connection to client', err);
		}

		query = 'INSERT INTO cap_tokens (uuid, token) VALUES($1, $2)';
		var token_ = uuid.v4();

		client.query(query, [socket.uuid, token_], function(err, data) {
			done();
			if (err) {
				return console.error('error running query (cap token)', err);
				res.send(500, 'Database error.');
			}
			socket.emit('token', {
				token: token_,
				uuid: socket.uuid
			});
			socket.emit('average score', {
				average: game_count ? (total_score / game_count) : 0
			});
			send_prompt(socket);
		});
	});
}
}


exports.submission_handler = function(socket) {
return function(data) {
	if(error_handler(socket)) {
		return;
	}
	//YOLO
}
}


////////////////////// Socket DB Interaction Functions /////////////////////////
////////////////////////////////////////////////////////////////////////////////


function error_handler(socket) {
	if(!socket.game_mode) {
		// Prevent server crashing from Dyno idleing
		socket.emit('connection error');
		game_log('game issues',
			socket ? socket.uuid : null,
			{action: 'flag_handler'}
		);
		return true;
	}
	return false;
}

