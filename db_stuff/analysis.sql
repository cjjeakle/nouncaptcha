SELECT t.token, s.response_id, s.country, count(*)
FROM game_log l 
INNER JOIN game_survey s 
ON l.uuid = s.uuid 
INNER JOIN game_tokens t 
ON t.uuid = l.uuid 
WHERE l.event = 'starting'
GROUP BY t.token, s.response_id 
ORDER BY s.time DESC;

/*
SELECT i.url, t.noun, t.count 
FROM images i 
INNER JOIN tags t 
ON i.img_id = t.img_id 
ORDER BY t.count DESC;
*/
