CREATE TABLE recap_prompts (
	cap_id SERIAL,
	url TEXT,
	solution TEXT,
	PRIMARY KEY (cap_id)
);

INSERT INTO recaptcha_prompts (url, solution)
VALUES ('https://nouncaptcha.s3.amazonaws.com/recaptcha/cap0.jpg', '244452440'),
	('https://nouncaptcha.s3.amazonaws.com/recaptcha/cap1.jpg', '2446454615'),
	('https://nouncaptcha.s3.amazonaws.com/recaptcha/cap2.jpg', '12032855469'),
	('https://nouncaptcha.s3.amazonaws.com/recaptcha/cap3.jpg', '23832854838'),
	('https://nouncaptcha.s3.amazonaws.com/recaptcha/cap4.jpg', '1189924899'),
	('https://nouncaptcha.s3.amazonaws.com/recaptcha/cap5.jpg', '563995921862'),
	('https://nouncaptcha.s3.amazonaws.com/recaptcha/cap6.jpg', 'edtuxp rich'),
	('https://nouncaptcha.s3.amazonaws.com/recaptcha/cap7.jpg', 'aiedfl aye'),
	('https://nouncaptcha.s3.amazonaws.com/recaptcha/cap8.jpg', 'Introduction photheis'),
	('https://nouncaptcha.s3.amazonaws.com/recaptcha/cap9.jpg', 'arm Artcompi'),
	('https://nouncaptcha.s3.amazonaws.com/recaptcha/cap10.jpg', '429633482'),
	('https://nouncaptcha.s3.amazonaws.com/recaptcha/cap11.jpg', '22428985137');

CREATE TABLE recap_data (
	uuid TEXT,
	cap_id INT,
	time INT,
	response TEXT,
	PRIMARY KEY (uuid, cap_id)
);

CREATE TABLE prac_data (
	uuid TEXT,
	img_id INT,
	time INT,
	score INT,
	PRIMARY KEY (uuid, img_id)
);

CREATE TABLE cap_survey (
response_id SERIAL,
time TIMESTAMP DEFAULT now(),
uuid TEXT UNIQUE,
cap_time INT,
cap_pass BOOLEAN,
language TEXT,
english BOOLEAN,
country TEXT,
state TEXT,
age INT DEFAULT 0,
sex TEXT,
education TEXT,
input TEXT,
understood BOOLEAN,
image_quality BOOLEAN,
prefer_check BOOLEAN,
cap_obv BOOLEAN,
recap_obv BOOLEAN,
easier INT DEFAULT 0,
faster INT DEFAULT 0,
preferable INT DEFAULT 0,
how_found TEXT,
comments TEXT,
PRIMARY KEY (response_id)
);
