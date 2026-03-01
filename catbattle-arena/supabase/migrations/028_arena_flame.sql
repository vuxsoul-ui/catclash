-- Arena Flame additive fields on streaks table.
-- Keep existing streak columns for backward compatibility.

ALTER TABLE streaks
  ADD COLUMN IF NOT EXISTS flame_state TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_flame_date DATE NULL,
  ADD COLUMN IF NOT EXISTS fading_expires_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS flame_heat INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_streaks_last_flame_date ON streaks(last_flame_date);
CREATE INDEX IF NOT EXISTS idx_votes_user_created_at ON votes(voter_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_match_predictions_user_created_at ON match_predictions(voter_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cats_user_created_at ON cats(user_id, created_at);
