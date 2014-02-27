// A simple web server


//////////////////////////////////// Setup /////////////////////////////////////


var express = require('express');
var logfmt = require('logfmt');
var routes = require('./routes');
var http = require('http');
var path = require('path');
var pg = require('pg').native;
var request = require('request');

var app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(logfmt.requestLogger());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(express.bodyParser());
app.use(express.cookieParser());
// Secret will be made an env var later
app.use(express.cookieSession({secret: 'SECRET!'}));
app.use(app.router);

// Only serve content from the /public/... directory
app.use(express.static(path.join(__dirname, 'public')));

// Listen on the environment's desired port or at 5000
var port = process.env.PORT || 5000;
app.listen(port, function() {
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

// Create the server
http.createServer(app);


//////////////////////////////// Implementation ////////////////////////////////


// How to handle get requests
app.get('/', routes.nouncaptcha(pg));



