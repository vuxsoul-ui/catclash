-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USER PROGRESS TABLE
CREATE TABLE user_progress (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  xp INT NOT NULL DEFAULT 0,
  level INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. STREAKS TABLE
CREATE TABLE streaks (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  current_streak INT NOT NULL DEFAULT 0,
  last_claim_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. DAILY REWARDS TABLE
CREATE TABLE daily_rewards (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  last_claim_date DATE,
  claimed_today BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CATS TABLE
CREATE TABLE cats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rarity TEXT NOT NULL,
  attack INT NOT NULL,
  defense INT NOT NULL,
  speed INT NOT NULL,
  charisma INT NOT NULL,
  chaos INT NOT NULL,
  ability TEXT,
  cat_xp INT NOT NULL DEFAULT 0,
  cat_level INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. BATTLES TABLE
CREATE TABLE battles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cat_a UUID REFERENCES cats(id) ON DELETE CASCADE,
  cat_b UUID REFERENCES cats(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. VOTES TABLE
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  battle_id UUID REFERENCES battles(id) ON DELETE CASCADE,
  voter_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ip_hash TEXT,
  user_agent TEXT,
  voted_for UUID REFERENCES cats(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent double voting: unique constraint on battle + user
CREATE UNIQUE INDEX idx_votes_battle_user 
  ON votes(battle_id, voter_user_id) 
  WHERE voter_user_id IS NOT NULL;

-- Prevent double voting: unique constraint on battle + ip hash
CREATE UNIQUE INDEX idx_votes_battle_ip 
  ON votes(battle_id, ip_hash) 
  WHERE ip_hash IS NOT NULL;

-- 8. RATE LIMITS TABLE
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_cats_user_id ON cats(user_id);
CREATE INDEX idx_battles_status ON battles(status);
CREATE INDEX idx_votes_battle_id ON votes(battle_id);
CREATE INDEX idx_rate_limits_window ON rate_limits(window_start);

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_user_progress_updated_at 
  BEFORE UPDATE ON user_progress 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_streaks_updated_at 
  BEFORE UPDATE ON streaks 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_rewards_updated_at 
  BEFORE UPDATE ON daily_rewards 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rate_limits_updated_at 
  BEFORE UPDATE ON rate_limits 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE cats ENABLE ROW LEVEL SECURITY;
ALTER TABLE battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" 
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can view own progress" 
  ON user_progress FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own streaks" 
  ON streaks FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own daily rewards" 
  ON daily_rewards FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own cats" 
  ON cats FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view all battles" 
  ON battles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can view own votes" 
  ON votes FOR SELECT USING (auth.uid() = voter_user_id);
