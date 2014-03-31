/*
 * The noun CAPTCHA. 
 * Places the CAPTCHA into a div named "noun_captcha".
 * Requires bootstrap and this js file.
 */

var socket = io.connect();
var container = document.getElementById('noun_captcha');

var error = false;
var expanded = false;
var choices = [];
var choice_text = [];



// Build the CAPTCHA into the page
//////////////////////////////////

container.setAttribute('style', 'display: inline-block; padding: 15px;')
container.className = 'jumbotron center-block centered';

// nouncaptcha header
var header = document.createElement('h3');
header.innerHTML = 'nouncaptcha';
header.className = 'text-muted';
header.style['text-align'] = 'left';
container.appendChild(header);
container.appendChild(document.createElement('br'));

// Instructions text
var instructions = document.createElement('textBlock');
instructions.innerHTML = 'Loading...';
container.appendChild(instructions);

// Prompt image
var image = document.createElement('img');
image.className = 'img-responsive center-block'
image.setAttribute('style', 'max-height: 300px; max-width: 300px;')
image.setAttribute('onclick', 'toggle_image_size();')
container.appendChild(image);
container.appendChild(document.createElement('br'));

// Answer options
var choice_parent = document.createElement('div');
choice_parent.style['text-align'] = 'center';
var choice_div = document.createElement('div');
choice_div.style.display = 'inline-block';
choice_div.style['text-align'] = 'left';
choice_parent.appendChild(choice_div);
container.appendChild(choice_parent);

// Submit button
var submit = document.createElement('a');
submit.setAttribute('href', 'javascript:send_CAPTCHA()');
submit.innerHTML = '>>';
submit.className = 'btn btn-xs btn-primary'
container.appendChild(submit);
container.appendChild(document.createElement('br'));
// Progress bar
var progress_container = document.createElement('div');
progress_container.setAttribute('style', 'width:100%; height:3px; background-color:#FFEBCD;');
var progress_bar = document.createElement('div');
progress_bar.setAttribute('style', 'height:3px; background-color:#66CCFF;');
progress_bar.style.width = '0%';
progress_container.appendChild(progress_bar);
container.appendChild(progress_container);



// Socket Interaction
/////////////////////

socket.emit('start CAPTCHA');

socket.on('CAPTCHA prompt', function(data) {
	instructions.innerHTML = 'Are any nouns below in this image?<br/>'
		+ '(click the image to enlarge)<br/><br/>';
	image.src = data.image.url;

	while (choice_div.hasChildNodes()) {
		choice_div.removeChild(choice_div.lastChild);
	}
	choices = [];
	choice_text = [];
	for(var i = 0; i < data.prompts.length; ++i) {
		choices.push(document.createElement('input'));
		choices[i].type = 'checkbox';
		choices[i].name = 'noun' + i;
		choices[i].value = data.prompts[i];
		choice_text.push(document.createElement('textBlock'));
		choice_text[i].innerHTML = ' ' + data.prompts[i] + '<br/>';
	}

	for(var i = 0; i < choices.length; ++i) {
		choice_div.appendChild(choices[i]);
		choice_div.appendChild(choice_text[i]);
	}
	progress_bar.style.width = data.completion + '%';
});

socket.on('CAPTCHA complete', function(data) {
	while (container.hasChildNodes()) {
		container.removeChild(container.lastChild);
	}
	container.appendChild(header);
	container.appendChild(document.createElement('br'));
	var msg = document.createElement('textNode');
	msg.innerHTML = 'Success! <br/><br/>';
	container.appendChild(msg);
	var continue_btn = document.createElement('a');
	continue_btn.className = 'btn btn-sm btn-success';
	continue_btn.innerHTML = 'continue';
	continue_btn.href = '/captcha';
	container.appendChild(continue_btn);
	container.appendChild(progress_container);
	progress_bar.style.width = '100%';
});

socket.on('CAPTCHA failed', function(data) {
	while (container.hasChildNodes()) {
		container.removeChild(container.lastChild);
	}
	container.appendChild(header);
	container.appendChild(document.createElement('br'));
	var msg = document.createElement('textNode');
	msg.innerHTML = 'Try again! <br/><br/>';
	container.appendChild(msg);
	var continue_btn = document.createElement('a');
	continue_btn.className = 'btn btn-sm btn-info';
	continue_btn.innerHTML = 'continue';
	continue_btn.href = '/captcha';
	container.appendChild(continue_btn);
	container.appendChild(progress_container);
	progress_bar.style.width = '100%';
});

socket.on('connection error', function(data) {
	alert('nouncaptcha:\nThere has been a connection error.');
	error = true;
});
 
function send_CAPTCHA() {
	if(error) {
		return;
	}
	chosen = [];
	not_chosen = [];
	choices.forEach(function(choice) {
		if(choice.checked) {
			chosen.push(choice.value);
		} else {
			not_chosen.push(choice.value);
		}
	});
	socket.emit('CAPTCHA submission', {
		choices: chosen, 
		not_chosen: not_chosen
	});
}



// Utility Functions
////////////////////

function toggle_image_size() {
	if(expanded) {
		image.setAttribute('style', 'max-height: 300px; max-width: 300px;');
	} else {
		image.setAttribute('style', 'max-height: 700px; max-width: 700px;')
	}
	expanded = !expanded;
}

