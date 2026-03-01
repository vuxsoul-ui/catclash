-- Match-level comments for main arena engagement
CREATE TABLE IF NOT EXISTS public.tournament_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tournament_comments_body_len_chk CHECK (char_length(btrim(body)) BETWEEN 1 AND 240)
);

CREATE INDEX IF NOT EXISTS idx_tournament_comments_match_created
  ON public.tournament_comments (match_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tournament_comments_user_created
  ON public.tournament_comments (user_id, created_at DESC);
