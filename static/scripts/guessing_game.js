var socket = io.connect('');
var playing = false;
var taboo_list = [];
var guesses = [];
var score = 0;
var images = 0;
var skip_appear;
var match_confirmed = false;
var just_skipped = false;
var just_flagged = false;
var cur_img_id = '';

var max_images = 15; 				// max number of images per game
var game_time = 150;				// starting time allotment
var match_bonus_points = 500;		// added points for a match
var match_bonus_time = 15;			// added time for a match
var skip_penalty_points = -25;		// subtracted points for a skip
var button_timeout = 4000;			// ms required for skip and flag buttons to appear

///// Socket Handlers /////

alert('In this game, be sure to only respond with nouns.'
	+ '\n(nouns are people, places, and things.)' +
	'\n\n eg: car or tire, not driving (verb) or fast (adjective).');

socket.on('token', function(data) {
	localStorage.setItem('game_finished', false);
	localStorage.setItem('token', data.token);
	localStorage.setItem('uuid', data.uuid);
});

socket.on('new image', function(data) {
	if(!playing) {
		start_game();
	}

	images++;
	if(images == max_images) {
		socket.emit('last image');
	}

	clear_data('guesses');
	clear_data('taboo');
	cur_img_id = data.image.img_id;
	document.getElementById('pic').src = data.image.url;
	document.getElementById('attribution').href = data.image.attribution_url;

	for (var i = 0; i < data.image.taboo.length; ++i) {
		add_data('taboo', data.image.taboo[i]);
	}
	taboo = data.image.taboo;
	guesses = [];

	wants_skip = false;
	hide_timed_buttons();

	var input_box = document.getElementById('guesses');
	input_box.focus();
	window.location.hash = '#guesses';

	if (match_confirmed) {
		display_message('Nice work, you guessed your partner\'s thoughts!<br/>+'+match_bonus_points+' points and +'+match_bonus_time+' seconds.');
	} else if(just_skipped) {
		display_message('Your team has skipped an image, '+skip_penalty_points+' points.');
	} else if (just_flagged) {
		display_message('The previous image has been flagged.<br/>+'+match_bonus_points+' points, but no extra time.');
	} else {
		display_message('');
	}
	match_confirmed = just_skipped = just_flagged = false;

	image_done_loading();
});

socket.on('add points', function(data) {
	check_done();
	add_points(match_bonus_points);
	game_time += match_bonus_time;
	match_confirmed = true;
	image_loading();
});

socket.on('image flagged', function(data) {
	check_done();
	add_points(match_bonus_points);
	just_flagged = true;
	image_loading();
});

socket.on('image skipped', function(data) {
	check_done();
	add_points(skip_penalty_points);
	just_skipped = true;
	image_loading();
});

socket.on('database error', function() {
	alert('There has been a database error.');
	end_game();
});


///// Socket Helper Functions /////


function add_points(points) {
	score = score + points;
	document.getElementById('score').innerHTML = score;
}

function check_done() {
	if(images == max_images) {
		end_game();
	}
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
	greeting += 'You helped classify ' + images + ' images in this round.\n';
	var choice = confirm (greeting + 
		'Your final score is: ' + score + ' points' + punctuation +
		'\n\n' + continue_message);
	if(choice) {
		window.location.href = link;
	}
	show_placeholder();
}


///// In-Document Helper Functions /////


function start_game() {
	playing = true;
	document.getElementById('placeholder').style.display = 'none';

	var prev_time = new Date();
	document.getElementById('timer').innerHTML = seconds_to_clock(game_time);
	
	setInterval(function() {
		var cur_time = new Date();
		game_time -= (cur_time - prev_time) / 1000;
		prev_time = cur_time;

		if(game_time > 0) {
			document.getElementById('timer').innerHTML = seconds_to_clock(Math.floor(game_time));
		} else if (playing) {
			socket.emit('game over', {});
			end_game();
		}
	}, 1000);
}

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

	guesses.push(user_guess);
	add_data('guesses', user_guess);
	socket.emit('guess', {guess: user_guess});
	
	var user_guess = document.getElementById('guess').value = '';
}

function flag_image() {
	var msg = 'Are you sure you would like to flag this image?';
	var choice = confirm (msg); 
	if(choice) {
		socket.emit('flag image', {img_id: cur_img_id});
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
	socket.emit('request skip', {img_id: cur_img_id});
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
	if (typeof e == 'undefined' && window.event) { 
		e = window.event; 
	}
	
	// key code 13 is enter
	if (e.keyCode == 13) {
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
	}, button_timeout);
}

function show_placeholder() {
	document.getElementById('placeholder').style.display = '';
	document.getElementById('placeholder_message').innerHTML = 
		'Game over. Your final score was: ' + score + '.<br/><br/>'
		+ '<a href = \"' + link + '\" class = "btn btn-sm btn-success">'
		+ continue_btn + '</a>';
}

function image_loading () {
	document.getElementById('loading').style.display = 'inline-block';
} 

function image_done_loading() {
	setTimeout(function() {
		document.getElementById('loading').style.display = 'none';
	}, 500);	
}

