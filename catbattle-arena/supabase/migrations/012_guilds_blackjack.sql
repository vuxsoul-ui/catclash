-- Two-guild model + stateful blackjack hands

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS guild TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND constraint_name = 'profiles_guild_check'
  ) THEN
    ALTER TABLE profiles
    ADD CONSTRAINT profiles_guild_check
    CHECK (guild IS NULL OR guild IN ('sun', 'moon'));
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS casino_blackjack_hands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bet INTEGER NOT NULL CHECK (bet > 0),
  player_cards INTEGER[] NOT NULL DEFAULT '{}',
  dealer_cards INTEGER[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'complete')),
  outcome TEXT CHECK (outcome IN ('win', 'lose', 'push')),
  payout INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS casino_blackjack_active_user_idx
ON casino_blackjack_hands(user_id)
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS casino_blackjack_user_created_idx
ON casino_blackjack_hands(user_id, created_at DESC);
