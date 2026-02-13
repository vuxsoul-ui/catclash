-- 003_complete_rpc.sql
-- Final RPC functions for CatBattle Arena

-- Helper: Get UTC date
CREATE OR REPLACE FUNCTION utc_today()
RETURNS DATE AS $$
BEGIN
  RETURN (NOW() AT TIME ZONE 'UTC')::DATE;
END;
$$ LANGUAGE plpgsql;

-- Bootstrap new user (creates all rows with defaults: XP=0, streak=0)
CREATE OR REPLACE FUNCTION bootstrap_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO profiles (id, username) VALUES (p_user_id, NULL) ON CONFLICT DO NOTHING;
  INSERT INTO user_progress (user_id, xp, level) VALUES (p_user_id, 0, 1) ON CONFLICT DO NOTHING;
  INSERT INTO streaks (user_id, current_streak, last_claim_date) VALUES (p_user_id, 0, NULL) ON CONFLICT DO NOTHING;
  INSERT INTO daily_rewards (user_id, last_claim_date, claimed_today) VALUES (p_user_id, NULL, FALSE) ON CONFLICT DO NOTHING;
  
  RETURN jsonb_build_object(
    'xp', (SELECT xp FROM user_progress WHERE user_id = p_user_id),
    'level', (SELECT level FROM user_progress WHERE user_id = p_user_id),
    'streak', (SELECT current_streak FROM streaks WHERE user_id = p_user_id)
  );
END;
$$;

-- Checkin and update streak
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
  SELECT last_claim_date, current_streak INTO v_last, v_streak FROM streaks WHERE user_id = p_user_id;
  
  IF v_last IS NULL THEN
    INSERT INTO streaks (user_id, current_streak, last_claim_date) VALUES (p_user_id, 1, v_today)
    ON CONFLICT DO UPDATE SET current_streak=1, last_claim_date=v_today;
    RETURN jsonb_build_object('current_streak', 1, 'already_checked_in', false);
  END IF;
  
  IF v_last = v_today THEN
    RETURN jsonb_build_object('current_streak', v_streak, 'already_checked_in', true);
  END IF;
  
  UPDATE streaks SET current_streak = CASE WHEN v_last = v_yesterday THEN v_streak + 1 ELSE 1 END, 
                     last_claim_date = v_today WHERE user_id = p_user_id;
  
  RETURN jsonb_build_object('current_streak', CASE WHEN v_last = v_yesterday THEN v_streak + 1 ELSE 1 END, 
                            'already_checked_in', false);
END;
$$;

-- Claim daily crate
CREATE OR REPLACE FUNCTION claim_daily_crate(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE := utc_today();
  v_last DATE;
  v_xp INT;
BEGIN
  SELECT last_claim_date INTO v_last FROM daily_rewards WHERE user_id = p_user_id;
  
  IF v_last = v_today THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_claimed');
  END IF;
  
  v_xp := 50 + (EXTRACT(DAY FROM v_today)::INT % 50);
  
  UPDATE daily_rewards SET last_claim_date = v_today, claimed_today = TRUE WHERE user_id = p_user_id;
  UPDATE user_progress SET xp = xp + v_xp WHERE user_id = p_user_id;
  
  RETURN jsonb_build_object('success', true, 'xp_awarded', v_xp);
END;
$$;

-- Get user state
CREATE OR REPLACE FUNCTION get_user_state(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'profile', jsonb_build_object('id', p.id, 'username', p.username),
      'progress', jsonb_build_object('xp', COALESCE(up.xp, 0), 'level', COALESCE(up.level, 1)),
      'streak', jsonb_build_object('current_streak', COALESCE(s.current_streak, 0), 'last_claim_date', s.last_claim_date),
      'daily', jsonb_build_object('last_claim_date', dr.last_claim_date, 'claimed_today', COALESCE(dr.claimed_today, false))
    )
    FROM profiles p
    LEFT JOIN user_progress up ON up.user_id = p.id
    LEFT JOIN streaks s ON s.user_id = p.id
    LEFT JOIN daily_rewards dr ON dr.user_id = p.id
    WHERE p.id = p_user_id
  );
END;
$$;
