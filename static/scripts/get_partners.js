alert('In this game, be sure to only respond with nouns.'
	+ '\n(nouns are people, places, and things.)' +
	'\n\n eg: car or tire, not driving (verb) or fast (adjective).');

var socket = io.connect('');
var time;

socket.emit('waiting', {});

socket.on('wait time', function (data) {
	time = data.time;
	document.getElementById('loading').style.display = 'none';
	document.getElementById('time').innerHTML = time;
	setInterval(function() {
		if(time > 0) {
			time--;
		}
		document.getElementById('time').innerHTML = time;
	}, 1000);
});

socket.on('wait complete', function (data) {
	window.location.href = link;
});

socket.on('already connected', function() {
	alert('You are already in a game or being paired. Please close this window.' +
		'\n\nIf you got this message in error, refresh the page.' +
		'\n\n(You may need to clear your cookies or restart the browser.)');
});

socket.on('database error', function() {
	alert('There has been a database error. Press okay to retry connection.');
	window.location.href = window.location.href;
});