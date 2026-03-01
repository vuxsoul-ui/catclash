-- Prediction streak + starter adoption support

CREATE TABLE IF NOT EXISTS user_prediction_stats (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  bonus_rolls INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS starter_adoptions (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  cat_id UUID REFERENCES cats(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cats
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'submitted';

ALTER TABLE cats
  ADD COLUMN IF NOT EXISTS prestige_weight NUMERIC NOT NULL DEFAULT 1.0;

CREATE INDEX IF NOT EXISTS idx_cats_origin ON cats(origin);
CREATE INDEX IF NOT EXISTS idx_cats_prestige_weight ON cats(prestige_weight);

CREATE OR REPLACE FUNCTION ensure_user_prediction_stats(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_prediction_stats (user_id, current_streak, best_streak, bonus_rolls)
  VALUES (p_user_id, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prediction_streak_bonus_pct(p_current_streak INTEGER)
RETURNS INTEGER AS $$
BEGIN
  IF p_current_streak >= 7 THEN
    RETURN 15;
  ELSIF p_current_streak >= 4 THEN
    RETURN 10;
  ELSIF p_current_streak >= 2 THEN
    RETURN 5;
  END IF;
  RETURN 0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION apply_prediction_resolution(
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
    UPDATE user_prediction_stats
    SET current_streak = current_streak + 1,
        best_streak = GREATEST(best_streak, current_streak + 1),
        updated_at = now()
    WHERE user_id = v_user
    RETURNING current_streak INTO v_next_streak;

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
