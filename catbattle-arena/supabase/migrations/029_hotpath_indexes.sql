-- Hot-path indexes for launch-readiness (non-breaking additive).
-- Safe IF NOT EXISTS guards for repeated deploys.

CREATE INDEX IF NOT EXISTS idx_votes_battle_voter ON votes(battle_id, voter_user_id);
CREATE INDEX IF NOT EXISTS idx_votes_battle_iphash ON votes(battle_id, ip_hash);
CREATE INDEX IF NOT EXISTS idx_votes_created_at ON votes(created_at);

CREATE INDEX IF NOT EXISTS idx_match_predictions_match_voter ON match_predictions(match_id, voter_user_id);
CREATE INDEX IF NOT EXISTS idx_match_predictions_created_at ON match_predictions(created_at);

CREATE INDEX IF NOT EXISTS idx_cats_status_created_at ON cats(status, created_at);
CREATE INDEX IF NOT EXISTS idx_cats_image_review_status ON cats(image_review_status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_key_unique ON rate_limits(key);

CREATE INDEX IF NOT EXISTS idx_tournament_matches_status ON tournament_matches(status);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament_round ON tournament_matches(tournament_id, round);

