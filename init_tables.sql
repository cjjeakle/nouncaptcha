-- Give the tables some initial values

INSERT INTO images (url, skip_count) 
VALUES ('http://77wallpaper.com/wp-content/uploads/2013/11/Cool-Car-Pictures-49.jpg', 0),
	('http://farm8.staticflickr.com/7427/13232125833_0bfbca3f32.jpg', 0),
	('http://farm4.staticflickr.com/3748/13233960474_6188a276ca.jpg', 0),
	('http://farm8.staticflickr.com/7404/13233961384_11a891fdb8.jpg', 0),
	('http://farm4.staticflickr.com/3722/13233961424_77d9530b84.jpg', 0),
	('http://farm3.staticflickr.com/2864/13233961864_26d84a3719.jpg', 0),
	('http://farm8.staticflickr.com/7264/13233635375_d2dbc9649c.jpg', 0),
	('http://farm8.staticflickr.com/7254/13233439953_549d72d89a.jpg', 0),
	('http://farm4.staticflickr.com/3826/13232609104_961bd57f12.jpg', 0),
	('http://farm4.staticflickr.com/3710/13201532363_310a83b44b.jpg', 0),
	('http://farm4.staticflickr.com/3763/13193529034_1879e9d22d.jpg', 0),
	('http://farm3.staticflickr.com/2800/13199170895_610dc6eaf3.jpg', 0),
	('http://farm8.staticflickr.com/7336/13185458504_fed82d5172.jpg', 0),
	('http://farm3.staticflickr.com/2885/13205145903_20d9b285dd.jpg', 0);

INSERT INTO image_guesses (img_id, guesses, taboo)
VALUES (1, '["car","wheel", "rim", "windshield","tail light","mirror","rearview mirror","rear view mirror"]', '["car", "wheel", "tire"]'),
	(2, '["sign","danger sign", "snow", "trees","tree","twig","twigs","sky"]', '["snow", "tree"]'),
	(3, '["car","cars", "barrier", "lights","grass","sky","cloud","clouds", "building", "person", "fire extinguisher"]', '[]'),
	(4, '["leather","bullet", "shell", "casing","shell","brass"]', '[]'),
	(5, '["skillet", "stove", "pan", "wood", "food", "onion", "onions"]', '[]'),
	(6, '["jet", "jets", "fighter", "fighters", "fighter jet", "fighter jets", "missles", "clouds", "missle"]', '[]'),
	(7, '["arch", "arches", "roof", "building", "buildings", "barrier", "gate", "gutter", "forest"]', '[]'),
	(8, '["beach", "rocks", "ramp", "ocean", "water", "trees", "palm trees", "palm tree"]', '[]'),
	(9, '["water", "flowers", "pillows", "window", "windows", "chair", "chairs", "radiator"]', '[]'),
	(10, '["flag", "american flag", "American flag", "house", "stairs", "window", "porch", "branches"]', '[]'),
	(11, '["squirrel", "flowers", "grass"]', '[]'),
	(12, '["door", "snow", "house", "building", "cabin", "forest"]', '[]'),
	(13, '["city", "tower", "towers", "building", "buildings", "sky scrapers", "skyscrapers", "river"]', '[]'),
	(14, '["plane", "airplane", "propeller", "propellers", "runway", "grass", "building", "warehouse", "forest", "hill", "mountain"]', '[]');

INSERT INTO tags (img_id, noun, count)
VALUES (1, 'car', 5), 
	(1, 'wheel', 5),
	(1, 'tire', 5),
	(2, 'snow', 5),
	(2, 'tree', 5);

INSERT INTO game_count (count)
VALUES (0);
