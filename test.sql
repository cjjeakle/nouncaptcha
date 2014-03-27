\echo '\nNumber of multiplayer games w/ >= 5 matches'
SELECT count(*) FROM (
	SELECT 1 FROM game_log l1 
	INNER JOIN game_log l2 
	ON l1.game_id = l2.game_id
	WHERE l1.event = 'starting' AND l1.uuid2 IS NOT NULL AND l2.event = 'match'
	GROUP BY l1.game_id
	HAVING count(*) > 4
) as temp;

\echo '\nNumber of multiplayer games w/ any matches'
SELECT count(*) FROM (
	SELECT 1 FROM game_log l1 
	INNER JOIN game_log l2 
	ON l1.game_id = l2.game_id
	WHERE l1.event = 'starting' AND l1.uuid2 IS NOT NULL AND l2.event = 'match'
	GROUP BY l1.game_id
) as temp;

\echo '\nCount of all multiplayer games started'
SELECT count(*) FROM game_log WHERE event = 'starting' AND uuid2 IS NOT NULL;

\echo '\nTotal number of multi-player players w/ any matches who took the survey:'
SELECT count(*) FROM (
	SELECT 1 FROM game_log l1 
	INNER JOIN game_log l2 
	ON l1.game_id = l2.game_id
	INNER JOIN game_survey s
	ON s.uuid = l1.uuid1 OR s.uuid = l1.uuid2
	WHERE l1.event = 'starting' AND l2.event = 'match' AND l1.uuid2 IS NOT NULL
	GROUP BY s.uuid
) AS temp;


\echo '\n--------------------------------------------------------------------\n'


\echo '\nTotal number of games w/ >= 5 matches'
SELECT count(*) FROM (
	SELECT 1 FROM game_log l1 
	INNER JOIN game_log l2 
	ON l1.game_id = l2.game_id
	WHERE l1.event = 'starting' AND l2.event = 'match'
	GROUP BY l1.game_id
	HAVING count(*) > 4
) AS temp;

\echo '\nTotal number of games w/ any matches'
SELECT count(*) FROM (
	SELECT 1 FROM game_log l1 
	INNER JOIN game_log l2 
	ON l1.game_id = l2.game_id
	WHERE l1.event = 'starting' AND l2.event = 'match'
	GROUP BY l1.game_id
) AS temp;

\echo '\nTotal number of games started'
SELECT count(*) FROM game_log WHERE event = 'starting';

\echo '\nTotal number of players w/ any matches who took the survey'
SELECT count(*) FROM (
	SELECT DISTINCT s.uuid FROM game_log l1 
	INNER JOIN game_log l2 
	ON l1.game_id = l2.game_id
	INNER JOIN game_survey s
	ON s.uuid = l1.uuid1 OR s.uuid = l1.uuid2
	WHERE l1.event = 'starting' AND l2.event = 'match'
	GROUP BY s.uuid
) AS temp;


\echo '\n--------------------------------------------------------------------\n'


\echo '\nTotal number of survey responses'
SELECT count(*) FROM game_survey;

\echo '\n--------------------------------------------------------------------\n'

\echo '\nCount of images w/ >5 count for at least one tag'
SELECT count(DISTINCT img_id) from tags WHERE count >= 5;

\echo '\ncount of images'
SELECT count(*) from images;

\echo '\ncount of tags unrelated to a given image w/ >1 occurance'
SELECT i.img_id, count(DISTINCT t.noun) from images i, tags t
WHERE t.count > 1 AND NOT EXISTS (
	SELECT 1 FROM tags t2 WHERE t2.noun = t.noun AND t2.img_id = i.img_id
)
GROUP BY (i.img_id)
ORDER BY i.img_id;

\echo '\ncount of tags'
SELECT count(*) from tags;

\echo '\ncount of distinct nouns in tags'
SELECT count(DISTINCT noun) FROM tags;

\echo '\ncount of each noun\' occurance'
SELECT noun, count(*) FROM tags GROUP BY noun ORDER BY count(*) DESC;

--SELECT * from tags ORDER BY img_id, count DESC;