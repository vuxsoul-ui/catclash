-- Additive Main Arena Expansion V2

CREATE TABLE IF NOT EXISTS public.social_callouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
  picked_cat_id UUID NOT NULL REFERENCES public.cats(id) ON DELETE CASCADE,
  share_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_callouts_user_created
  ON public.social_callouts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_callouts_match_created
  ON public.social_callouts(match_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_social_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_user_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  ref_code TEXT NOT NULL UNIQUE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_social_challenges_owner_created
  ON public.user_social_challenges(owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_social_challenges_ref_code
  ON public.user_social_challenges(ref_code);

CREATE TABLE IF NOT EXISTS public.daily_boss_progress (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_clear_date DATE NULL,
  clear_streak INTEGER NOT NULL DEFAULT 0 CHECK (clear_streak >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.site_spotlights
  ADD COLUMN IF NOT EXISTS tagline TEXT NULL,
  ADD COLUMN IF NOT EXISTS theme TEXT NULL,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL;

