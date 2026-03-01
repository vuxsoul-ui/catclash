type FeaturedCosmetic = {
  id: string;
  slug: string;
  name: string;
  category: string;
  rarity: string;
  description: string | null;
  preview: string | null;
  price_sigils: number;
  metadata: Record<string, unknown>;
  owned: boolean;
  equipped_slot: string | null;
};

type FeaturedBucket = 'title' | 'border' | 'color' | 'vote_effect' | 'voter_badge' | 'xp';

const RARITY_WEIGHT: Record<string, number> = {
  common: 14,
  rare: 8,
  epic: 4,
  legendary: 2,
  mythic: 1,
  'god-tier': 0.45,
  god: 0.45,
};

function rarityWeight(rarity: string): number {
  return RARITY_WEIGHT[String(rarity || 'common').toLowerCase()] || 6;
}

function isEpicPlus(rarity: string): boolean {
  const r = String(rarity || '').toLowerCase();
  return r === 'epic' || r === 'legendary' || r === 'mythic' || r === 'god-tier' || r === 'god';
}

type PriceBand = 'entry' | 'identity' | 'prestige' | 'elite' | 'mythic' | 'other';

function priceBand(price: number): PriceBand {
  const p = Math.max(0, Number(price || 0));
  if (p >= 900) return 'mythic';
  if (p >= 620) return 'elite';
  if (p >= 360 && p <= 460) return 'prestige';
  if (p >= 180 && p <= 260) return 'identity';
  if (p >= 80 && p <= 120) return 'entry';
  return 'other';
}

export function utcDayKey(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function nextUtcMidnightIso(now = new Date()): string {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
  return next.toISOString();
}

export function hashStringToInt(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededRng(seed: number): () => number {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bucketForItem(item: FeaturedCosmetic): FeaturedBucket | null {
  const rawCategory = String(item.category || '').toLowerCase();
  const cosmeticType = String(item.metadata?.cosmetic_type || '').toLowerCase();
  const slug = String(item.slug || '');

  if (rawCategory === 'xp' || rawCategory === 'xp_boost') return 'xp';
  if (slug.startsWith('vote-') || rawCategory === 'vote_effect' || rawCategory === 'effect' || cosmeticType === 'vote_effect') return 'vote_effect';
  if (slug.startsWith('badge-') || rawCategory === 'voter_badge' || rawCategory === 'badge' || cosmeticType === 'voter_badge') return 'voter_badge';
  if (rawCategory === 'cat_border' || rawCategory === 'border' || rawCategory === 'frame' || rawCategory === 'cat_frame') return 'border';
  if (rawCategory === 'cat_color' || rawCategory === 'color' || rawCategory === 'background') return 'color';
  if (rawCategory === 'cat_title' || rawCategory === 'title') return 'title';

  return null;
}

function weightedPick(items: FeaturedCosmetic[], random: () => number): FeaturedCosmetic | null {
  if (!items.length) return null;
  let total = 0;
  for (const item of items) total += rarityWeight(item.rarity);
  let roll = random() * total;
  for (const item of items) {
    roll -= rarityWeight(item.rarity);
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

function popWeighted(pool: FeaturedCosmetic[], random: () => number, selected: Set<string>): FeaturedCosmetic | null {
  const candidates = pool.filter((item) => !selected.has(item.id));
  const pick = weightedPick(candidates, random);
  if (!pick) return null;
  selected.add(pick.id);
  return pick;
}

export function pickFeaturedItems(catalog: FeaturedCosmetic[], dayKey: string): { seed: number; items: FeaturedCosmetic[] } {
  const seed = hashStringToInt(`shop-featured:${dayKey}`);
  const random = seededRng(seed);
  const targetCount = 4 + Math.floor(random() * 3); // 4..6
  const selectedIds = new Set<string>();
  const picked: FeaturedCosmetic[] = [];

  const byBucket: Record<FeaturedBucket, FeaturedCosmetic[]> = {
    title: [],
    border: [],
    color: [],
    vote_effect: [],
    voter_badge: [],
    xp: [],
  };

  for (const item of catalog) {
    const bucket = bucketForItem(item);
    if (!bucket) continue;
    byBucket[bucket].push(item);
  }

  const take = (bucket: FeaturedBucket, count: number) => {
    for (let i = 0; i < count; i += 1) {
      const next = popWeighted(byBucket[bucket], random, selectedIds);
      if (!next) break;
      picked.push(next);
    }
  };
  const popFrom = (pool: FeaturedCosmetic[]) => popWeighted(pool, random, selectedIds);

  const elitePool = catalog.filter((item) => {
    const band = priceBand(item.price_sigils);
    return band === 'elite' || band === 'mythic';
  });
  const prestigePool = catalog.filter((item) => priceBand(item.price_sigils) === 'prestige');
  const identityPool = catalog.filter((item) => priceBand(item.price_sigils) === 'identity');

  const firstElite = popFrom(elitePool);
  if (firstElite) picked.push(firstElite);

  for (let i = 0; i < 2; i += 1) {
    const next = popFrom(prestigePool);
    if (next) picked.push(next);
  }

  for (let i = 0; i < 2; i += 1) {
    const next = popFrom(identityPool);
    if (next) picked.push(next);
  }

  if (!picked.some((item) => bucketForItem(item) === 'vote_effect') && byBucket.vote_effect.length) {
    const effect = popFrom(byBucket.vote_effect);
    if (effect) picked.push(effect);
  }

  const allRemaining = catalog.filter((item) => !selectedIds.has(item.id));
  while (picked.length < targetCount) {
    const next = popWeighted(allRemaining, random, selectedIds);
    if (!next) break;
    picked.push(next);
  }

  if (!picked.some((item) => isEpicPlus(item.rarity))) {
    const aspirational = weightedPick(
      catalog.filter((item) => !selectedIds.has(item.id) && isEpicPlus(item.rarity)),
      random
    );
    if (aspirational) {
      if (picked.length >= targetCount) picked[picked.length - 1] = aspirational;
      else picked.push(aspirational);
    }
  }

  return { seed, items: picked.slice(0, 6) };
}
