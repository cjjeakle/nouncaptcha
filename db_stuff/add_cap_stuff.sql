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

