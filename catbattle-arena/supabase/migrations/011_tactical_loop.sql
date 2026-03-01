-- Tactical and personal loop schema

CREATE TABLE IF NOT EXISTS match_tactics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID REFERENCES tournament_matches(id) ON DELETE CASCADE,
  voter_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  cat_id UUID REFERENCES cats(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('scout', 'cheer', 'guard_break')),
  influence_value INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, voter_user_id)
);

CREATE INDEX IF NOT EXISTS idx_match_tactics_match ON match_tactics(match_id);
CREATE INDEX IF NOT EXISTS idx_match_tactics_user ON match_tactics(voter_user_id);

CREATE TABLE IF NOT EXISTS match_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID REFERENCES tournament_matches(id) ON DELETE CASCADE,
  voter_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  predicted_cat_id UUID REFERENCES cats(id) ON DELETE CASCADE,
  bet_sigils INTEGER NOT NULL CHECK (bet_sigils > 0),
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  won BOOLEAN,
  payout_sigils INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, voter_user_id)
);

CREATE INDEX IF NOT EXISTS idx_match_predictions_match ON match_predictions(match_id);
CREATE INDEX IF NOT EXISTS idx_match_predictions_user ON match_predictions(voter_user_id);
CREATE INDEX IF NOT EXISTS idx_match_predictions_unresolved ON match_predictions(resolved);

CREATE TABLE IF NOT EXISTS cat_stances (
  cat_id UUID PRIMARY KEY REFERENCES cats(id) ON DELETE CASCADE,
  stance TEXT NOT NULL CHECK (stance IN ('aggro', 'guard', 'chaos')),
  updated_day DATE NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')::DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cat_stances_day ON cat_stances(updated_day);

CREATE TABLE IF NOT EXISTS cat_social_stats (
  cat_id UUID PRIMARY KEY REFERENCES cats(id) ON DELETE CASCADE,
  fan_count INTEGER NOT NULL DEFAULT 0,
  cheer_count INTEGER NOT NULL DEFAULT 0,
  rivalry_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tactical_rating INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS signature_cat_id UUID REFERENCES cats(id) ON DELETE SET NULL;
