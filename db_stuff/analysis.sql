SELECT count(*) from game_log;

SELECT l1.log_id, l1.uuid FROM game_log l1 
LEFT JOIN game_log l2
ON l1.uuid = l2.uuid AND l2.event like '%disconnect%'
WHERE l1.event = 'new game' AND l2.event IS NULL
ORDER BY l1.log_id DESC;

SELECT t.token, s.response_id, s.country, count(*)
FROM game_log l 
INNER JOIN game_survey s 
ON l.uuid = s.uuid 
INNER JOIN game_tokens t 
ON t.uuid = l.uuid 
WHERE l.event = 'starting'
GROUP BY t.token, s.response_id 
ORDER BY s.time DESC;


SELECT i.url, t.noun, t.count 
FROM images i 
INNER JOIN tags t 
ON i.img_id = t.img_id 
WHERE t.count >= 5
ORDER BY t.count DESC;

SELECT count(*) from tags;

