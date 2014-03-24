var socket = io.connect('');
var wants_skip = false;
var playing = false;
var connected = false;
var taboo_list = [];
var guesses = [];
var score = 0;
var skip_appear;

///// Socket Handlers /////

alert('In this game, be sure to only respond with nouns.'
	+ '\n(nouns are people, places, and things.)' +
	'\n\n eg: car or tire, not driving (verb) or fast (adjective).');


function connected_msg() {
	var message = 'This IP address is already in a game or are being paired. Please close this window.';
	alert(message + '\n\nIf you got this message in error, refresh the page or restart your browser.');
	document.getElementById('placeholder_message').innerHTML = message;
}

var already_connected = sessionStorage.getItem('connected');
if(already_connected != 'true') {
	socket.emit('waiting', {});
	sessionStorage.setItem('connected', 'true');
	connected = true;
} else {
	connected_msg();
}

socket.on('already connected', function() {
	connected_msg();
});

socket.on('token', function(data) {
	localStorage.setItem('game_finished', false);
	localStorage.setItem('token', data.token);
	localStorage.setItem('uuid', data.uuid);
});

socket.on('wait time', function (data) {
	var time = data.time;
	document.getElementById('time').innerHTML = seconds_to_clock(time);
	setInterval(function() {
		if(time > 0) {
			time--;
		}
		// It takes ~1 second to start single player, so request a game with some buffer time
		if (time < 3 && !playing) {
			socket.emit('start single player', {});
		}
		document.getElementById('time').innerHTML = seconds_to_clock(time);
	}, 1000);
});

socket.on('game ready', function(data) {
	document.getElementById('placeholder_message').innerHTML = 'Waiting for partner to respond...';
	alert('Partner found!');
	socket.emit('player ready');
});

socket.on('start game', function(data) {
	playing = true;
	document.getElementById('placeholder').style.display = 'none';

	var time = data.time;
	var prev_time = new Date();
	document.getElementById('timer').innerHTML = seconds_to_clock(time);
	
	setInterval(function() {
		var cur_time = new Date();
		time -= (cur_time - prev_time) / 1000;
		prev_time = cur_time;

		if(time > 0) {
			document.getElementById('timer').innerHTML = seconds_to_clock(Math.floor(time));
		} else if (playing) {
			socket.emit('game over', {});
			end_game();
		}
	}, 1000);
});

socket.on('add points', function(data) {
	add_points(500);
	display_message('Nice work, you guessed your partner\'s thoughts!');
});

socket.on('new image', function(data) {
	update_image(data.image);
	clear_data('guesses');
	clear_data('taboo');
	for (var i = 0; i < data.taboo.length; ++i) {
		add_data('taboo', data.taboo[i]);
	}
	taboo = data.taboo;
	guesses = [];

	wants_skip = false;
	hide_timed_buttons();
});

socket.on('image flagged', function(data) {
	display_message('The previous image has been flagged.');
	add_points(500);
});

socket.on('skip requested', function(data) {
	alert_message('Your partner would like to skip.');
});

socket.on('image skipped', function(data) {
	add_points(-75);
	display_message('Your team has skipped an image, -250 points.');
});

socket.on('game over', function() {
	end_game();
});

socket.on('partner disconnect', function() {
	if(!playing) {
		return;
	}
	game_error('An error occurred!\n' + 
		'Your partner\'s connection was lost.\n');
});

socket.on('database error', function() {
	alert('There has been a database error. Press okay to try a new game.');
	window.location.href = window.location.href;
});


///// Socket Helper Functions /////
function update_image(link) {
	document.getElementById('pic').src = link;
}

function add_points(points) {
	score = score + points;
	document.getElementById('score').innerHTML = score;
}

function game_error(msg) {
	playing = false;
	localStorage.setItem('game_finished', true);
	document.getElementById('guess').disabled = true;
	var choice = confirm(msg + 
		'\nYour final score is: ' + score + ' points.' +
		'\n\n' + continue_message);
	if(choice) {
		window.location.href = link;
	}
	show_placeholder();
}

function end_game() {
	playing = false;
	localStorage.setItem('game_finished', true);
	document.getElementById('guess').disabled = true;
	var greeting = ''
	var punctuation = '.';
	if(score >= 500) {
		greeting = 'Great job!\n';
		punctuation = '!';
	}
	var choice = confirm (greeting + 
		'Your final score is: ' + score + ' points' + punctuation +
		'\n\n' + continue_message);
	if(choice) {
		window.location.href = link;
	}
	show_placeholder();
}



///// In-Document Helper Functions /////
function send_guess() {
	if(!playing) {
		return;
	}

	var user_guess = document.getElementById('guess').value;
	
	if(user_guess == '') {
		alert_message('Please write something before submitting.');
		return;
	}
	if(taboo.indexOf(user_guess) != -1) {
		alert_message('You guessed an off-limits word!');
		var user_guess = document.getElementById('guess').value = '';
		return;
	}
	if(guesses.indexOf(user_guess) != -1) {
		alert_message('This word has already been submitted.');
		var user_guess = document.getElementById('guess').value = '';
		return;
	}

	display_message('');
	guesses.push(user_guess);
	add_data('guesses', user_guess);
	socket.emit('guess', {guess: user_guess});
	
	var user_guess = document.getElementById('guess').value = '';
}

function flag_image() {
	var msg = 'Are you sure you would like to flag this image?';
	var choice = confirm (msg); 
	if(choice) {
		socket.emit('flag image', {});
	}
}

function request_skip() {
	if(!playing) {
		return;
	}
	if(wants_skip) {
		return;
	}
	wants_skip = true;
	display_message('Your partner has been told you would like to skip.');
	socket.emit('request skip');
}

function alert_message(msg) {
	display_message(msg);
	window.location.hash = '#notifications';
}

function display_message(msg) {
	window.location.hash = '';
	var notes = document.getElementById('notifications')
	if(msg.length) {
		notes.style.display = 'inherit';
		notes.innerHTML = '<br/>' + msg + '<br/><br/>';
	} else {
		notes.style.display = 'none';
	}
}

function add_data (id, msg) {
	var elt = document.getElementById(id)
	elt.innerHTML += msg + '<br/>';
}

function clear_data (id) {
	var elt = document.getElementById(id)
	elt.innerHTML = '';
}

function check_enter(e)
{
	// look for window.event in case event isn't passed in
	if (typeof e == 'undefined' && window.event) { e = window.event; }
	
	// key code 13 is enter
	if (e.keyCode == 13)
	{
		send_guess();
	}
}

function seconds_to_clock(seconds_) {
	var minutes = Math.floor(seconds_ / 60);
	var seconds = seconds_ % 60;

	var time = minutes + ':';
	if(seconds < 10) {
		time += '0';
	}
	time += seconds;
	return time;
}

function hide_timed_buttons() {
	clearTimeout(skip_appear);
	document.getElementById('flag_link').style.display = 'none';
	document.getElementById('skip_btn').style.display = 'none';
	skip_appear = setTimeout(function() {
		document.getElementById('flag_link').style.display = 'inline-block';
		document.getElementById('skip_btn').style.display = 'inline-block';
	}, 7000);
}

function show_placeholder() {
	document.getElementById('placeholder').style.display = '';
	document.getElementById('placeholder_message').innerHTML = 
		'Game over. Your final score was: ' + score + '.<br/><br/>'
		+ '<a href = \"' + link + '\" class = "btn btn-sm btn-success">'
		+ continue_btn + '</a>';
}

function cleanup () {
	if(sessionStorage.getItem('connected') == 'true' && connected) {
		sessionStorage.setItem('connected', 'false');
	}
}
