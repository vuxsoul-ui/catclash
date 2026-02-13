-- Function: Initialize new user
CREATE OR REPLACE FUNCTION initialize_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile
  INSERT INTO profiles (id, username) VALUES (NEW.id, NEW.email);
  
  -- Initialize progress (0 XP, Level 1)
  INSERT INTO user_progress (user_id, xp, level) VALUES (NEW.id, 0, 1);
  
  -- Initialize streak (0 days)
  INSERT INTO streaks (user_id, current_streak, last_claim_date) 
  VALUES (NEW.id, 0, NULL);
  
  -- Initialize daily rewards
  INSERT INTO daily_rewards (user_id, last_claim_date, claimed_today) 
  VALUES (NEW.id, NULL, FALSE);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION initialize_new_user();

-- Function: Check and update streak
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
  SELECT last_claim_date, current_streak 
  INTO v_last_claim, v_current_streak
  FROM streaks 
  WHERE user_id = p_user_id;
  
  -- Streak broken if last claim was before yesterday
  IF v_last_claim IS NULL OR v_last_claim < v_yesterday THEN
    RETURN QUERY SELECT 0, TRUE, TRUE;
  -- Already claimed today
  ELSIF v_last_claim = v_today THEN
    RETURN QUERY SELECT v_current_streak, FALSE, FALSE;
  -- Can claim (claimed yesterday)
  ELSE
    RETURN QUERY SELECT v_current_streak, TRUE, FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function: Claim daily streak
CREATE OR REPLACE FUNCTION claim_daily_streak(p_user_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  new_streak INT,
  xp_earned INT
) AS $$
DECLARE
  v_check RECORD;
  v_new_streak INT;
  v_xp INT;
BEGIN
  SELECT * INTO v_check FROM check_streak(p_user_id);
  
  IF NOT v_check.can_claim THEN
    RETURN QUERY SELECT FALSE, v_check.current_streak, 0;
    RETURN;
  END IF;
  
  -- Calculate XP based on streak
  v_xp := CASE 
    WHEN v_check.streak_broken THEN 10
    WHEN v_check.current_streak % 7 = 6 THEN 100  -- Day 7 bonus
    WHEN v_check.current_streak % 7 = 2 THEN 25   -- Day 3 bonus
    ELSE 10 + (v_check.current_streak % 7) * 2
  END;
  
  v_new_streak := CASE 
    WHEN v_check.streak_broken THEN 1
    ELSE v_check.current_streak + 1
  END;
  
  -- Update streak
  UPDATE streaks 
  SET current_streak = v_new_streak,
      last_claim_date = CURRENT_DATE
  WHERE user_id = p_user_id;
  
  -- Add XP
  UPDATE user_progress 
  SET xp = xp + v_xp 
  WHERE user_id = p_user_id;
  
  RETURN QUERY SELECT TRUE, v_new_streak, v_xp;
END;
$$ LANGUAGE plpgsql;

-- Function: Check rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_max_count INT DEFAULT 100,
  p_window_minutes INT DEFAULT 60
)
RETURNS BOOLEAN AS $$
DECLARE
  v_record RECORD;
  v_window_start TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_record FROM rate_limits WHERE key = p_key;
  
  v_window_start := NOW() - INTERVAL '1 minute' * p_window_minutes;
  
  IF v_record IS NULL OR v_record.window_start < v_window_start THEN
    -- New window
    INSERT INTO rate_limits (key, count, window_start) 
    VALUES (p_key, 1, NOW())
    ON CONFLICT (key) DO UPDATE 
    SET count = 1, window_start = NOW();
    RETURN TRUE;
  ELSIF v_record.count >= p_max_count THEN
    -- Rate limited
    RETURN FALSE;
  ELSE
    -- Increment count
    UPDATE rate_limits 
    SET count = count + 1 
    WHERE key = p_key;
    RETURN TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function: Cast vote with validation
CREATE OR REPLACE FUNCTION cast_vote(
  p_battle_id UUID,
  p_user_id UUID,
  p_ip_hash TEXT,
  p_voted_for UUID
)
RETURNS TABLE (
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_rate_key TEXT;
  v_already_voted BOOLEAN;
BEGIN
  -- Rate limit check: 10 votes per minute per IP
  v_rate_key := 'vote:' || COALESCE(p_ip_hash, p_user_id::TEXT);
  IF NOT check_rate_limit(v_rate_key, 10, 1) THEN
    RETURN QUERY SELECT FALSE, 'Rate limit exceeded'::TEXT;
    RETURN;
  END IF;
  
  -- Check if already voted in this battle
  SELECT EXISTS(
    SELECT 1 FROM votes 
    WHERE battle_id = p_battle_id 
    AND (voter_user_id = p_user_id OR ip_hash = p_ip_hash)
  ) INTO v_already_voted;
  
  IF v_already_voted THEN
    RETURN QUERY SELECT FALSE, 'Already voted in this battle'::TEXT;
    RETURN;
  END IF;
  
  -- Record vote
  INSERT INTO votes (battle_id, voter_user_id, ip_hash, voted_for)
  VALUES (p_battle_id, p_user_id, p_ip_hash, p_voted_for);
  
  -- Award XP for voting
  UPDATE user_progress 
  SET xp = xp + 5 
  WHERE user_id = p_user_id;
  
  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Function: Get XP required for next level
CREATE OR REPLACE FUNCTION get_xp_for_level(p_level INT)
RETURNS INT AS $$
BEGIN
  RETURN p_level * p_level * 100;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Check and level up
CREATE OR REPLACE FUNCTION check_level_up(p_user_id UUID)
RETURNS TABLE (
  leveled_up BOOLEAN,
  new_level INT,
  xp_remaining INT
) AS $$
DECLARE
  v_progress RECORD;
  v_required_xp INT;
  v_leveled BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_progress FROM user_progress WHERE user_id = p_user_id;
  
  LOOP
    v_required_xp := get_xp_for_level(v_progress.level);
    
    IF v_progress.xp >= v_required_xp THEN
      v_progress.xp := v_progress.xp - v_required_xp;
      v_progress.level := v_progress.level + 1;
      v_leveled := TRUE;
    ELSE
      EXIT;
    END IF;
  END LOOP;
  
  IF v_leveled THEN
    UPDATE user_progress 
    SET xp = v_progress.xp, level = v_progress.level 
    WHERE user_id = p_user_id;
  END IF;
  
  RETURN QUERY SELECT v_leveled, v_progress.level, v_progress.xp;
END;
$$ LANGUAGE plpgsql;
