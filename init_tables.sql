-- Give the tables some initial values

INSERT INTO images (url, skip_count) 
VALUES ('http://77wallpaper.com/wp-content/uploads/2013/11/Cool-Car-Pictures-49.jpg', 0),
	('http://static.ddmcdn.com/gif/airplanes-work-1.jpg', 0);

INSERT INTO image_guesses (img_id, guesses, taboo)
VALUES (1, '["car","wheel", "rim", "windshield","tail light","mirror","rearview mirror","rear view mirror"]', '["car", "wheel", "tire"]');

INSERT INTO tags (img_id, noun, count)
VALUES (1, 'car', 5), (1, 'wheel', 5), (1, 'tire', 5);
