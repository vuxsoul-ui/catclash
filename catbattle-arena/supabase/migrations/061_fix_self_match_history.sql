-- Remove impossible self-match battle history rows, normalize any lingering
-- bye containers in tournament_matches, and reconcile approved cat stats from
-- the cleaned ledger.

-- Self-matches are tournament byes, not real battles.
DELETE FROM public.match_history
WHERE winner_id = loser_id
   OR cat_a_id = cat_b_id;

-- Convert any unresolved self-match tournament rows into completed byes so
-- they no longer re-enter the battle resolution path.
UPDATE public.tournament_matches
SET
  status = 'complete',
  winner_id = cat_a_id,
  resolved_at = COALESCE(resolved_at, now()),
  resolution_source = COALESCE(NULLIF(resolution_source, ''), 'bye_auto_advance')
WHERE cat_a_id = cat_b_id
  AND status IN ('active', 'pending', 'locked', 'in_progress');

WITH aggregated AS (
  SELECT
    c.id,
    COALESCE(w.win_count, 0) AS correct_wins,
    COALESCE(l.loss_count, 0) AS correct_losses,
    COALESCE(t.total_count, 0) AS correct_battles_fought
  FROM public.cats c
  LEFT JOIN (
    SELECT winner_id AS cat_id, COUNT(*)::integer AS win_count
    FROM public.match_history
    WHERE winner_id IS NOT NULL
      AND (loser_id IS NULL OR winner_id <> loser_id)
    GROUP BY winner_id
  ) w ON w.cat_id = c.id
  LEFT JOIN (
    SELECT loser_id AS cat_id, COUNT(*)::integer AS loss_count
    FROM public.match_history
    WHERE loser_id IS NOT NULL
      AND (winner_id IS NULL OR winner_id <> loser_id)
    GROUP BY loser_id
  ) l ON l.cat_id = c.id
  LEFT JOIN (
    SELECT cat_id, COUNT(*)::integer AS total_count
    FROM (
      SELECT winner_id AS cat_id, match_id
      FROM public.match_history
      WHERE winner_id IS NOT NULL
      UNION
      SELECT loser_id AS cat_id, match_id
      FROM public.match_history
      WHERE loser_id IS NOT NULL
    ) deduped
    GROUP BY cat_id
  ) t ON t.cat_id = c.id
  WHERE c.status = 'approved'
)
UPDATE public.cats AS c
SET
  wins = aggregated.correct_wins,
  losses = aggregated.correct_losses,
  battles_fought = aggregated.correct_battles_fought
FROM aggregated
WHERE c.id = aggregated.id
  AND (
    COALESCE(c.wins, 0) <> aggregated.correct_wins
    OR COALESCE(c.losses, 0) <> aggregated.correct_losses
    OR COALESCE(c.battles_fought, 0) <> aggregated.correct_battles_fought
  );
