var socket = io.connect('');
var wants_skip = false;
var playing = false;
var taboo_list = [];
var guesses = [];
var score = 0;

///// Socket Handlers /////

alert('In this game, be sure to only respond with nouns.'
	+ '\n(nouns are people, places, and things.)' +
	'\n\n eg: car or tire, not driving (verb) or fast (adjective).');

socket.emit('waiting', {});

socket.on('already connected', function() {
	alert('This IP address is already in a game or are being paired. Please close this window.' +
		'\n\nIf you got this message in error, refresh the page.' +
		'\n\n(You may need to clear your cookies or restart the browser.)');
});

socket.on('wait time', function (data) {
	var time = data.time;
	document.getElementById('time').innerHTML = seconds_to_clock(time);
	setInterval(function() {
		if(time > 0) {
			time--;
		} else if (!playing) {
			socket.emit('start single player', {});
		}
		document.getElementById('time').innerHTML = seconds_to_clock(time);
	}, 1000);
});

socket.on('start game', function(data) {
	playing = true;
	document.getElementById('partner_up').style.display = 'none';

	var time = data.time;
	document.getElementById('timer').innerHTML = seconds_to_clock(time);
	setInterval(function() {
		if(time > 0) {
			time--;
		} else {
			socket.emit('game over', {});
			end_game();
		}
		document.getElementById('timer').innerHTML = seconds_to_clock(time);
	}, 1000);
});

socket.on('add points', function(data) {
	score += 500;
	document.getElementById('score').innerHTML = score;
	display_message('Nice work, you guessed your partner\'s thoughts!');
})

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
});

socket.on('skip requested', function(data) {
	alert_message('Your partner would like to skip.');
});

socket.on('image skipped', function(data) {
	score -= 250;
	document.getElementById('score').innerHTML = score;
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

function update_score(points) {
	score = score + points;
	document.getElementById('score').innerHTML = score;
}

function game_error(msg) {
	playing = false;
	document.getElementById('guess').disabled = true;
	alert(msg + 
		'\nYour final score is: ' + score + ' points.' +
		'\n\n' + continue_message);
	window.location.href = link;
}

function end_game() {
	playing = false;
	document.getElementById('guess').disabled = true;
	var greeting = ''
	var punctuation = '.';
	if(score >= 500) {
		greeting = 'Great job!\n';
		punctuation = '!';
	}
	alert(greeting + 
		'Your final score is: ' + score + ' points' + punctuation +
		'\n\n' + continue_message);
	window.location.href = link;
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

	var time = minutes + ':' + seconds;
	return time;
}


