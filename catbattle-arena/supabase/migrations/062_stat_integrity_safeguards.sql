-- Harden stat integrity after the launch reset.
-- These safeguards prevent self-matches, support idempotent match recording,
-- and provide a reusable verification function for admin diagnostics.

DELETE FROM public.match_history
WHERE winner_id = loser_id
   OR cat_a_id = cat_b_id;

UPDATE public.tournament_matches
SET
  cat_b_id = NULL,
  status = 'complete',
  winner_id = COALESCE(winner_id, cat_a_id),
  resolved_at = COALESCE(resolved_at, NOW()),
  resolution_source = COALESCE(NULLIF(resolution_source, ''), 'bye_auto_advance')
WHERE cat_a_id = cat_b_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'no_self_matches'
      AND conrelid = 'public.match_history'::regclass
  ) THEN
    ALTER TABLE public.match_history
      ADD CONSTRAINT no_self_matches
      CHECK (winner_id IS DISTINCT FROM loser_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'no_self_tournament_matches'
      AND conrelid = 'public.tournament_matches'::regclass
  ) THEN
    ALTER TABLE public.tournament_matches
      ADD CONSTRAINT no_self_tournament_matches
      CHECK (cat_b_id IS NULL OR cat_a_id IS DISTINCT FROM cat_b_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'no_self_duel_challenges'
      AND conrelid = 'public.duel_challenges'::regclass
  ) THEN
    ALTER TABLE public.duel_challenges
      ADD CONSTRAINT no_self_duel_challenges
      CHECK (challenged_cat_id IS NULL OR challenger_cat_id IS DISTINCT FROM challenged_cat_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.record_match_result(
  p_match_id UUID,
  p_tournament_id UUID,
  p_pulse_id UUID,
  p_round INTEGER,
  p_cat_a_id UUID,
  p_cat_b_id UUID,
  p_winner_uuid UUID,
  p_loser_uuid UUID,
  p_votes_a INTEGER DEFAULT 0,
  p_votes_b INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted_match_id UUID;
BEGIN
  IF p_match_id IS NULL THEN
    RAISE EXCEPTION 'match_id is required';
  END IF;
  IF p_cat_a_id IS NULL OR p_cat_b_id IS NULL THEN
    RAISE EXCEPTION 'cat_a_id and cat_b_id are required';
  END IF;
  IF p_cat_a_id = p_cat_b_id THEN
    RAISE EXCEPTION 'Self-matches are not allowed';
  END IF;
  IF p_winner_uuid IS NULL OR p_loser_uuid IS NULL THEN
    RAISE EXCEPTION 'winner_uuid and loser_uuid are required';
  END IF;
  IF p_winner_uuid = p_loser_uuid THEN
    RAISE EXCEPTION 'Winner and loser cannot be the same cat';
  END IF;
  IF p_winner_uuid NOT IN (p_cat_a_id, p_cat_b_id) OR p_loser_uuid NOT IN (p_cat_a_id, p_cat_b_id) THEN
    RAISE EXCEPTION 'Winner and loser must belong to the provided match pair';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.cats WHERE id = p_winner_uuid AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Winner cat does not exist or is not approved';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.cats WHERE id = p_loser_uuid AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Loser cat does not exist or is not approved';
  END IF;

  INSERT INTO public.match_history (
    match_id,
    tournament_id,
    pulse_id,
    round,
    cat_a_id,
    cat_b_id,
    votes_a,
    votes_b,
    base_prob_a,
    skill_delta,
    final_prob_a,
    skill_a_triggered,
    skill_b_triggered,
    skills_cancelled,
    winner_id,
    loser_id,
    resolved_at
  ) VALUES (
    p_match_id,
    p_tournament_id,
    p_pulse_id,
    p_round,
    p_cat_a_id,
    p_cat_b_id,
    GREATEST(0, COALESCE(p_votes_a, 0)),
    GREATEST(0, COALESCE(p_votes_b, 0)),
    0.5,
    0,
    0.5,
    false,
    false,
    false,
    p_winner_uuid,
    p_loser_uuid,
    NOW()
  )
  ON CONFLICT (match_id) DO NOTHING
  RETURNING match_id INTO v_inserted_match_id;

  IF v_inserted_match_id IS NULL THEN
    RETURN jsonb_build_object('recorded', false, 'reason', 'already_recorded', 'match_id', p_match_id);
  END IF;

  UPDATE public.cats
  SET wins = COALESCE(wins, 0) + 1,
      battles_fought = COALESCE(battles_fought, 0) + 1
  WHERE id = p_winner_uuid;

  UPDATE public.cats
  SET losses = COALESCE(losses, 0) + 1,
      battles_fought = COALESCE(battles_fought, 0) + 1
  WHERE id = p_loser_uuid;

  RETURN jsonb_build_object('recorded', true, 'match_id', p_match_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_cat_stats()
RETURNS TABLE (
  cat_id UUID,
  cat_name TEXT,
  stored_wins BIGINT,
  actual_wins BIGINT,
  stored_losses BIGINT,
  actual_losses BIGINT,
  stored_battles BIGINT,
  actual_battles BIGINT,
  status TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id AS cat_id,
    c.name AS cat_name,
    COALESCE(c.wins, 0)::bigint AS stored_wins,
    COALESCE(w.actual_wins, 0)::bigint AS actual_wins,
    COALESCE(c.losses, 0)::bigint AS stored_losses,
    COALESCE(l.actual_losses, 0)::bigint AS actual_losses,
    COALESCE(c.battles_fought, 0)::bigint AS stored_battles,
    COALESCE(t.actual_battles, 0)::bigint AS actual_battles,
    CASE
      WHEN COALESCE(c.wins, 0) = COALESCE(w.actual_wins, 0)
       AND COALESCE(c.losses, 0) = COALESCE(l.actual_losses, 0)
       AND COALESCE(c.battles_fought, 0) = COALESCE(t.actual_battles, 0)
      THEN 'OK'
      ELSE 'MISMATCH'
    END AS status
  FROM public.cats c
  LEFT JOIN (
    SELECT winner_id AS cat_id, COUNT(*) AS actual_wins
    FROM public.match_history
    WHERE winner_id IS NOT NULL
    GROUP BY winner_id
  ) w ON w.cat_id = c.id
  LEFT JOIN (
    SELECT loser_id AS cat_id, COUNT(*) AS actual_losses
    FROM public.match_history
    WHERE loser_id IS NOT NULL
    GROUP BY loser_id
  ) l ON l.cat_id = c.id
  LEFT JOIN (
    SELECT cat_id, COUNT(*) AS actual_battles
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
  ORDER BY c.name;
$$;
