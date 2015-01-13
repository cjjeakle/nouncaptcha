/*
 * The Following functions were used to initially grab images for the game, but are not currently in use
 */

var pg = require('pg').native;
var PG_URL = require('./globals').database_url;

var uuid = require('node-uuid');

var Flickr = require("flickrapi");
var flickrOptions = {
	api_key: process.env.FLICKRKEY,
	secret: process.env.FLICKRSECRET,
	user_ud: process.env.FLICKR_USER_ID,
	access_token: process.env.FLICKR_ACCESS_TOKEN,
	access_token_secret: process.env.FLICKR_ACCESS_TOKEN_SECRET
};

var request = require('request').defaults({ encoding: null });

var AWS = require('aws-sdk');
AWS.config.region = '';


/////////////////////////////////Public Methods/////////////////////////////////
////////////////////////////////////////////////////////////////////////////////



exports.check_and_get_images = function check_and_get_images() {
	pg.connect(PG_URL, function(err, client, done) {
		if (err) {
			return console.error('Error establishing connection to client', err);
		}

		var query = 'SELECT COUNT(*) count FROM images WHERE skip_count < '
			+ max_skips+' AND flag_count < ' + max_flags + ';';

		client.query(query, function(err, data) {
			done();
			if (err) {
				return console.error('error running query (log data)', err);
			}

			if(data.rows[0].count < 20) {
				get_flickr_images();
			}
		});
	});
}



////////////////////////////////Private Methods/////////////////////////////////
////////////////////////////////////////////////////////////////////////////////



function get_flickr_images() {
	Flickr.authenticate(flickrOptions, function(error, flickr) {

		var options = {
			sort: 'interestingness-desc',		// Interesting images first
			license: [1, 2, 3, 4, 5, 6],		// Attribution licenses
			privacy_filter: 1,					// Public images only
			safe_search: 1,						// Safe (rather than moderate/restricted)
			content_type: 7,					// Only photos and "Other"
			media: 'photos',
			page: 1,
			per_page: 50
		};

		flickr.photos.search(options, function(err, result) {
			if(err) {
				console.error('flickr error: ', err);
				return;
			}
			result.photos.photo.forEach(function(image) {
				process_image(image);
			});
		});
	});	
}

function process_image (image) {
	Flickr.authenticate(flickrOptions, function(error, flickr) {
		var url = 'http://farm' + image.farm + '.staticflickr.com/' 
		+ image.server + '/' + image.id + '_' + image.secret + '.jpg';

		options = {
			user_id: flickr.options.user_id,
			photo_id: image.id
		};

		flickr.photos.getInfo(options, function (err, result) {
			if(result.photo.usage.candownload == 1 && 
				result.photo.usage.canshare == 1 &&
				result.photo.license > 0 &&
				result.photo.license < 7) {
				var attr_url = 'something failed';
				if(result.photo.urls && result.photo.urls.url.length > 0) {
					attr_url = result.photo.urls.url[0]._content;
				}
				store_image(url, attr_url);
			}
		});
	});	
};

function store_image(url, attr_url) {
	request.get(url, function (err, res, body) {
		if(err) {
			console.error('error grabbing image');
			return;
		}

		image = new Buffer(body);
		var s3bucket = new AWS.S3();

		var s3_id = 'images/' + uuid.v4();
		s3_id += '.jpg';

		s3bucket.createBucket(function() {
			data = {
				Bucket: process.env.S3_BUCKET_NAME,
				Key: s3_id,
				ContentType: 'image/jpeg',
				ContentLength: image.length,
				Body: image
			};

			s3bucket.putObject(data, function(err, data) {
				if (err) {
					console.error('Error uploading data', err);
					return;
				}
				console.log('Successful image upload');
				var s3_url = 'https://' + process.env.S3_BUCKET_NAME + '.s3.amazonaws.com/'+ s3_id;
				index_image(s3_url, attr_url);
			});
		});
	});	
};

function index_image(s3_url, attr_url) {
	pg.connect(PG_URL, function(err, client, done) {
		if (err) {
			return console.error('Error establishing connection to client', err);
		}

		var query = 'INSERT INTO images(url, attribution_url)'
		 + ' VALUES ($1, $2);'

		client.query(query, [s3_url, attr_url], function(err, data) {
			done();
			if (err) {
				return console.error('error running query (save images)', err);
			}
		});
	});
}