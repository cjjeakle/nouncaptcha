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
// TODO: Secret will be made an env var later
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
app.get('/', routes.partner_up(pg));
app.get('/game', routes.game(pg));


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

io.sockets.on('connection', function (socket) {
	var waiting = false;
	var in_game = false;
	
	///// Partnering Handler /////
	socket.on('waiting', function() {
		// If already in game, do not allow user to attempt another pairing
		if(user_data[socket.handshake.sessionID]) {
			socket.emit('already partnered', {});
			return;
		}

		// Add user to waiting list if not present
		if(waiters.indexOf(socket.handshake.sessionID) != -1) {
			return;
		}
		waiting = true;
		waiters.push(socket.handshake.sessionID);

		// Save user socket for later wake-up
		player_sockets[socket.handshake.sessionID] = socket;

		// Let the waiting user know their approx. wait time
		socket.emit('wait time', bucket_time);
	});
	


	///// Game Handlers ///// 
	socket.on('start game', function() {
		if(!user_data[socket.handshake.sessionID]) {
			socket.emit('not partnered', {});
			return;
		}
		in_game = true;
		player_sockets[socket.handshake.sessionID] = socket;

		socket.emit('game time', {time: 150});

		var game = game_data[user_data[socket.handshake.sessionID].gameID];

		socket.emit('new image', 
			{image: game.images[game.cur_image],
			taboo: game.taboo[game.cur_image]}
		);
	});
	
	socket.on('guess', function(data) {
		var user = user_data[socket.handshake.sessionID];
		var game = game_data[user.gameID];
		var partner = user.partner ? user_data[user.partner].guesses : user.ai_guesses[game.cur_image];

		user.guesses.push(data.guess);

		// confirm guess if saved
		socket.emit('guess received', {guess: data.guess});

		if(partner.indexOf(data.guess) == -1) {
			console.log(JSON.stringify(partner));
			// This guess was not in the partner's guesses
			return;
		}
		
		// TODO: save both player guess arrays with timing to db
		// TODO: save word match to db

		var partner_socket = user.partner ? null : player_sockets[user.partner];
		update_scores(socket, partner_socket, game);
		
		game.cur_image++;
		if(game.cur_image < game.images.length) {
			next_image(socket, partner_socket, game);
		} else {
			socket.emit('game over', {})
		}
	});

	//socket.on('pass')




	///// Close Connections /////
	socket.on('disconnect', function() {
		if(in_game) {
			// TODO: Notify partner of disconnect
			if(game_data[user_data[socket.handshake.sessionID].gameID]) {
				delete game_data[user_data[socket.handshake.sessionID].gameID];
			}
			delete user_data[socket.handshake.sessionID];
		} else if (waiting) {
			var index = waiters.indexOf(socket.handshake.sessionID);
			waiters.splice(index, 1);
		} else {
			// no cleanup needed
			return;
		}
		delete player_sockets[socket.handshake.sessionID];
	});
});


/////////////////////////// Socket Helper Functions ////////////////////////////


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

function next_image (player, partner, game) {
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

function update_scores (player, partner, game) {
	points = 500;
	player.emit('update score', {value: points});
	if(partner) {
		partner.emit('update score', {value: points});
	}
}


// When users agree on an image tag, save the user's submission array to db and reset