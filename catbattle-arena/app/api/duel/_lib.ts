import { createClient } from '@supabase/supabase-js';

export const duelSb = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

type CatStats = {
  id: string;
  rarity: string | null;
  attack: number | null;
  defense: number | null;
  speed: number | null;
  charisma: number | null;
  chaos: number | null;
};

function rarityBoost(rarity: string | null): number {
  if (rarity === 'God-Tier') return 1.12;
  if (rarity === 'Mythic') return 1.1;
  if (rarity === 'Legendary') return 1.08;
  if (rarity === 'Epic') return 1.05;
  if (rarity === 'Rare') return 1.03;
  return 1;
}

export function duelPower(cat: CatStats): number {
  const atk = Math.max(0, Number(cat.attack || 0));
  const def = Math.max(0, Number(cat.defense || 0));
  const spd = Math.max(0, Number(cat.speed || 0));
  const cha = Math.max(0, Number(cat.charisma || 0));
  const chaos = Math.max(0, Number(cat.chaos || 0));
  return (atk * 1.28 + def * 1.14 + spd * 1.19 + cha * 0.88 + chaos * 1.1) * rarityBoost(cat.rarity);
}

export function chooseDuelWinner(catA: CatStats, catB: CatStats): string {
  const pA = duelPower(catA);
  const pB = duelPower(catB);
  const total = Math.max(1, pA + pB);
  const chanceA = pA / total;
  return Math.random() < chanceA ? catA.id : catB.id;
}
