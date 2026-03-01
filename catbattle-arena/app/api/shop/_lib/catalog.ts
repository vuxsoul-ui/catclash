import type { SupabaseClient } from '@supabase/supabase-js';

export type ShopSeedItem = {
  slug: string;
  name: string;
  category: 'cat_title' | 'cat_border' | 'cat_color' | 'xp_boost';
  rarity: string;
  description: string;
  price_sigils: number;
  metadata: Record<string, unknown>;
  active?: boolean;
};

export const DEFAULT_SHOP_ITEMS: ShopSeedItem[] = [
  { slug: 'title-arena-rookie', name: 'Arena Rookie', category: 'cat_title', rarity: 'Common', description: 'First blood in the arena.', price_sigils: 80, metadata: { title: 'Arena Rookie' } },
  { slug: 'title-clutch-voter', name: 'Clutch Voter', category: 'cat_title', rarity: 'Rare', description: 'You make close calls count.', price_sigils: 220, metadata: { title: 'Clutch Voter' } },
  { slug: 'title-sigil-whisperer', name: 'Sigil Whisperer', category: 'cat_title', rarity: 'Epic', description: 'Master of the sigil economy.', price_sigils: 420, metadata: { title: 'Sigil Whisperer' } },
  { slug: 'title-ember-emperor', name: 'Ember Emperor', category: 'cat_title', rarity: 'Legendary', description: 'Crowned in the fire of the arena.', price_sigils: 680, metadata: { title: 'Ember Emperor' } },
  { slug: 'title-midnight-hunter', name: 'Midnight Hunter', category: 'cat_title', rarity: 'Rare', description: 'Silent, patient, and deadly cute.', price_sigils: 220, metadata: { title: 'Midnight Hunter' } },
  { slug: 'title-meme-lord', name: 'Meme Lord', category: 'cat_title', rarity: 'Epic', description: 'Certified chaos curator.', price_sigils: 420, metadata: { title: 'Meme Lord' } },
  { slug: 'title-instafamous', name: 'Instafamous', category: 'cat_title', rarity: 'Legendary', description: 'Built for viral cat moments.', price_sigils: 720, metadata: { title: 'Instafamous' } },
  { slug: 'border-neon-cyan', name: 'Neon Cyan Border', category: 'cat_border', rarity: 'Rare', description: 'Clean cyan frame for your cats.', price_sigils: 220, metadata: { borderClass: 'ring-cyan-400' } },
  { slug: 'border-ember-gold', name: 'Ember Gold Border', category: 'cat_border', rarity: 'Epic', description: 'Premium gold-hot profile frame.', price_sigils: 420, metadata: { borderClass: 'ring-yellow-400' } },
  { slug: 'border-obsidian', name: 'Obsidian Edge', category: 'cat_border', rarity: 'Common', description: 'Matte black frame with silver trim.', price_sigils: 120, metadata: { borderClass: 'ring-zinc-400' } },
  { slug: 'border-royal-violet', name: 'Royal Violet Border', category: 'cat_border', rarity: 'Legendary', description: 'A crown-tier violet aura frame.', price_sigils: 680, metadata: { borderClass: 'ring-fuchsia-400' } },
  { slug: 'border-prism-shift', name: 'Prism Shift Border', category: 'cat_border', rarity: 'Epic', description: 'Shimmering edge for spotlight cats.', price_sigils: 460, metadata: { borderClass: 'ring-indigo-400' } },
  { slug: 'border-solarflare', name: 'Solarflare Border', category: 'cat_border', rarity: 'Legendary', description: 'Molten trim for tournament highlights.', price_sigils: 760, metadata: { borderClass: 'ring-amber-400' } },
  { slug: 'color-solar-flare', name: 'Solar Flare Theme', category: 'cat_color', rarity: 'Rare', description: 'Warm highlight color theme.', price_sigils: 260, metadata: { color: 'solar' } },
  { slug: 'color-lunar-ice', name: 'Lunar Ice Theme', category: 'cat_color', rarity: 'Rare', description: 'Cool highlight color theme.', price_sigils: 260, metadata: { color: 'lunar' } },
  { slug: 'color-neon-lime', name: 'Neon Lime Theme', category: 'cat_color', rarity: 'Epic', description: 'Electric green highlights for flex mode.', price_sigils: 420, metadata: { color: 'neon_lime' } },
  { slug: 'color-rose-gold', name: 'Rose Gold Theme', category: 'cat_color', rarity: 'Epic', description: 'Soft premium glow styling.', price_sigils: 420, metadata: { color: 'rose_gold' } },
  { slug: 'color-deep-space', name: 'Deep Space Theme', category: 'cat_color', rarity: 'Legendary', description: 'Dark cosmic profile aura.', price_sigils: 720, metadata: { color: 'deep_space' } },
  { slug: 'badge-first-100', name: 'First 100', category: 'cat_title', rarity: 'Common', description: 'OG arena supporter badge.', price_sigils: 120, metadata: { cosmetic_type: 'voter_badge', badge: 'First 100' } },
  { slug: 'badge-prediction-pro', name: 'Prediction Pro', category: 'cat_title', rarity: 'Rare', description: 'Trusted by the sigil markets.', price_sigils: 260, metadata: { cosmetic_type: 'voter_badge', badge: 'Prediction Pro' } },
  { slug: 'badge-underdog-picker', name: 'Underdog Picker', category: 'cat_title', rarity: 'Epic', description: 'You call upsets before they happen.', price_sigils: 460, metadata: { cosmetic_type: 'voter_badge', badge: 'Underdog Picker' } },
  { slug: 'vote-comet-trail', name: 'Comet Vote Trail', category: 'cat_color', rarity: 'Rare', description: 'Blue comet burst on vote taps.', price_sigils: 220, metadata: { cosmetic_type: 'vote_effect', effect: 'comet' } },
  { slug: 'vote-ember-burst', name: 'Ember Vote Burst', category: 'cat_color', rarity: 'Epic', description: 'Hot ember splash on vote taps.', price_sigils: 420, metadata: { cosmetic_type: 'vote_effect', effect: 'ember' } },
  { slug: 'vote-crown-flash', name: 'Crown Flash', category: 'cat_color', rarity: 'Legendary', description: 'Royal flash effect for elite votes.', price_sigils: 720, metadata: { cosmetic_type: 'vote_effect', effect: 'crown_flash' } },
  { slug: 'vote-arc-light', name: 'Arc Light', category: 'cat_color', rarity: 'Epic', description: 'Electric strike animation on vote.', price_sigils: 420, metadata: { cosmetic_type: 'vote_effect', effect: 'arc_light' } },
  { slug: 'vote-stardust-pop', name: 'Stardust Pop', category: 'cat_color', rarity: 'Rare', description: 'Soft starburst for vote taps.', price_sigils: 260, metadata: { cosmetic_type: 'vote_effect', effect: 'stardust' } },
  { slug: 'xp-quick-50', name: 'XP Pack +50', category: 'xp_boost', rarity: 'Common', description: 'Instantly gain 50 XP.', price_sigils: 100, metadata: { xp: 50 } },
  { slug: 'xp-burst-150', name: 'XP Burst +150', category: 'xp_boost', rarity: 'Rare', description: 'Instantly gain 150 XP.', price_sigils: 220, metadata: { xp: 150 } },
  { slug: 'xp-surge-300', name: 'XP Surge +300', category: 'xp_boost', rarity: 'Epic', description: 'Instantly gain 300 XP.', price_sigils: 460, metadata: { xp: 300 } },
  { slug: 'border-void-drift', name: 'Void Drift Border', category: 'cat_border', rarity: 'Mythic', description: 'Dark particle drift frame from the outer arena.', price_sigils: 900, metadata: { borderClass: 'ring-violet-300', seasonal: true } },
  { slug: 'title-apex-overlord', name: 'Apex Overlord', category: 'cat_title', rarity: 'Mythic', description: 'Seasonal crown-tier title for pure flex.', price_sigils: 900, metadata: { title: 'Apex Overlord', seasonal: true } },
];

const itemMap = Object.fromEntries(DEFAULT_SHOP_ITEMS.map((i) => [i.slug, i]));

export function getItemConfig(slug: string): ShopSeedItem | null {
  return itemMap[slug] || null;
}

export async function ensureLegacyRows(supabase: SupabaseClient): Promise<void> {
  const richInsert = await supabase.from('cosmetics').upsert(
    DEFAULT_SHOP_ITEMS.map((i) => ({
      slug: i.slug,
      name: i.name,
      category: i.category,
      rarity: i.rarity,
      description: i.description,
      preview: null,
      price_sigils: i.price_sigils,
      metadata: i.metadata,
      active: true,
    })),
    { onConflict: 'slug' }
  );

  if (!richInsert.error) return;

  for (const item of DEFAULT_SHOP_ITEMS) {
    const base = {
      slug: item.slug,
      name: item.name,
      category: item.category,
      rarity: item.rarity,
      description: item.description,
      preview: null,
    };

    const tryPrimary = await supabase.from('cosmetics').upsert([base], { onConflict: 'slug' });
    if (!tryPrimary.error) continue;

    // Legacy schema compatibility: some deployments use vote_effect instead of cat_color.
    if (item.category === 'cat_color') {
      await supabase
        .from('cosmetics')
        .upsert([{ ...base, category: 'vote_effect' }], { onConflict: 'slug' });
    }
  }
}
