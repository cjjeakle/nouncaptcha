\echo 'turk users who specified how they found the survey'
SELECT count(*)
FROM cap_survey
WHERE how_found ilike '%turk%';

\echo 'user feedback'
SELECT count(*) count, avg(easier) easier, avg(faster) faster, avg(preferable) preferable
FROM cap_survey 
WHERE uuid NOT IN (
	SELECT uuid
	FROM prac_data 
	GROUP BY uuid
	HAVING avg(score) < -3
)
GROUP BY true;

\echo 'mobile user feedback'
SELECT count(*) count, avg(easier) easier, avg(faster) faster, avg(preferable) preferable
FROM cap_survey 
WHERE input ilike '%touch%' OR input ilike '%phone%' AND uuid NOT IN (
	SELECT uuid
	FROM prac_data 
	GROUP BY uuid
	HAVING avg(score) < -3
)
group by true;

\echo 'touch feedback breakdown'
SELECT easier, faster, preferable, prefer_check
FROM cap_survey 
WHERE input ilike '%touch%' OR input ilike '%phone%' AND uuid NOT IN (
	SELECT uuid
	FROM prac_data 
	GROUP BY uuid
	HAVING avg(score) < -3
);

\echo 'Pass and Fail rate for nouncaptcha, respectively'
SELECT count (*) FROM cap_survey 
WHERE cap_pass = true AND uuid NOT IN (
	SELECT uuid
	FROM prac_data 
	GROUP BY uuid
	HAVING avg(score) < -3
);
SELECT count (*) FROM cap_survey 
WHERE cap_pass = false AND uuid NOT IN (
	SELECT uuid
	FROM prac_data 
	GROUP BY uuid
	HAVING avg(score) < -3
);


\echo 'average captcha time'
select avg(cap_time) from cap_survey;

\echo 'average prompt score'
-- Scores -3 or less appeared to be very unusually bad users
-- All other users varied between -.8 and 1
SELECT trunc(avg(score_avg), 5) score_avg, trunc(min(score_avg), 5) score_min, trunc(max(score_avg), 5) score_max, 
trunc(avg(time_avg), 5) time_avg, trunc(min(time_avg), 5) time_min, trunc(max (time_avg), 5) time_max FROM (
	SELECT avg(score) score_avg, avg(time) time_avg
	FROM prac_data 
	GROUP BY uuid
	HAVING avg(score) > -3
) AS temp;

\echo 'count of successful captchas'
SELECT count (*) FROM (
	SELECT avg(score) score_avg
	FROM prac_data 
	GROUP BY uuid
	HAVING avg(score) > -3
) AS temp where score_avg >= (2/5);

\echo 'count of failed captchas'
SELECT count (*) FROM (
	SELECT avg(score) score_avg
	FROM prac_data 
	GROUP BY uuid
	HAVING avg(score) > -3
) AS temp where score_avg < (2/5);

\echo 'score distrib'
SELECT score, count(*)
FROM prac_data
WHERE uuid NOT IN (
	SELECT uuid
	FROM prac_data 
	GROUP BY uuid
	HAVING avg(score) < -3
)
GROUP BY score
ORDER BY score DESC;

\echo 'ave recap time'
SELECT avg(time)
FROM recap_data
WHERE uuid NOT IN (
	SELECT uuid
	FROM prac_data 
	GROUP BY uuid
	HAVING avg(score) < -3
);

select * from prac_data
WHERE uuid NOT IN (
	SELECT uuid
	FROM prac_data 
	GROUP BY uuid
	HAVING avg(score) < -3
) AND UUID IN (
	SELECT uuid
	FROM prac_data
	WHERE score < -1
)
order by uuid;

/*
\echo 'cap count from log'
select count (distinct l1.uuid) from cap_log l1
inner join cap_log l2 on l1.uuid = l2.uuid 
and l1.event = 'new CAPTCHA' 
and (l2.event = 'success' OR l2.event = 'failed');

\echo 'success count'
select count (distinct l1.uuid) from cap_log l1
inner join cap_log l2 on l1.uuid = l2.uuid 
and l1.event = 'new CAPTCHA' 
and (l2.event = 'success');

\echo 'failure count'
select count (distinct l1.uuid) from cap_log l1
inner join cap_log l2 on l1.uuid = l2.uuid 
and l1.event = 'new CAPTCHA' 
and (l2.event = 'failed');
*/

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