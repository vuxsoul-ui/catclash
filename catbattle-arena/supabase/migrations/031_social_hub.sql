CREATE TABLE IF NOT EXISTS public.social_referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recruit_user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'ref_link',
  pitch_slug TEXT,
  guild_at_join TEXT,
  recruit_last_sigils INT NOT NULL DEFAULT 0,
  recruit_last_checked_at TIMESTAMPTZ,
  claimable_sigils INT NOT NULL DEFAULT 0,
  total_sigils_earned INT NOT NULL DEFAULT 0,
  daily_bonus_day DATE,
  daily_bonus_awarded INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_social_referrals_pair
  ON public.social_referrals(referrer_user_id, recruit_user_id);

CREATE INDEX IF NOT EXISTS idx_social_referrals_referrer
  ON public.social_referrals(referrer_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_referrals_recruit
  ON public.social_referrals(recruit_user_id);

CREATE TABLE IF NOT EXISTS public.social_feed_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  reward_sigils INT NOT NULL DEFAULT 0,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_feed_events_user_created
  ON public.social_feed_events(user_id, created_at DESC);
