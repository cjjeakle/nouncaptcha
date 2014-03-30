/*
 * The noun CAPTCHA. 
 * Places the CAPTCHA into a div named "noun_captcha".
 * Requires bootstrap and this js file.
 */

var socket = io.connect();
var container = document.getElementById('noun_captcha');

// Build the CAPTCHA into the page
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
instructions.innerHTML = 'Choose only the nouns that appear in this image:<br/>'
	+ '(click the image to enlarge it)';
container.appendChild(instructions);
container.appendChild(document.createElement('br'));
container.appendChild(document.createElement('br'));

// Prompt image
var image = document.createElement('img');
image.src = 'http://www.ancestry.com/wiki/images/archive/a/a9/20100708215937!Example.jpg';
image.className = 'img-responsive center-block'
image.setAttribute('style', 'max-height: 300px; max-width: 300px;')
container.appendChild(image);
container.appendChild(document.createElement('br'));

// Answer options
var choice_div = document.createElement('div');
var choices = [];
var choice_text = [];
for(var i = 0; i < 5; ++i) {
	choices.push(document.createElement('input'));
	choices[choices.length - 1].type = 'checkbox';
	choices[choices.length - 1].name = 'noun' + i;
	choice_text.push(document.createElement('textBlock'));
	choice_text[choice_text.length - 1].innerHTML = ' noun' + i + '<br/>';
}
for(var i = 0; i < choices.length; ++i) {
	choice_div.appendChild(choices[i]);
	choice_div.appendChild(choice_text[i]);
}
container.appendChild(choice_div);

// Submit button
var submit = document.createElement('a');
submit.setAttribute('href', 'javascript:send_CAPTCHA()');
submit.innerHTML = '>>';
submit.className = 'btn btn-xs btn-primary'
container.appendChild(submit);
container.appendChild(document.createElement('br'));
// Progress bar
var progress1 = document.createElement('div');
progress1.setAttribute('style', 'width:100%; height:3px; background-color:#FFEBCD;');
var progress2 = document.createElement('div');
progress2.setAttribute('style', 'height:3px; background-color:#66CCFF;');
progress2.style.width = '5%';
progress1.appendChild(progress2);
container.appendChild(progress1);



function send_CAPTCHA() {
	//TODO: This
}
