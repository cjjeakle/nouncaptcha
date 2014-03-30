
-- Excluded users never formally disconnected due to error
-- Appears to be due to Heroku Dyno idleing during their game
\echo 'List of connected UUIDs'
SELECT l1.log_id, l1.uuid FROM game_log l1 
LEFT JOIN game_log l2
ON l1.uuid = l2.uuid AND l2.event like '%disconnect%'
WHERE l1.event = 'new game' AND l2.event IS NULL
AND l1.log_id != 356 AND l1.log_id != 1233 AND l1.log_id != 1219
ORDER BY l1.log_id DESC;

\echo 'List of most recent 5 survey responses, their token and image count'
SELECT s.time, s.how_found, count(*)
FROM game_log l 
INNER JOIN game_survey s 
ON l.uuid = s.uuid 
WHERE l.event = 'starting'
GROUP BY s.response_id 
ORDER BY s.time DESC
LIMIT 10;

\echo 'Number of survey responses'
SELECT count(*) - 1 AS count FROM game_survey;

/*
\echo 'List of taboo tags and their corresponding image'
SELECT i.url, t.noun, t.count 
FROM images i 
INNER JOIN tags t 
ON i.img_id = t.img_id 
WHERE t.count >= 5
ORDER BY t.img_id DESC;
*/

\echo 'Total number of taboo tags per image'
SELECT img_id, count(*) FROM tags
WHERE count >= 5
GROUP BY img_id
ORDER by count(*) DESC;

\echo 'Total number of tags'
SELECT count(*) from tags;
