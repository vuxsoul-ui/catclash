export type StatBlock = {
  attack: number;
  defense: number;
  speed: number;
  charisma: number;
  chaos: number;
};

type RarityStatConfig = {
  min: number;
  max: number;
  budget: number;
};

const RARITY_CONFIG: Record<string, RarityStatConfig> = {
  Common: { min: 30, max: 55, budget: 215 },
  Rare: { min: 45, max: 70, budget: 265 },
  Epic: { min: 55, max: 82, budget: 320 },
  Legendary: { min: 68, max: 92, budget: 375 },
  Mythic: { min: 78, max: 96, budget: 420 },
  "God-Tier": { min: 88, max: 99, budget: 470 },
};

const STAT_KEYS: Array<keyof StatBlock> = ["attack", "defense", "speed", "charisma", "chaos"];

function getConfig(rarity: string): RarityStatConfig {
  return RARITY_CONFIG[rarity] || RARITY_CONFIG.Common;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(v)));
}

export function rarityBounds(rarity: string): { min: number; max: number; budget: number } {
  const cfg = getConfig(rarity);
  return { min: cfg.min, max: cfg.max, budget: cfg.budget };
}

export function normalizeStatsForRarity(rarity: string, raw: Partial<StatBlock>): StatBlock {
  const cfg = getConfig(rarity);
  const next: StatBlock = {
    attack: clamp(Number(raw.attack || 0), cfg.min, cfg.max),
    defense: clamp(Number(raw.defense || 0), cfg.min, cfg.max),
    speed: clamp(Number(raw.speed || 0), cfg.min, cfg.max),
    charisma: clamp(Number(raw.charisma || 0), cfg.min, cfg.max),
    chaos: clamp(Number(raw.chaos || 0), cfg.min, cfg.max),
  };

  let total = STAT_KEYS.reduce((sum, k) => sum + next[k], 0);
  if (total <= cfg.budget) return next;

  // Pull overflow from whichever stats sit furthest above the rarity floor.
  let overflow = total - cfg.budget;
  while (overflow > 0) {
    let reducedAny = false;
    for (const key of STAT_KEYS) {
      if (overflow <= 0) break;
      const room = next[key] - cfg.min;
      if (room <= 0) continue;
      const step = Math.min(room, Math.max(1, Math.ceil(overflow / 6)));
      next[key] -= step;
      overflow -= step;
      reducedAny = true;
    }
    if (!reducedAny) break;
  }

  total = STAT_KEYS.reduce((sum, k) => sum + next[k], 0);
  if (total > cfg.budget) {
    for (const key of STAT_KEYS) {
      if (total <= cfg.budget) break;
      const room = next[key] - cfg.min;
      if (room <= 0) continue;
      const step = Math.min(room, total - cfg.budget);
      next[key] -= step;
      total -= step;
    }
  }

  return next;
}
