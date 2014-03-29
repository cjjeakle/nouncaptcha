select t.token, s.country, count(*)
from game_log l 
inner join game_survey s 
on l.uuid = s.uuid 
inner join game_tokens t 
on t.uuid = l.uuid 
where l.event = 'match' OR l.event = 'seed guesses generated'
group by t.token, s.response_id 
order by s.time;
