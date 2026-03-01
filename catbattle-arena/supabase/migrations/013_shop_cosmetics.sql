-- Shop + cosmetics + titles

CREATE TABLE IF NOT EXISTS cosmetics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('cat_title', 'cat_border', 'cat_color', 'xp_boost')),
  rarity TEXT NOT NULL DEFAULT 'Common',
  description TEXT,
  price_sigils INTEGER NOT NULL CHECK (price_sigils >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_inventory (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cosmetic_id UUID NOT NULL REFERENCES cosmetics(id) ON DELETE CASCADE,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'shop',
  PRIMARY KEY (user_id, cosmetic_id)
);

CREATE TABLE IF NOT EXISTS equipped_cosmetics (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slot TEXT NOT NULL CHECK (slot IN ('title', 'border', 'color')),
  cosmetic_id UUID NOT NULL REFERENCES cosmetics(id) ON DELETE CASCADE,
  cat_id UUID NULL REFERENCES cats(id) ON DELETE CASCADE,
  equipped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, slot)
);

CREATE INDEX IF NOT EXISTS user_inventory_user_idx ON user_inventory(user_id, acquired_at DESC);
CREATE INDEX IF NOT EXISTS cosmetics_active_idx ON cosmetics(active, category, price_sigils);

INSERT INTO cosmetics (slug, name, category, rarity, description, price_sigils, metadata)
VALUES
  ('title-arena-rookie', 'Arena Rookie', 'cat_title', 'Common', 'First blood in the arena.', 80, '{"title":"Arena Rookie"}'),
  ('title-clutch-voter', 'Clutch Voter', 'cat_title', 'Rare', 'You make close matches count.', 180, '{"title":"Clutch Voter"}'),
  ('title-sigil-whisperer', 'Sigil Whisperer', 'cat_title', 'Epic', 'Master of the sigil economy.', 350, '{"title":"Sigil Whisperer"}'),
  ('border-neon-cyan', 'Neon Cyan Border', 'cat_border', 'Rare', 'Clean cyan frame for your cats.', 220, '{"borderClass":"ring-cyan-400"}'),
  ('border-ember-gold', 'Ember Gold Border', 'cat_border', 'Epic', 'Premium gold-hot profile frame.', 420, '{"borderClass":"ring-yellow-400"}'),
  ('color-solar-flare', 'Solar Flare Theme', 'cat_color', 'Rare', 'Warm highlight color theme.', 260, '{"color":"solar"}'),
  ('color-lunar-ice', 'Lunar Ice Theme', 'cat_color', 'Rare', 'Cool highlight color theme.', 260, '{"color":"lunar"}'),
  ('xp-quick-50', 'XP Pack +50', 'xp_boost', 'Common', 'Instantly gain 50 XP.', 100, '{"xp":50}'),
  ('xp-burst-150', 'XP Burst +150', 'xp_boost', 'Rare', 'Instantly gain 150 XP.', 280, '{"xp":150}')
ON CONFLICT (slug) DO NOTHING;
