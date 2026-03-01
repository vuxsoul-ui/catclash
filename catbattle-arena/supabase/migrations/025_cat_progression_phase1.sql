CREATE TABLE IF NOT EXISTS public.cat_xp_pools (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  pending_xp INT NOT NULL DEFAULT 0 CHECK (pending_xp >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cat_forge_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  input_cat_ids UUID[] NOT NULL,
  output_cat_id UUID REFERENCES public.cats(id) ON DELETE SET NULL,
  input_rarity TEXT NOT NULL,
  output_rarity TEXT NOT NULL,
  sigil_cost INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cat_forge_history_user_created
  ON public.cat_forge_history(user_id, created_at DESC);
