-- The setup procedure for db

CREATE TABLE images (
img_id SERIAL,
url TEXT UNIQUE,
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

/* A sufficent count promotes a frequent tag to a taboo tag */
CREATE TABLE tags (
img_id INT,
noun TEXT,
count INT,
PRIMARY KEY (img_id, noun),
FOREIGN KEY (img_id) REFERENCES images ON DELETE CASCADE
);

/* TODO: Implement survey response table */
