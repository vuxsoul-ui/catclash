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
  v_progress_reward_column TEXT;
  v_bonus_awarded BOOLEAN := FALSE;
BEGIN
  SELECT voter_user_id, resolved
    INTO v_user, v_resolved
  FROM match_predictions
  WHERE id = p_prediction_id;

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
      UPDATE user_prediction_stats ups
      SET bonus_rolls = ups.bonus_rolls + 1,
          updated_at = now()
      WHERE ups.user_id = v_user;
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
    SELECT c.column_name
      INTO v_progress_reward_column
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'user_progress'
        AND c.column_name = 'sigils'
      LIMIT 1;

    IF v_progress_reward_column IS NOT NULL THEN
      EXECUTE format(
        'UPDATE user_progress
         SET %I = COALESCE(%I, 0) + $1
         WHERE user_id = $2::uuid',
        v_progress_reward_column,
        v_progress_reward_column
      )
      USING GREATEST(0, p_payout), v_user;
    END IF;
  END IF;

  RETURN QUERY
  SELECT TRUE, ups.current_streak, ups.best_streak, ups.bonus_rolls, v_bonus_awarded
  FROM user_prediction_stats ups
  WHERE ups.user_id = v_user;
END;
$$ LANGUAGE plpgsql;
