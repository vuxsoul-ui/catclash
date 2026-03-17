ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS pulse_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vote_locks_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolves_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  trigger TEXT NOT NULL,
  trigger_value INTEGER,
  delta DOUBLE PRECISION NOT NULL DEFAULT 0,
  is_counter BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cat_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cat_id UUID NOT NULL REFERENCES public.cats(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  equipped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS voting_locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_votes_a INTEGER,
  ADD COLUMN IF NOT EXISTS locked_votes_b INTEGER,
  ADD COLUMN IF NOT EXISTS locked_prob_a DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS locked_prob_b DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_source TEXT;

CREATE TABLE IF NOT EXISTS public.match_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
  pulse_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  cat_a_id UUID NOT NULL REFERENCES public.cats(id) ON DELETE CASCADE,
  cat_b_id UUID NOT NULL REFERENCES public.cats(id) ON DELETE CASCADE,
  votes_a INTEGER NOT NULL DEFAULT 0,
  votes_b INTEGER NOT NULL DEFAULT 0,
  base_prob_a DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  skill_delta DOUBLE PRECISION NOT NULL DEFAULT 0,
  final_prob_a DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  skill_a_triggered BOOLEAN NOT NULL DEFAULT false,
  skill_b_triggered BOOLEAN NOT NULL DEFAULT false,
  skill_a_id UUID REFERENCES public.skills(id) ON DELETE SET NULL,
  skill_b_id UUID REFERENCES public.skills(id) ON DELETE SET NULL,
  winner_id UUID REFERENCES public.cats(id) ON DELETE SET NULL,
  loser_id UUID REFERENCES public.cats(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id)
);

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cat_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_history ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.skills FROM anon, authenticated;
REVOKE ALL ON TABLE public.cat_skills FROM anon, authenticated;
REVOKE ALL ON TABLE public.match_history FROM anon, authenticated;

GRANT SELECT ON TABLE public.skills TO anon, authenticated;
GRANT SELECT ON TABLE public.cat_skills TO anon, authenticated;
GRANT SELECT ON TABLE public.match_history TO anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'skills'
      AND policyname = 'skills_public_read'
  ) THEN
    CREATE POLICY skills_public_read
      ON public.skills
      FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cat_skills'
      AND policyname = 'cat_skills_public_read'
  ) THEN
    CREATE POLICY cat_skills_public_read
      ON public.cat_skills
      FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'match_history'
      AND policyname = 'match_history_public_read'
  ) THEN
    CREATE POLICY match_history_public_read
      ON public.match_history
      FOR SELECT
      USING (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cat_skills_cat_id ON public.cat_skills (cat_id, equipped_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_history_tournament ON public.match_history (tournament_id, round, resolved_at DESC);
