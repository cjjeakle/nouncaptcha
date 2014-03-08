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


var connections = [];
var partners = {};
var bucket_time = 30;

// Timer to pair players in 30 second buckets
setInterval(function() {
	if(bucket_time <= 0) {
		bucket_time = 31;
	}
	bucket_time -= 1;
}, 1000);


io.set('authorization', function (handshakeData, accept) {
	if (handshakeData.headers.cookie) {
		handshakeData.cookie = cookie.parse(handshakeData.headers.cookie);
		handshakeData.sessionID = connect.utils.parseSignedCookie(
			handshakeData.cookie['express.sid'], 'secret'
		);
		
		if (handshakeData.cookie['express.sid'] == handshakeData.sessionID) {
			return accept('Cookie is invalid.', false);
		}
		if(connections.indexOf(handshakeData.sessionID) != -1) {
			return accept('User already connected.', false);
		}
	} else {
		return accept('No cookie transmitted.', false);
	}
	
	console.log('Opening connection with ' + handshakeData.sessionID);
	connections.push(handshakeData.sessionID);
	accept(null, true);
});

io.sockets.on('connection', function (socket) {
	socket.emit('time', bucket_time)
	
	setInterval(function() {
		socket.emit('wait complete', {});
	}, bucket_time * 1000);

	socket.on('disconnect', function() {
		// removed closed connections from the list
		var index = connections.indexOf(socket.handshake.sessionID);
		connections.splice(index, 1);
		console.log('Closing connection with ' + socket.handshake.sessionID);
	});
});





