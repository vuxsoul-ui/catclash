ALTER TABLE public.duel_challenges
  DROP CONSTRAINT IF EXISTS duel_challenges_status_check;

ALTER TABLE public.duel_challenges
  ADD CONSTRAINT duel_challenges_status_check
  CHECK (status IN ('pending', 'voting', 'declined', 'completed', 'canceled'));

CREATE TABLE IF NOT EXISTS public.duel_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  duel_id UUID NOT NULL REFERENCES public.duel_challenges(id) ON DELETE CASCADE,
  voter_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  voted_cat_id UUID NOT NULL REFERENCES public.cats(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (duel_id, voter_user_id)
);

CREATE INDEX IF NOT EXISTS idx_duel_votes_duel_id
  ON public.duel_votes (duel_id);

