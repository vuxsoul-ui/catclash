DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pulses_scheduled_at_key'
      AND conrelid = 'public.pulses'::regclass
  ) THEN
    ALTER TABLE public.pulses
      ADD CONSTRAINT pulses_scheduled_at_key UNIQUE (scheduled_at);
  END IF;
END $$;

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
    ON CONFLICT (match_id) DO UPDATE
      SET tournament_id = EXCLUDED.tournament_id,
          pulse_id = EXCLUDED.pulse_id,
          round = EXCLUDED.round,
          cat_a_id = EXCLUDED.cat_a_id,
          cat_b_id = EXCLUDED.cat_b_id,
          votes_a = EXCLUDED.votes_a,
          votes_b = EXCLUDED.votes_b,
          base_prob_a = EXCLUDED.base_prob_a,
          skill_delta = EXCLUDED.skill_delta,
          final_prob_a = EXCLUDED.final_prob_a,
          skill_a_id = EXCLUDED.skill_a_id,
          skill_b_id = EXCLUDED.skill_b_id,
          skill_a_triggered = EXCLUDED.skill_a_triggered,
          skill_b_triggered = EXCLUDED.skill_b_triggered,
          skills_cancelled = EXCLUDED.skills_cancelled,
          winner_id = EXCLUDED.winner_id,
          loser_id = EXCLUDED.loser_id,
          resolved_at = EXCLUDED.resolved_at;

    UPDATE public.tournament_matches
      SET winner_id = v_winner_id,
          status = 'complete',
          resolved_at = v_now,
          resolution_source = p_resolved_by
    WHERE id = NULLIF(r->>'match_id', '')::uuid;

    IF v_winner_id IS NOT NULL THEN
      UPDATE public.cats
        SET wins = COALESCE(wins, 0) + 1
      WHERE id = v_winner_id;
    END IF;

    IF v_loser_id IS NOT NULL THEN
      UPDATE public.cats
        SET losses = COALESCE(losses, 0) + 1
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
