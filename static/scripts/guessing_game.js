var socket = io.connect('');
var wants_skip = false;
var game_over = false;
var taboo_list = [];
var guesses = [];
var score = 0;

///// Socket Handlers /////
socket.emit('start game', {});

socket.on('game time', function(data) {
	time = data.time;
	document.getElementById('loading').style.display = 'none';
	document.getElementById('timer').innerHTML = time;
	setInterval(function() {
		if(time > 0) {
			time--;
		} else {
			socket.emit('game over', {});
			end_game();
		}
		document.getElementById('timer').innerHTML = time;
	}, 1000);
});

socket.on('guess received', function(data) {
	add_data('guesses', data.guess);
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

socket.on('partner skip', function(data) {
	display_message('Your partner is out of ideas and wants to skip.');
});

socket.on('image skipped', function(data) {
	score -= 250;
	document.getElementById('score').innerHTML = score;
	display_message('Your team has skipped an image, -250 points.');
});

socket.on('game over', function() {
	end_game();
})



///// Socket Helper Functions /////
function update_image(link) {
	document.getElementById('pic').src = link;
}

function update_score(points) {
	score = score + points;
	document.getElementById('score').innerHTML = score;
}

function end_game() {
	game_over = true;
	document.getElementById('guess').disabled = true;
	alert('Great job!' + 
		'\nYour final score is: ' + score + ' points!' +
		'\n\nPress okay to take a quick survey.');
	window.location.href = '/game_survey';
}



///// In-Document Helper Functions /////
function send_guess() {
	if(game_over) {
		return;
	}
	var user_guess = document.getElementById('guess').value;
	if(user_guess == '') {
		display_message('Please write something before submitting.');
		return;
	}
	if(taboo.indexOf(user_guess) != -1) {
		display_message('You guessed an off-limits word!');
		var user_guess = document.getElementById('guess').value = '';
		return;
	}
	if(guesses.indexOf(user_guess) != -1) {
		display_message('This word has already been submitted.');
		var user_guess = document.getElementById('guess').value = '';
		return;
	}
	display_message('');
	guesses.push(user_guess);
	socket.emit('guess', {guess: user_guess});
	var user_guess = document.getElementById('guess').value = '';
}

function request_skip() {
	if(game_over) {
		return;
	}
	if(wants_skip) {
		return;
	}
	wants_skip = true;
	display_message('Your partner has been told you would like to skip.');
	socket.emit('request skip');
}

function display_message(msg) {
	var notes = document.getElementById('notifications')
	if(msg.length) {
		notes.innerHTML = '<br/>' + msg + '<br/><br/>';
	} else {
		notes.innerHTML = '<br/>';
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


