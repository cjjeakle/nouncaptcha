\echo 'user feedback'
SELECT count(*) count, avg(easier) easier, avg(faster) faster, avg(preferable) preferable
FROM cap_survey 
WHERE uuid != '25f0f904-53a9-455d-bcec-b295a939340a' 
AND uuid != 'c967029f-ee23-447a-a3d6-30448629d496'
GROUP BY true;

\echo 'passed captcha count'
select count(*) from cap_survey where cap_pass = TRUE
AND uuid != '25f0f904-53a9-455d-bcec-b295a939340a' 
AND uuid != 'c967029f-ee23-447a-a3d6-30448629d496';
\echo 'failed captcha count'
select count(*) from cap_survey where cap_pass != TRUE
AND uuid != '25f0f904-53a9-455d-bcec-b295a939340a' 
AND uuid != 'c967029f-ee23-447a-a3d6-30448629d496';

\echo 'average prompt score'
SELECT avg(score) 
FROM prac_data 
WHERE uuid != '25f0f904-53a9-455d-bcec-b295a939340a' 
AND uuid != 'c967029f-ee23-447a-a3d6-30448629d496';

\echo 'score distrib'
SELECT score, count(*)
FROM prac_data
WHERE uuid != '25f0f904-53a9-455d-bcec-b295a939340a' 
AND uuid != 'c967029f-ee23-447a-a3d6-30448629d496'
GROUP BY score
ORDER BY score DESC;

/*
-- Excluded users never formally disconnected due to error
-- Appears to be due to Heroku Dyno idleing during their game
\echo 'List of connected UUIDs'
SELECT l1.log_id, l1.uuid FROM game_log l1 
LEFT JOIN game_log l2
ON l1.uuid = l2.uuid AND l2.event like '%disconnect%'
WHERE l1.event = 'new game' AND l2.event IS NULL
AND l1.log_id != 356 AND l1.log_id != 1233 
AND l1.log_id != 1219 AND l1.log_id != 1544 
AND l1.log_id != 1667 AND l1.log_id != 2130
AND l1.log_id != 2140
ORDER BY l1.log_id DESC;

\echo 'List of most recent 5 survey responses, their token and image count'
SELECT s.time, s.how_found, count(*)
FROM game_log l 
INNER JOIN game_survey s 
ON l.uuid = s.uuid 
INNER JOIN game_tokens t
on t.uuid = s.uuid
WHERE l.event = 'starting'
GROUP BY s.response_id, t.token 
ORDER BY s.time DESC
LIMIT 5;

\echo 'Number of survey responses'
SELECT count(*) - 1 AS count FROM game_survey;

\echo 'Number of games that were not played for survey'
select count(temp.*)  from (
	select 1 from game_log l 
	left join game_survey s on l.uuid = s.uuid 
	where l.event = 'match' or l.event = 'seed guesses generated' 
	group by l.uuid, s.response_id 
	having s.response_id is null
) as temp;

\echo 'Total count of games played'
select count(distinct uuid) from game_log
where event = 'match' or event = 'seed guesses generated';
*/

/*
\echo 'Users who did not play the game'
select * from (
	select s1.response_id, s1.uuid, s1.how_found from game_survey s1
	except
	select distinct s.response_id, s.uuid, s.how_found from game_survey s 
	inner join game_log l on l.uuid = s.uuid 
	where l.event = 'match' or l.event = 'seed guesses generated'
) as temp order by temp.response_id;
*/

/*
\echo 'List of taboo tags and their corresponding image'
SELECT i.url, t.noun, t.count 
FROM images i 
INNER JOIN tags t 
ON i.img_id = t.img_id 
WHERE t.count >= 5
ORDER BY t.img_id DESC;
*/

/*
\echo 'top 5 taboo tag cardinalities'
SELECT i.img_id, count(*) FROM tags t
INNER JOIN images i
ON t.img_id = i.img_id
WHERE t.count >= 5
GROUP BY i.img_id
ORDER by count(*) DESC limit 5;


\echo 'Number of images with taboo tags'
SELECT count(DISTINCT img_id) FROM tags
WHERE count >= 5;

\echo 'Total number of tags'
SELECT count(*) from tags;
*/