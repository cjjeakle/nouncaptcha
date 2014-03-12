-- Give the tables some initial values

INSERT INTO images (url) 
VALUES ('http://77wallpaper.com/wp-content/uploads/2013/11/Cool-Car-Pictures-49.jpg'),
	('http://static.ddmcdn.com/gif/airplanes-work-1.jpg'),
	('');

INSERT INTO images_in_use (img_id, skip_count)
VALUES (1, 0), (2, 0);

INSERT INTO image_guesses (img_id, guesses, taboo)
VALUES (1, '["car","wheel", "rim", "windshield","tail light","mirror","rearview mirror","rear view mirror"]', '["car", "wheel", "tire"]');

INSERT INTO taboo_tags (img_id, noun)
VALUES (1, 'car'), (1, 'wheel'), (1, 'tire');

