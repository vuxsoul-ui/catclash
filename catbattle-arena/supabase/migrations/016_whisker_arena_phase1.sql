-- Whisker Arena Phase 1 schema

CREATE TABLE IF NOT EXISTS arena_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cat_id UUID NOT NULL REFERENCES cats(id) ON DELETE CASCADE,
  cat_name TEXT NOT NULL,
  ai_behavior TEXT NOT NULL DEFAULT 'tactical',
  skill_priority TEXT[] NOT NULL DEFAULT ARRAY['strike','guard','burst'],
  snapshot_stats JSONB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_arena_snapshots_user_created
ON arena_snapshots(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS arena_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenger_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  snapshot_a_id UUID NOT NULL REFERENCES arena_snapshots(id) ON DELETE CASCADE,
  snapshot_b_id UUID REFERENCES arena_snapshots(id) ON DELETE SET NULL,
  opponent_cat_id UUID REFERENCES cats(id) ON DELETE SET NULL,
  opponent_name TEXT,
  winner_snapshot_id UUID REFERENCES arena_snapshots(id) ON DELETE SET NULL,
  winner_cat_id UUID REFERENCES cats(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'complete' CHECK (status IN ('active','complete')),
  turns INTEGER NOT NULL DEFAULT 0,
  seed BIGINT NOT NULL DEFAULT floor(random() * 1000000000)::bigint,
  rating_delta INTEGER NOT NULL DEFAULT 0,
  summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_arena_matches_user_created
ON arena_matches(challenger_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS arena_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES arena_matches(id) ON DELETE CASCADE,
  turn_no INTEGER NOT NULL,
  actor_slot TEXT NOT NULL CHECK (actor_slot IN ('a','b')),
  action_type TEXT NOT NULL,
  value INTEGER NOT NULL DEFAULT 0,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_arena_events_match_turn
ON arena_events(match_id, turn_no);

CREATE TABLE IF NOT EXISTS arena_ratings (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL DEFAULT 1000,
  tier TEXT NOT NULL DEFAULT 'bronze',
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_match_at TIMESTAMPTZ
);
