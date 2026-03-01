CREATE TABLE IF NOT EXISTS public.duel_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenger_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  challenged_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  challenger_cat_id UUID NOT NULL REFERENCES public.cats(id) ON DELETE CASCADE,
  challenged_cat_id UUID REFERENCES public.cats(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'declined', 'completed', 'canceled')),
  winner_cat_id UUID REFERENCES public.cats(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_duel_challenges_challenged_status_created
  ON public.duel_challenges (challenged_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_duel_challenges_challenger_status_created
  ON public.duel_challenges (challenger_user_id, status, created_at DESC);
