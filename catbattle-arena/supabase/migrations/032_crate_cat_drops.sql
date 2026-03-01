CREATE TABLE IF NOT EXISTS public.crate_cat_drops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('daily', 'paid')),
  day_key DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cat_id UUID REFERENCES public.cats(id) ON DELETE SET NULL,
  special_ability_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_crate_cat_drops_user_day
  ON public.crate_cat_drops(user_id, day_key);

CREATE INDEX IF NOT EXISTS idx_crate_cat_drops_user_day_source
  ON public.crate_cat_drops(user_id, day_key, source);

ALTER TABLE public.cats
  ADD COLUMN IF NOT EXISTS special_ability_id TEXT;

CREATE INDEX IF NOT EXISTS idx_cats_user_special_ability
  ON public.cats(user_id, special_ability_id);

