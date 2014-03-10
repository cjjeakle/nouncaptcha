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
var request = require('request');

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(express.favicon());
app.use(logfmt.requestLogger());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(express.bodyParser());
app.use(express.cookieParser());
// TODO: Secret will be made an env var later
app.use(express.session({secret: 'secret', key: 'express.sid'}));
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
			handshakeData.cookie['express.sid'], 'secret'
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
	
	socket.on('waiting', function() {
		waiting = true;
		// If already in game, do not allow user to attempt another pairing
		if(user_data[socket.handshake.sessionID]) {
			socket.emit('already partnered', {});
			return;
		}

		// Add user to waiting list if not present
		// Save user socket for later wake-up
		if(waiters.indexOf(socket.handshake.sessionID) == -1) {
			waiters.push(socket.handshake.sessionID);
			player_sockets[socket.handshake.sessionID] = socket;
		} else {
			return;
		}

		// Wait an additional 2 seconds after bucket is emptied for
		// the pairing process to complete
		adjusted_bucket_time = bucket_time + 2;

		// Let the waiting user know their approx. wait time
		socket.emit('wait time', adjusted_bucket_time);
	});
	
	socket.on('start game', function() {
		if(!user_data[socket.handshake.sessionID]) {
			socket.emit('not partnered', {});
			return;
		} else {
			player_sockets[socket.handshake.sessionID] = socket;
		}

		socket.emit('game time', {time: 150});

		// TODO: present first game image
		socket.emit('new image', {image: 'http://77wallpaper.com/wp-content/uploads/2013/11/Cool-Car-Pictures-49.jpg'});
	});
	
	socket.on('guess', function(data) {
		// TODO: save to guess array if unique for user

		// confirm guess if saved
		socket.emit('guess received', {guess: data.guess})
		// otherwise, emit new image

		// TODO: send user points for image match, scale by something?
	});

	socket.on('disconnect', function() {
		if(waiting) {
			// removed closed connections from the waiting lists
			var index = waiters.indexOf(socket.handshake.sessionID);
			waiters.splice(index, 1);
		} else {
			// TODO: Disconnect the partner, or notify them somehow
			// clean up hanging connection data
			// Perhaps run a set interval loop and check partner's socket.connected property
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
		game_data[player1] = {};

		var player2 = null;

		if(players.length) {
			index = Math.floor(Math.random() * players.length);
			player2 = players[index];
			players.splice(index, 1);

			user_data[player2] = {};
			user_data[player2].gameID = player1;
			user_data[player2].guesses = [];
			user_data[player2].partner = player1;
		}

		user_data[player1].partner = player2;

		// TODO: set up game for players (query data for game_data object)

		// Put the paired players in game
		player_sockets[player1].emit('wait complete', {});
		if(player2) {
			player_sockets[player2].emit('wait complete', {})
		}
	}
}