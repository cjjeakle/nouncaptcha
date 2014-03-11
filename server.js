// Web Server

//////////////////////////////////// Setup /////////////////////////////////////


var express = require('express');
var http = require('http');
var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);

var cookie = require('cookie')
var connect = require('connect');

var logfmt = require('logfmt');
var routes = require('./routes');
var path = require('path');
var pg = require('pg').native;

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(express.favicon());
app.use(logfmt.requestLogger());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.session({secret: process.env.SECRET || 'secret', key: 'express.sid'}));
app.use(app.router);
app.use(express.static(__dirname + '/static'));

// Only serve content from the /public/... directory
app.use(express.static(path.join(__dirname, 'public')));

// Listen on the environment's desired port or at 5000
var port = process.env.PORT || 3000;
server.listen(port, function() {
	console.log('Listening on ' + port);
});

// Development error handling
if ('development' == app.get('env')) {
	app.use(express.errorHandler());
}

// Make the generated HTML more readable in development
app.configure('development', function(){
  app.use(express.errorHandler());
  app.locals.pretty = true;
});


///////////////////////////////// HTTP Handlers ////////////////////////////////


// Get requests
app.get('/', function(req, res) {res.redirect('/trial_partner_up');})
app.get('/trail_consent', function(req, res){res.redirect('/')});
app.get('/trial_partner_up', routes.trial_partner_up(pg));
app.get('/trial_game', routes.trial_game(pg));
app.get('/game_survey', function(req, res){res.redirect('/')});

// Post requests
app.post('/submit_game_survey', function(){});


//////////////////////////////// Socket Handlers ///////////////////////////////

// list of users waiting to be paired
var waiters = [];

// map user UID -> partner UID, game UID, and array of guesses
var user_data = {};

// map user UID -> user socket
var player_sockets = {};

// map of a user UID to an array of images and taboo words. 
// (also contains a list of guesses and timings in single player)
var game_data = {};

// time between buckets
var bucket_time = 30;



// Timer to pair players in 30 second buckets
setInterval(function() {
	if(bucket_time == 0) {
		var waiters_temp = waiters;
		waiters = [];
		partner_up(waiters_temp);
		bucket_time = 31;
	}
	bucket_time -= 1;
}, 1000);


io.set('authorization', function (handshakeData, accept) {
	// Parse passed cookie to get user's express sid
	if (handshakeData.headers.cookie) {
		handshakeData.cookie = cookie.parse(handshakeData.headers.cookie);
		handshakeData.sessionID = connect.utils.parseSignedCookie(
			handshakeData.cookie['express.sid'], process.env.SECRET || 'secret'
		);
		
		if (handshakeData.cookie['express.sid'] == handshakeData.sessionID) {
			return accept('Cookie is invalid.', false);
		}
	} else {
		return accept('No cookie transmitted.', false);
	}
	
	accept(null, true);
});


io.sockets.on('connection', function (_socket) {
	var context = {
		socket: _socket,
		sid: _socket.handshake.sessionID,
		waiting: false,
		in_game: false
	};
	
	_socket.on('waiting', partner_handler(context));

	_socket.on('start game', start_game(context));
	
	_socket.on('guess', guess_handler(context));

	_socket.on('request skip', skip_handler(context));


	///// Close Connections /////
	_socket.on('disconnect', function() {
		if(context.in_game) {
			if(game_data[user_data[context.sid].gameID]) {
				delete game_data[user_data[context.sid].gameID];
			}
			delete user_data[context.sid];
		} else if (context.waiting) {
			var index = waiters.indexOf(context.sid);
			waiters.splice(index, 1);
		} else {
			// no cleanup needed
			return;
		}
		delete player_sockets[context.sid];
	});
});


////////////////////////// Socket Handler Functions ////////////////////////////

///// Partnering Handler /////
function partner_handler(context) {
return function(data) {
	// If already in game, do not allow user to attempt another pairing
	if(user_data[context.sid]) {
		context.socket.emit('already partnered', {});
		return;
	}

	// Add user to waiting list if not present
	if(waiters.indexOf(context.sid) != -1) {
		return;
	}
	context.waiting = true;
	waiters.push(context.sid);

	// Save user socket for wake-up when partnered
	player_sockets[context.sid] = context.socket;

	// Let the waiting user know their approx. wait time
	context.socket.emit('wait time', {time: bucket_time});
}
}

function start_game(context) {
return function(data) {
	if(!user_data[context.sid]) {
		context.socket.emit('not partnered', {});
		return;
	}
	context.in_game = true;
	player_sockets[context.sid] = context.socket;

	context.socket.emit('game time', {time: 150});

	var game = game_data[user_data[context.sid].gameID];
	context.socket.emit('new image', {
		image: game.images[game.cur_image],
		taboo: game.taboo[game.cur_image]
	});
}
}

function guess_handler(context) {
return function(data) {
	var user = user_data[context.sid];
	var game = game_data[user.gameID];
	var partner = user.partner ? user_data[user.partner].guesses : user.ai_guesses[game.cur_image];

	user.guesses.push(data.guess);

	// confirm guess if saved
	context.socket.emit('guess received', {guess: data.guess});

	if(partner.indexOf(data.guess) == -1) {
		// This guess was not in the partner's guesses
		return;
	}
	
	// TODO: save both player guess arrays to db (if non-empty)
	// TODO: save word match to db

	var partner_socket = user.partner ? player_sockets[user.partner] : null;
	broadcast_message(context.sid, 'add points');
	
	game.cur_image++;
	if(game.cur_image < game.images.length) {
		send_cur_image(context.sid, game);
	} else {
		end_game(context.socket, partner_socket);
	}
}
}

function skip_handler(context) {
return function(data) {
	var user = user_data[context.sid];
	var game = game_data[user.gameID];
	user.pass_requested = true;

	if(!user.partner || user_data[user.partner].pass_requested) {
		user.pass_requested = false;
		if(user.partner) {
			user_data[user.partner].pass_requested = false;
		}

		game.cur_image++;
		if(game.cur_image < game.images.length) {
			send_cur_image(context.sid, game);
			broadcast_message(context.sid, 'image skipped');
		} else {
			broadcast_message(context.sid, 'image skipped');
			end_game(context.sid);
		}

		// TODO: mark image as skipped in DB
	}
}
}

////////////////////////// Socket Helper Functions /////////////////////////////

function broadcast_message (player_id, msg) {
	var player = player_sockets[player_id];
	partner_id = user_data[player_id].partner;
	var partner = partner_id ? player_sockets[partner_id] : null;
	player.emit(msg, {});
	if(partner) {
		partner.emit(msg, {});
	}
}

function send_cur_image (player_id, game) {
	var player = player_sockets[player_id];
	partner_id = user_data[player_id].partner;
	var partner = partner_id ? player_sockets[partner_id] : null;
	player.emit('new image', {
		image: game.images[game.cur_image],
		taboo: game.taboo[game.cur_image]
	});
	if(partner) {
		partner.emit('new image', {
			image: game.images[game.cur_image],
			taboo: game.taboo[game.cur_image]
		});
	}
}

function end_game (player_id) {
	var player = player_sockets[player_id];
	partner_id = user_data[player_id].partner;
	var partner = partner_id ? player_sockets[partner_id] : null;
	player.emit('game over', {});
	if(partner) {
		partner.emit('game over', {});
	}
}


function partner_up(players) {
	while(players.length) {
		var index = Math.floor(Math.random() * players.length);
		var player1 = players[index];
		players.splice(index, 1);

		user_data[player1] = {};
		user_data[player1].gameID = player1;
		user_data[player1].guesses = [];
		game_data[player1] = {cur_image: 0};

		var player2 = null;

		if(players.length) {
			index = Math.floor(Math.random() * players.length);
			player2 = players[index];

			players.splice(index, 1);

			user_data[player2] = {};
			user_data[player2].gameID = player1;
			user_data[player2].guesses = [];
			user_data[player2].partner = player1;
		} else {
			user_data[player1].ai_guesses = [];
		}

		user_data[player1].partner = player2;

		// TODO: set up game for players (query data for game_data object)
		// TODO: set up ai player's guesses array
		user_data[player1].ai_guesses = [
			['car', 'tire'],
			['filler']
		]

		game_data[player1].images = [
			'http://77wallpaper.com/wp-content/uploads/2013/11/Cool-Car-Pictures-49.jpg',
			'http://imgs.xkcd.com/comics/filler_art.png'
		];

		game_data[player1].taboo = [
			['test', 'other'],
			['another test', 'words']
		];

		// Put the paired players in game
		player_sockets[player1].emit('wait complete', {});
		if(player2) {
			player_sockets[player2].emit('wait complete', {})
		}
	}
}


