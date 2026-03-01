import { computeHeadToHeadMoveBonus, computePowerRating } from '../../_lib/combat';

export type CombatProfile = {
  id: string;
  rarity: string | null;
  attack: number | null;
  defense: number | null;
  speed: number | null;
  charisma: number | null;
  chaos: number | null;
  cat_level: number | null;
  ability: string | null;
};

function n(v: number | null | undefined): number {
  return Number.isFinite(Number(v || 0)) ? Number(v || 0) : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function asCombatInput(profile: CombatProfile) {
  return {
    attack: profile.attack,
    defense: profile.defense,
    speed: profile.speed,
    charisma: profile.charisma,
    chaos: profile.chaos,
    rarity: profile.rarity,
    ability: profile.ability,
    level: profile.cat_level,
  };
}

export function computeStatVoteSwing(catA: CombatProfile, catB: CombatProfile): number {
  const inputA = asCombatInput(catA);
  const inputB = asCombatInput(catB);

  const powerA = computePowerRating(inputA);
  const powerB = computePowerRating(inputB);
  const moveA = computeHeadToHeadMoveBonus(inputA, inputB);
  const moveB = computeHeadToHeadMoveBonus(inputB, inputA);

  const powerGap = (powerA - powerB) / 58;
  const moveGap = (moveA - moveB) / 3.4;
  const tempoGap = (n(catA.speed) - n(catB.speed)) / 40;
  const chaosGap = (n(catA.chaos) - n(catB.chaos)) / 66;

  return clamp(powerGap + moveGap + tempoGap + chaosGap, -3.25, 3.25);
}

export function computePowerTieWinner(catA: CombatProfile, catB: CombatProfile): 'a' | 'b' {
  const powerA = computePowerRating(asCombatInput(catA));
  const powerB = computePowerRating(asCombatInput(catB));
  if (powerA === powerB) {
    return n(catA.speed) >= n(catB.speed) ? 'a' : 'b';
  }
  return powerA > powerB ? 'a' : 'b';
}
