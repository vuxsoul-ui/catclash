export type CombatInput = {
  attack?: number | null;
  defense?: number | null;
  speed?: number | null;
  charisma?: number | null;
  chaos?: number | null;
  rarity?: string | null;
  ability?: string | null;
  level?: number | null;
};

export type MoveMeaning = {
  name: string;
  short: string;
  effect: string;
};

function n(v: number | null | undefined): number {
  return Math.max(0, Number(v || 0));
}

function softCapStat(v: number): number {
  if (v <= 70) return v;
  if (v <= 90) return 70 + (v - 70) * 0.66;
  return 83.2 + (v - 90) * 0.34;
}

function rarityMultiplier(rarity: string | null | undefined): number {
  const r = String(rarity || "Common").toLowerCase();
  if (r === "rare") return 1.03;
  if (r === "epic") return 1.07;
  if (r === "legendary") return 1.11;
  if (r === "mythic") return 1.16;
  if (r === "god-tier") return 1.22;
  return 1;
}

function moveKey(ability: string | null | undefined): string {
  return String(ability || "").trim().toLowerCase();
}

export function getMoveMeaning(ability: string | null | undefined): MoveMeaning {
  const key = moveKey(ability);
  if (key.includes("starter instinct")) {
    return {
      name: "Starter Instinct",
      short: "Adaptive opener",
      effect: "Boosts balanced builds and clutch defense.",
    };
  }
  if (key.includes("blink pounce")) {
    return {
      name: "Blink Pounce",
      short: "Speed burst",
      effect: "Converts speed into burst pressure and first-hit edge.",
    };
  }
  if (key.includes("first fang")) {
    return { name: "First Fang", short: "Opening bite", effect: "Early attack spike with chaos follow-through." };
  }
  if (key.includes("iron whiskers")) {
    return { name: "Iron Whiskers", short: "Tank stance", effect: "Leans into defense and attrition wins." };
  }
  if (key.includes("chaos thread")) {
    return { name: "Chaos Thread", short: "Entropy tap", effect: "Amplifies high-chaos volatility and swing turns." };
  }
  const label = String(ability || "Instinct");
  return { name: label, short: "Move", effect: "Adds tactical pressure based on your stat profile." };
}

function movePowerBonus(input: CombatInput): number {
  const atk = softCapStat(n(input.attack));
  const def = softCapStat(n(input.defense));
  const spd = softCapStat(n(input.speed));
  const cha = softCapStat(n(input.charisma));
  const chs = softCapStat(n(input.chaos));
  const minStat = Math.min(atk, def, spd, cha, chs);
  const key = moveKey(input.ability);

  if (key.includes("starter instinct")) {
    return minStat * 0.45 + Math.sqrt(def * cha) * 0.25 + chs * 0.1;
  }
  if (key.includes("blink pounce")) {
    return spd * 0.48 + Math.sqrt(spd * atk) * 0.28 + Math.max(0, spd - def) * 0.2;
  }
  if (key.includes("first fang")) {
    return atk * 0.42 + chs * 0.18;
  }
  if (key.includes("iron whiskers")) {
    return def * 0.4 + cha * 0.2;
  }
  if (key.includes("chaos thread")) {
    return chs * 0.44 + Math.sqrt(chs * cha) * 0.24;
  }
  return 4;
}

export function computePowerRating(input: CombatInput): number {
  const atkRaw = n(input.attack);
  const defRaw = n(input.defense);
  const spdRaw = n(input.speed);
  const chaRaw = n(input.charisma);
  const chsRaw = n(input.chaos);
  const atk = softCapStat(atkRaw);
  const def = softCapStat(defRaw);
  const spd = softCapStat(spdRaw);
  const cha = softCapStat(chaRaw);
  const chs = softCapStat(chsRaw);
  const level = Math.max(1, Number(input.level || 1));

  const base = atk * 1.22 + def * 1.12 + spd * 1.2 + cha * 0.86 + chs * 1.1;
  const offenseSynergy = Math.sqrt(atk * spd) * 0.62;
  const controlSynergy = Math.sqrt(cha * chs) * 0.46;
  const stabilitySynergy = Math.sqrt(def * cha) * 0.36;
  const minStat = Math.min(atkRaw, defRaw, spdRaw, chaRaw, chsRaw);
  const maxStat = Math.max(atkRaw, defRaw, spdRaw, chaRaw, chsRaw);
  const balanceBonus = minStat * 0.38;
  const overstackPenalty = Math.max(0, maxStat - minStat - 28) * 0.26;
  const levelMult = 1 + Math.min(level, 40) * 0.009 + Math.max(0, level - 40) * 0.002;

  const raw =
    (base + offenseSynergy + controlSynergy + stabilitySynergy + balanceBonus + movePowerBonus(input) - overstackPenalty) *
    rarityMultiplier(input.rarity) *
    levelMult;

  return Math.max(1, Math.round(raw));
}

export function computeHeadToHeadMoveBonus(self: CombatInput, opponent: CombatInput): number {
  const selfPower = computePowerRating(self);
  const oppPower = computePowerRating(opponent);
  const selfSpeed = softCapStat(n(self.speed));
  const oppSpeed = softCapStat(n(opponent.speed));
  const key = moveKey(self.ability);

  if (key.includes("starter instinct")) {
    const underdogGap = Math.max(0, oppPower - selfPower);
    return Math.min(12, 2 + underdogGap * 0.045);
  }
  if (key.includes("blink pounce")) {
    const speedGap = Math.max(0, selfSpeed - oppSpeed);
    return Math.min(12, 1.5 + speedGap * 0.2);
  }
  if (key.includes("first fang")) return 2.5;
  if (key.includes("iron whiskers")) return 2;
  if (key.includes("chaos thread")) return 2.2;
  return 0;
}
