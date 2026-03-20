-- Reconcile stored cat stats from authoritative match history and
-- redefine live SQL helpers so runtime writes stay consistent.

WITH aggregated AS (
  SELECT
    c.id,
    COALESCE(w.win_count, 0) AS correct_wins,
    COALESCE(l.loss_count, 0) AS correct_losses,
    COALESCE(w.win_count, 0) + COALESCE(l.loss_count, 0) AS correct_battles_fought
  FROM public.cats c
  LEFT JOIN (
    SELECT winner_id AS cat_id, COUNT(*)::integer AS win_count
    FROM public.match_history
    WHERE winner_id IS NOT NULL
    GROUP BY winner_id
  ) w ON w.cat_id = c.id
  LEFT JOIN (
    SELECT loser_id AS cat_id, COUNT(*)::integer AS loss_count
    FROM public.match_history
    WHERE loser_id IS NOT NULL
    GROUP BY loser_id
  ) l ON l.cat_id = c.id
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

CREATE OR REPLACE FUNCTION public.bootstrap_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO profiles (id, username) VALUES (p_user_id, NULL) ON CONFLICT DO NOTHING;
  INSERT INTO user_progress (user_id, xp, level, sigils)
  VALUES (p_user_id, 0, 1, 20)
  ON CONFLICT (user_id) DO UPDATE
    SET sigils = COALESCE(user_progress.sigils, EXCLUDED.sigils);
  INSERT INTO streaks (user_id, current_streak, last_claim_date) VALUES (p_user_id, 0, NULL) ON CONFLICT DO NOTHING;
  INSERT INTO daily_rewards (user_id, last_claim_date, claimed_today) VALUES (p_user_id, NULL, FALSE) ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'xp', (SELECT xp FROM user_progress WHERE user_id = p_user_id),
    'level', (SELECT level FROM user_progress WHERE user_id = p_user_id),
    'sigils', (SELECT sigils FROM user_progress WHERE user_id = p_user_id),
    'streak', (SELECT current_streak FROM streaks WHERE user_id = p_user_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_pulse_atomic(
  p_pulse_id UUID,
  p_resolved_by TEXT,
  p_matchup_results JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r JSONB;
  v_scheduled_at TIMESTAMPTZ;
  v_next_scheduled_at TIMESTAMPTZ;
  v_now TIMESTAMPTZ := now();
  v_winner_id UUID;
  v_loser_id UUID;
  v_history_inserted BOOLEAN;
  v_match_count INT := COALESCE(jsonb_array_length(COALESCE(p_matchup_results, '[]'::jsonb)), 0);
BEGIN
  SELECT scheduled_at
    INTO v_scheduled_at
  FROM public.pulses
  WHERE id = p_pulse_id
  FOR UPDATE;

  IF v_scheduled_at IS NULL THEN
    RAISE EXCEPTION 'pulse_not_found: %', p_pulse_id;
  END IF;

  FOR r IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_matchup_results, '[]'::jsonb))
  LOOP
    v_winner_id := NULLIF(r->>'winner_id', '')::uuid;
    v_loser_id := NULLIF(r->>'loser_id', '')::uuid;

    v_history_inserted := FALSE;

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
      skill_a_id,
      skill_b_id,
      skill_a_triggered,
      skill_b_triggered,
      skills_cancelled,
      winner_id,
      loser_id,
      resolved_at
    ) VALUES (
      NULLIF(r->>'match_id', '')::uuid,
      NULLIF(r->>'tournament_id', '')::uuid,
      p_pulse_id,
      COALESCE(NULLIF(r->>'round', '')::int, 1),
      NULLIF(r->>'cat_a_id', '')::uuid,
      NULLIF(r->>'cat_b_id', '')::uuid,
      COALESCE(NULLIF(r->>'votes_a', '')::int, 0),
      COALESCE(NULLIF(r->>'votes_b', '')::int, 0),
      COALESCE(NULLIF(r->>'base_prob_a', '')::double precision, 0.5),
      COALESCE(NULLIF(r->>'skill_delta', '')::double precision, 0),
      COALESCE(NULLIF(r->>'final_prob_a', '')::double precision, 0.5),
      NULLIF(r->>'skill_a_id', '')::uuid,
      NULLIF(r->>'skill_b_id', '')::uuid,
      COALESCE(NULLIF(r->>'skill_a_triggered', '')::boolean, false),
      COALESCE(NULLIF(r->>'skill_b_triggered', '')::boolean, false),
      COALESCE(NULLIF(r->>'skills_cancelled', '')::boolean, false),
      v_winner_id,
      v_loser_id,
      v_now
    )
    ON CONFLICT (match_id) DO NOTHING
    RETURNING TRUE INTO v_history_inserted;

    UPDATE public.tournament_matches
      SET winner_id = v_winner_id,
          status = 'complete',
          resolved_at = v_now,
          resolution_source = p_resolved_by
    WHERE id = NULLIF(r->>'match_id', '')::uuid;

    IF v_history_inserted AND v_winner_id IS NOT NULL THEN
      UPDATE public.cats
        SET wins = COALESCE(wins, 0) + 1,
            battles_fought = COALESCE(battles_fought, 0) + 1
      WHERE id = v_winner_id;
    END IF;

    IF v_history_inserted AND v_loser_id IS NOT NULL THEN
      UPDATE public.cats
        SET losses = COALESCE(losses, 0) + 1,
            battles_fought = COALESCE(battles_fought, 0) + 1
      WHERE id = v_loser_id;
    END IF;
  END LOOP;

  UPDATE public.pulses
    SET status = 'resolved',
        resolved_at = v_now,
        resolved_by = p_resolved_by,
        matchup_count = v_match_count
  WHERE id = p_pulse_id;

  v_next_scheduled_at := date_trunc('week', v_scheduled_at AT TIME ZONE 'UTC') + interval '1 week';

  INSERT INTO public.pulses (scheduled_at, locked_at, status)
  VALUES (
    v_next_scheduled_at,
    v_next_scheduled_at - interval '2 hours',
    'pending'
  )
  ON CONFLICT (scheduled_at) DO NOTHING;
END;
$$;
