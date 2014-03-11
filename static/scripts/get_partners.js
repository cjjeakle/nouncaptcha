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