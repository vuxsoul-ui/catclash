import { normalizeCosmeticSlot } from '../../../_lib/cosmetics/effectsRegistry';

const BLOCKED_PATTERNS = [
  'golden classic',
  'galaxy border',
  'border-galaxy',
  'sakura petals',
  'neon grid',
  'frost border',
];

const SUPPORTED_VOTE_EFFECT_SLUGS = new Set([
  'vote-comet-trail',
  'vote-ember-burst',
  'vote-crown-flash',
  'vote-arc-light',
  'vote-stardust-pop',
  'vote-lightning-strike',
  'vote-aurora',
]);

function rarityTier(rarity: string): 'common' | 'rare' | 'epic' | 'legendary' | 'mythic' {
  const r = String(rarity || '').toLowerCase();
  if (r.includes('god') || r.includes('mythic')) return 'mythic';
  if (r.includes('legend')) return 'legendary';
  if (r.includes('epic')) return 'epic';
  if (r.includes('rare')) return 'rare';
  return 'common';
}

export function isBlockedCosmetic(slug: string, name: string): boolean {
  const key = `${String(slug || '').toLowerCase()} ${String(name || '').toLowerCase()}`;
  return BLOCKED_PATTERNS.some((pattern) => key.includes(pattern));
}

export function isSupportedVoteEffect(slug: string, effectId: string): boolean {
  const normalizedSlug = String(slug || '').toLowerCase();
  if (!normalizedSlug.startsWith('vote-')) return false;
  return SUPPORTED_VOTE_EFFECT_SLUGS.has(normalizedSlug);
}

export function stablePriceSigils(input: {
  slug: string;
  category: string;
  rarity: string;
  metadata?: Record<string, unknown> | null;
  configuredPrice?: number | null;
}): number {
  const configured = Number(input.configuredPrice);
  if (Number.isFinite(configured) && configured > 0) return configured;

  const slot = normalizeCosmeticSlot({
    slug: input.slug,
    category: input.category,
    metadata: input.metadata || undefined,
  });
  const tier = rarityTier(input.rarity);

  const bySlot: Record<string, Record<'common' | 'rare' | 'epic' | 'legendary' | 'mythic', number>> = {
    title: { common: 90, rare: 180, epic: 360, legendary: 620, mythic: 900 },
    border: { common: 120, rare: 240, epic: 420, legendary: 700, mythic: 950 },
    theme: { common: 120, rare: 260, epic: 420, legendary: 720, mythic: 950 },
    vote_effect: { common: 140, rare: 260, epic: 420, legendary: 720, mythic: 950 },
    badge: { common: 120, rare: 260, epic: 460, legendary: 720, mythic: 900 },
    xp: { common: 100, rare: 220, epic: 460, legendary: 720, mythic: 900 },
  };

  const slotPrices = bySlot[slot] || bySlot.title;
  return slotPrices[tier];
}
