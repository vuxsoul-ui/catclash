DROP FUNCTION IF EXISTS public.check_streak(UUID);
DROP FUNCTION IF EXISTS public.checkin_and_update_streak(UUID);

CREATE OR REPLACE FUNCTION check_streak(p_user_id UUID)
RETURNS TABLE (
  current_streak INT,
  can_claim BOOLEAN,
  streak_broken BOOLEAN
) AS $$
DECLARE
  v_last_claim DATE;
  v_current_streak INT;
  v_today DATE := CURRENT_DATE;
  v_yesterday DATE := CURRENT_DATE - INTERVAL '1 day';
BEGIN
  SELECT last_claim_date, s.current_streak
    INTO v_last_claim, v_current_streak
  FROM streaks s
  WHERE s.user_id = p_user_id;

  IF v_last_claim IS NULL OR v_last_claim < v_yesterday THEN
    RETURN QUERY SELECT 0, TRUE, TRUE;
  ELSIF v_last_claim = v_today THEN
    RETURN QUERY SELECT v_current_streak, FALSE, FALSE;
  ELSE
    RETURN QUERY SELECT v_current_streak, TRUE, FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION checkin_and_update_streak(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE := utc_today();
  v_yesterday DATE := utc_today() - INTERVAL '1 day';
  v_last DATE;
  v_streak INT;
BEGIN
  SELECT last_claim_date, s.current_streak INTO v_last, v_streak
  FROM streaks s
  WHERE s.user_id = p_user_id;

  IF v_last IS NULL THEN
    INSERT INTO streaks (user_id, current_streak, last_claim_date)
    VALUES (p_user_id, 1, v_today)
    ON CONFLICT (user_id) DO UPDATE
      SET current_streak = EXCLUDED.current_streak,
          last_claim_date = EXCLUDED.last_claim_date;

    RETURN jsonb_build_object('current_streak', 1, 'already_checked_in', false);
  END IF;

  IF v_last = v_today THEN
    RETURN jsonb_build_object('current_streak', v_streak, 'already_checked_in', true);
  END IF;

  UPDATE streaks
    SET current_streak = CASE WHEN v_last = v_yesterday THEN v_streak + 1 ELSE 1 END,
        last_claim_date = v_today
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'current_streak',
    CASE WHEN v_last = v_yesterday THEN v_streak + 1 ELSE 1 END,
    'already_checked_in',
    false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_prediction_resolution(
  p_prediction_id UUID,
  p_won BOOLEAN,
  p_payout INTEGER
)
RETURNS TABLE(
  applied BOOLEAN,
  current_streak INTEGER,
  best_streak INTEGER,
  bonus_rolls INTEGER,
  bonus_roll_awarded BOOLEAN
) AS $$
DECLARE
  v_user UUID;
  v_resolved BOOLEAN;
  v_next_streak INTEGER;
  v_bonus_awarded BOOLEAN := FALSE;
BEGIN
  SELECT voter_user_id, resolved
    INTO v_user, v_resolved
  FROM match_predictions
  WHERE id = p_prediction_id
  FOR UPDATE;

  IF v_user IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 0, 0, FALSE;
    RETURN;
  END IF;

  PERFORM ensure_user_prediction_stats(v_user);

  IF v_resolved THEN
    RETURN QUERY
    SELECT FALSE, ups.current_streak, ups.best_streak, ups.bonus_rolls, FALSE
    FROM user_prediction_stats ups
    WHERE ups.user_id = v_user;
    RETURN;
  END IF;

  IF p_won THEN
    UPDATE user_prediction_stats ups
    SET current_streak = ups.current_streak + 1,
        best_streak = GREATEST(ups.best_streak, ups.current_streak + 1),
        updated_at = now()
    WHERE ups.user_id = v_user
    RETURNING ups.current_streak INTO v_next_streak;

    IF v_next_streak IN (3, 5, 8) THEN
      UPDATE user_prediction_stats
      SET bonus_rolls = bonus_rolls + 1,
          updated_at = now()
      WHERE user_id = v_user;
      v_bonus_awarded := TRUE;
    END IF;
  ELSE
    UPDATE user_prediction_stats
    SET current_streak = 0,
        updated_at = now()
    WHERE user_id = v_user;
  END IF;

  UPDATE match_predictions
  SET resolved = TRUE,
      won = p_won,
      payout_sigils = GREATEST(0, COALESCE(p_payout, 0))
  WHERE id = p_prediction_id;

  IF p_won AND COALESCE(p_payout, 0) > 0 THEN
    UPDATE user_progress
    SET sigils = COALESCE(sigils, 0) + GREATEST(0, p_payout)
    WHERE user_id = v_user;
  END IF;

  RETURN QUERY
  SELECT TRUE, ups.current_streak, ups.best_streak, ups.bonus_rolls, v_bonus_awarded
  FROM user_prediction_stats ups
  WHERE ups.user_id = v_user;
END;
$$ LANGUAGE plpgsql;
