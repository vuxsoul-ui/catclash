-- One-time reward claims
CREATE TABLE IF NOT EXISTS user_reward_claims (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reward_key TEXT NOT NULL,
  reward_sigils INTEGER NOT NULL DEFAULT 0 CHECK (reward_sigils >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, reward_key)
);

CREATE INDEX IF NOT EXISTS user_reward_claims_created_idx
  ON user_reward_claims(created_at DESC);
