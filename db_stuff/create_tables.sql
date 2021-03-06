-- The setup procedure for db


----- GAME + CAPTCHA DB STUFF -----
-----------------------------------

CREATE TABLE images (
img_id SERIAL,
url TEXT UNIQUE,
attribution_url TEXT UNIQUE,
skip_count INT DEFAULT 0,
flag_count INT DEFAULT 0,
PRIMARY KEY (img_id)
);

CREATE TABLE guesses (
guess_id SERIAL,
img_id INT,
guesses JSON,
PRIMARY KEY (guess_id),
FOREIGN KEY (img_id) REFERENCES images ON DELETE CASCADE
);

CREATE TABLE tags (
img_id INT,
noun TEXT,
count INT DEFAULT 0,
PRIMARY KEY (img_id, noun),
FOREIGN KEY (img_id) REFERENCES images ON DELETE CASCADE
);

CREATE TABLE game_log (
log_id SERIAL,
time TIMESTAMP DEFAULT now(),
event TEXT,
uuid TEXT,
data JSON,
PRIMARY KEY (log_id)
);

CREATE TABLE game_survey (
response_id SERIAL,
time TIMESTAMP DEFAULT now(),
uuid TEXT,
language TEXT,
english BOOLEAN,
country TEXT,
state TEXT,
age INT DEFAULT 0,
sex TEXT,
education TEXT,
input TEXT,
enjoyed BOOLEAN,
followed_rules BOOLEAN,
nouns_only BOOLEAN,
image_quality BOOLEAN,
how_found TEXT,
comments TEXT,
PRIMARY KEY (response_id)
);

CREATE TABLE game_tokens (
token_id SERIAL,
uuid TEXT,
token TEXT,
PRIMARY KEY (token_id)
);

CREATE TABLE game_count (
count INT,
PRIMARY KEY (count)
);

INSERT INTO game_count (count)
VALUES (0);


----- CAPTCHA ONLY DB STUFF -----
---------------------------------

CREATE TABLE contentious_tags (
img_id INT,
noun TEXT,
count INT DEFAULT 0,
PRIMARY KEY (img_id, noun),
FOREIGN KEY (img_id) REFERENCES images ON DELETE CASCADE
);

CREATE TABLE cap_log (
log_id SERIAL,
time TIMESTAMP DEFAULT now(),
event TEXT,
uuid TEXT,
data JSON,
PRIMARY KEY (log_id)
);

CREATE TABLE cap_tokens (
token_id SERIAL,
uuid TEXT,
token TEXT,
PRIMARY KEY (token_id)
);

CREATE TABLE recap_prompts (
	cap_id SERIAL,
	url TEXT,
	solution TEXT,
	PRIMARY KEY (cap_id)
);

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

