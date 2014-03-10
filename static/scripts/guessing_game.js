var socket = io.connect('');
var wants_skip = false;
var score = 0;


///// Socket Handlers /////
socket.emit('start game', {});

socket.on('game time', function(data) {
	time = data.time;
	setInterval(function() {
		if(time > 0) {
			time--;
		} else {
			socket.emit('game over', {});

		}
		document.getElementById('timer').innerHTML = time;
	}, 1000);
});

socket.on('guess received', function(data) {
	add_data('guesses', data.guess);
});

socket.on('new image', function(data) {
	update_image(data.image);
	wants_skip = false;
	display_message('');
});

socket.on('partner skip', function(data) {
	display_message('Your partner is out of ideas and wants to skip.');
});



///// Socket Helper Functions /////
function update_image(link) {
	document.getElementById('pic').src = link;
}

function update_score(points) {
	score = score + points;
	document.getElementById('score').innerHTML = score;
}



///// In-Document Helper Functions /////
function send_guess() {
	var user_guess = document.getElementById('guess').value;
	if(user_guess == '') {
		return;
	}
	socket.emit('guess', {guess: user_guess});
	var user_guess = document.getElementById('guess').value = '';
}

function request_skip() {
	if(wants_skip) {
		return;
	}
	wants_skip = true;
	display_message('skip requested.');
	socket.emit('skip requested');
}

function display_message(msg) {
	var notes = document.getElementById('notifications')
	notes.innerHTML = '<br/>' + msg;
}

function add_data (id, msg) {
	var notes = document.getElementById(id)
	notes.innerHTML += '<br/>' + msg;
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

