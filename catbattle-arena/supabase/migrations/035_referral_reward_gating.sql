-- Referral launch-safe gating support

ALTER TABLE IF EXISTS public.social_referrals
  ADD COLUMN IF NOT EXISTS referral_ip_hash TEXT,
  ADD COLUMN IF NOT EXISTS signup_ip_hash TEXT,
  ADD COLUMN IF NOT EXISTS signup_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_social_referrals_referrer_signup_ip
  ON public.social_referrals(referrer_user_id, signup_ip_hash, signup_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_referrals_status_qualified_at
  ON public.social_referrals(status, qualified_at DESC);

DO $$
DECLARE
  c_name TEXT;
BEGIN
  SELECT conname INTO c_name
  FROM pg_constraint
  WHERE conrelid = 'public.referral_events'::regclass
    AND contype = 'c'
    AND conname LIKE '%event_type%';

  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.referral_events DROP CONSTRAINT %I', c_name);
  END IF;
END $$;

ALTER TABLE IF EXISTS public.referral_events
  ADD CONSTRAINT referral_events_event_type_check
  CHECK (
    event_type IN (
      'first_visit',
      'signup',
      'first_vote',
      'first_predict',
      'first_cat_minted',
      'referral_click',
      'referral_signup',
      'referral_qualified',
      'referral_reward_granted',
      'referral_reward_blocked'
    )
  );
