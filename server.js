// Web Server

//////////////////////////////////// Setup /////////////////////////////////////


var express = require('express');
var http = require('http');
var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);

var uuid = require('node-uuid');

var routes = require('./routes');
var path = require('path');

var game_handlers = require('./game_handlers');
var cap_handlers = require('./cap_handlers');

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

io.set('transports', [
	'websocket'
]);

app.use(express.static(__dirname + '/static'));

// Only serve static content from the /public/... directory
app.use(express.static(path.join(__dirname, 'public')));

// Listen on the environment's desired port or at 4000
var port = require('./config').port;
server.listen(port, function() {
	console.log('Listening on ' + port);
});


///////////////////////////////// HTTP Handlers ////////////////////////////////


// Get requests
///////////////////
app.get('/', routes.index);
// Game
app.get('/game', routes.game);
app.get('/game_HIT', routes.game_HIT);
app.get('/game_HIT_debrief', routes.game_HIT_debrief);
app.get('/start_game_survey', routes.game_info);
app.get('/game_test', routes.game_test);
app.get('/game_survey', routes.game_survey);
app.get('/game_survey_debrief', routes.game_debrief);
// CAPTCHA
app.get('/start_captcha_survey', routes.start_captcha_survey);
app.get('/recaptcha_test', routes.recaptcha_test);
app.get('/captcha_practice', routes.captcha_practice);
app.get('/captcha_test', routes.captcha_test);
app.get('/captcha_survey', routes.captcha_survey);
app.get('/captcha_survey_debrief', routes.captcha_debrief);

// Post requests
///////////////////
app.post('/submit_game_survey', routes.submit_game_survey);
app.post('/submit_captcha_survey', routes.submit_captcha_survey);

//////////////////////////////// Socket Handlers ///////////////////////////////


io.sockets.on('connection', function (socket) {
	socket.uuid = uuid.v4();
	socket.on('set uuid', function(data) {
		socket.uuid = data.uuid;
		socket.emit('uuid recieved');
	});
	

	// Game events
	socket.on('start game', game_handlers.start_game(socket));
	socket.on('guess', game_handlers.guess_handler(socket));
	socket.on('flag image', game_handlers.flag_handler(socket));
	socket.on('request skip', game_handlers.skip_handler(socket));
	socket.on('last image', function() {
		socket.playing = false;
	});
	socket.on('game_over', function() {
		socket.playing = false;
	});
	socket.on('score', game_handlers.score_handler(socket));


	//CAPTCHA events
	socket.on('start CAPTCHA', cap_handlers.start_CAPTCHA(socket));
	socket.on('CAPTCHA submission', cap_handlers.submission_handler(socket));
});





