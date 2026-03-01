-- Recruit Tree / Referral growth additions (additive, backward-compatible)

ALTER TABLE IF EXISTS public.social_referrals
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'clicked',
  ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS campaign_tag TEXT,
  ADD COLUMN IF NOT EXISTS referral_code TEXT;

CREATE INDEX IF NOT EXISTS idx_social_referrals_status_created
  ON public.social_referrals(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_referrals_referrer_qualified
  ON public.social_referrals(referrer_user_id, qualified_at DESC);

CREATE TABLE IF NOT EXISTS public.referral_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (
    event_type IN ('first_visit', 'signup', 'first_vote', 'first_predict', 'first_cat_minted')
  ),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_events_user_type_created
  ON public.referral_events(user_id, event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.referral_edges_daily (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  day_key DATE NOT NULL,
  inviter_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  qualified_count INT NOT NULL DEFAULT 0,
  total_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(day_key, inviter_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_edges_daily_inviter_day
  ON public.referral_edges_daily(inviter_user_id, day_key DESC);
