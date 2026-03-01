CREATE TABLE IF NOT EXISTS public.share_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  public_slug TEXT NOT NULL UNIQUE,
  cat_id UUID NOT NULL REFERENCES public.cats(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_display_name TEXT,
  name TEXT NOT NULL,
  rarity TEXT NOT NULL,
  level INT NOT NULL DEFAULT 1,
  power_rating INT NOT NULL DEFAULT 0,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  image_original_url TEXT NOT NULL,
  image_card_png_url TEXT NOT NULL,
  immutable_hash TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  minted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cat_id)
);

CREATE INDEX IF NOT EXISTS idx_share_cards_public
  ON public.share_cards (public_slug, is_public);

CREATE INDEX IF NOT EXISTS idx_share_cards_owner_created
  ON public.share_cards (owner_user_id, created_at DESC);

