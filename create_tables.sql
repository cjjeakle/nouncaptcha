-- The setup procedure for db

CREATE TABLE images (
img_id SERIAL,
url TEXT UNIQUE,
attribution_url TEXT,
skip_count INT,
PRIMARY KEY (img_id)
);

CREATE TABLE image_guesses (
guess_id SERIAL,
img_id INT,
taboo JSON,
guesses JSON,
PRIMARY KEY (guess_id),
FOREIGN KEY (img_id) REFERENCES images ON DELETE CASCADE
);

CREATE TABLE tags (
img_id INT,
noun TEXT,
count INT,
PRIMARY KEY (img_id, noun),
FOREIGN KEY (img_id) REFERENCES images ON DELETE CASCADE
);

CREATE TABLE game_log (
log_id SERIAL,
time TIMESTAMP,
event TEXT,
data JSON,
PRIMARY KEY (log_id)
);

CREATE TABLE game_survey (
response_id SERIAL,
time TIMESTAMP,
language TEXT,
country TEXT,
state TEXT,
age INT,
sex TEXT,
education TEXT,
input TEXT,
enjoyed BOOLEAN,
followed_rules BOOLEAN,
nouns_only BOOLEAN,
image_quality BOOLEAN,
suggestions TEXT,
comments TEXT,
PRIMARY KEY (response_id)
);

CREATE TABLE game_tokens (
token_id SERIAL,
token TEXT,
PRIMARY KEY (token_id)
);

