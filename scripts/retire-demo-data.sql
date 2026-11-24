-- Retires the original demo fixtures (owned by the 'system' user) before launch.
-- Only exact fixture ids owned by 'system' are removed; real user content is untouched.
-- Idempotent. Take a `wrangler d1 export` backup before running remotely.

DELETE FROM arena_votes WHERE matchup_id IN (
  SELECT id FROM arena_matchups
  WHERE id IN ('am-1','am-2','am-3','am-4','am-5','am-6')
    AND hypothesis_a_id IN (SELECT id FROM hypotheses WHERE submitted_by = 'system')
);

DELETE FROM arena_matchups
WHERE id IN ('am-1','am-2','am-3','am-4','am-5','am-6')
  AND hypothesis_a_id IN (SELECT id FROM hypotheses WHERE submitted_by = 'system');

DELETE FROM experiment_results WHERE experiment_id IN (
  SELECT id FROM experiments WHERE submitted_by = 'system' AND id GLOB 'exp-[0-9]*'
);

DELETE FROM experiment_versions WHERE experiment_id IN (
  SELECT id FROM experiments WHERE submitted_by = 'system' AND id GLOB 'exp-[0-9]*'
);

DELETE FROM experiments WHERE submitted_by = 'system' AND id GLOB 'exp-[0-9]*';

DELETE FROM comments WHERE user_id = 'system' AND id GLOB 'c-[0-9]*';

DELETE FROM stars WHERE hypothesis_id IN (
  SELECT id FROM hypotheses WHERE submitted_by = 'system' AND id GLOB 'h-[0-9]*'
);

DELETE FROM hypotheses WHERE submitted_by = 'system' AND id GLOB 'h-[0-9]*'
  AND NOT EXISTS (SELECT 1 FROM comments WHERE comments.hypothesis_id = hypotheses.id)
  AND NOT EXISTS (SELECT 1 FROM experiments WHERE experiments.hypothesis_id = hypotheses.id)
  AND NOT EXISTS (
    SELECT 1 FROM arena_matchups
    WHERE arena_matchups.hypothesis_a_id = hypotheses.id OR arena_matchups.hypothesis_b_id = hypotheses.id
  );

UPDATE problem_statements SET hypothesis_count = (
  SELECT count(*) FROM hypotheses WHERE hypotheses.problem_statement = problem_statements.question
);
