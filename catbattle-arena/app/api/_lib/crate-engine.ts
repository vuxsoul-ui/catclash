export type CrateType = 'daily' | 'battle' | 'guild' | 'premium' | 'epic' | 'event';
export type RarityTier = 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic' | 'God Tier';

export type TierWeight = { tier: RarityTier; weight: number };

export type CrateConfig = {
  type: CrateType;
  label: string;
  theme: string;
  secondaryRewardChance: number;
  tiers: TierWeight[];
};

export const CRATE_CONFIGS: Record<CrateType, CrateConfig> = {
  daily: {
    type: 'daily',
    label: 'Daily Crate',
    theme: 'amber',
    secondaryRewardChance: 0.12,
    tiers: [
      { tier: 'Common', weight: 50 },
      { tier: 'Rare', weight: 30 },
      { tier: 'Epic', weight: 12 },
      { tier: 'Legendary', weight: 5 },
      { tier: 'Mythic', weight: 2.5 },
      { tier: 'God Tier', weight: 0.5 },
    ],
  },
  battle: {
    type: 'battle',
    label: 'Battle Crate',
    theme: 'cyan',
    secondaryRewardChance: 0.16,
    tiers: [
      { tier: 'Common', weight: 47 },
      { tier: 'Rare', weight: 30 },
      { tier: 'Epic', weight: 14 },
      { tier: 'Legendary', weight: 5.5 },
      { tier: 'Mythic', weight: 2.8 },
      { tier: 'God Tier', weight: 0.7 },
    ],
  },
  guild: {
    type: 'guild',
    label: 'Guild Crate',
    theme: 'violet',
    secondaryRewardChance: 0.18,
    tiers: [
      { tier: 'Common', weight: 46 },
      { tier: 'Rare', weight: 30 },
      { tier: 'Epic', weight: 14.5 },
      { tier: 'Legendary', weight: 6 },
      { tier: 'Mythic', weight: 2.7 },
      { tier: 'God Tier', weight: 0.8 },
    ],
  },
  premium: {
    type: 'premium',
    label: 'Premium Crate',
    theme: 'rose',
    secondaryRewardChance: 0.25,
    tiers: [
      { tier: 'Common', weight: 40 },
      { tier: 'Rare', weight: 32 },
      { tier: 'Epic', weight: 16 },
      { tier: 'Legendary', weight: 7 },
      { tier: 'Mythic', weight: 4 },
      { tier: 'God Tier', weight: 1 },
    ],
  },
  epic: {
    type: 'epic',
    label: 'Epic Chaos Crate',
    theme: 'violet',
    secondaryRewardChance: 0.2,
    tiers: [
      { tier: 'Common', weight: 30 },
      { tier: 'Rare', weight: 28 },
      { tier: 'Epic', weight: 20 },
      { tier: 'Legendary', weight: 12 },
      { tier: 'Mythic', weight: 7 },
      { tier: 'God Tier', weight: 3 },
    ],
  },
  event: {
    type: 'event',
    label: 'Event Crate',
    theme: 'fuchsia',
    secondaryRewardChance: 0.22,
    tiers: [
      { tier: 'Common', weight: 44 },
      { tier: 'Rare', weight: 30 },
      { tier: 'Epic', weight: 15 },
      { tier: 'Legendary', weight: 6.5 },
      { tier: 'Mythic', weight: 3.2 },
      { tier: 'God Tier', weight: 1.3 },
    ],
  },
};

export function parseCrateType(input: unknown): CrateType {
  const key = String(input || '').trim().toLowerCase();
  if (key === 'battle' || key === 'guild' || key === 'premium' || key === 'epic' || key === 'event') return key;
  return 'daily';
}

export function tierToScore(tier: RarityTier): number {
  if (tier === 'God Tier') return 6;
  if (tier === 'Mythic') return 5;
  if (tier === 'Legendary') return 4;
  if (tier === 'Epic') return 3;
  if (tier === 'Rare') return 2;
  return 1;
}

export function applySoftPity(
  config: CrateConfig,
  streakWithoutEpic: number,
  streakWithoutLegendary: number,
  streakWithoutGod: number
): TierWeight[] {
  const adjusted = config.tiers.map((x) => ({ ...x }));

  // Epic crate has a stronger pity: after 6 misses without Legendary+,
  // next roll is guaranteed Legendary or better.
  if (config.type === 'epic' && streakWithoutLegendary >= 6) {
    return adjusted.map((x) => {
      if (x.tier === 'Common' || x.tier === 'Rare' || x.tier === 'Epic') return { ...x, weight: 0 };
      return x;
    });
  }

  if (streakWithoutEpic >= 10) {
    const epic = adjusted.find((x) => x.tier === 'Epic');
    const common = adjusted.find((x) => x.tier === 'Common');
    if (epic && common) {
      const shift = Math.min(5, Math.max(0, common.weight - 1));
      epic.weight += shift;
      common.weight -= shift;
    }
  }

  if (streakWithoutGod >= 30) {
    const god = adjusted.find((x) => x.tier === 'God Tier');
    const common = adjusted.find((x) => x.tier === 'Common');
    if (god && common) {
      const shift = Math.min(0.25, Math.max(0, common.weight - 0.2));
      god.weight += shift;
      common.weight -= shift;
    }
  }

  if (streakWithoutLegendary >= 20) {
    return adjusted.map((x) => {
      if (x.tier === 'Common') return { ...x, weight: 0 };
      if (x.tier === 'Rare') return { ...x, weight: 0 };
      if (x.tier === 'Epic') return { ...x, weight: x.weight * 0.55 };
      return x;
    });
  }

  return adjusted;
}

export function weightedTierRoll(tiers: TierWeight[]): RarityTier {
  const total = tiers.reduce((sum, t) => sum + Math.max(0, t.weight), 0);
  if (total <= 0) return 'Common';
  const roll = Math.random() * total;
  let acc = 0;
  for (const t of tiers) {
    acc += Math.max(0, t.weight);
    if (roll <= acc) return t.tier;
  }
  return 'Common';
}

export function pickNearMiss(tier: RarityTier): RarityTier {
  if (tier === 'Common') return 'Rare';
  if (tier === 'Rare') return 'Epic';
  if (tier === 'Epic') return Math.random() < 0.4 ? 'Legendary' : 'Mythic';
  if (tier === 'Legendary') return Math.random() < 0.5 ? 'Mythic' : 'God Tier';
  if (tier === 'Mythic') return 'God Tier';
  return 'God Tier';
}
