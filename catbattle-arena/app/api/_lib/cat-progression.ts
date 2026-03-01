export const CAT_LEVEL_CAP = 30;

export const FORGE_COST_BY_RARITY: Record<string, number> = {
  Common: 60,
  Rare: 140,
  Epic: 320,
  Legendary: 700,
};

const RARITY_ORDER = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic', 'God-Tier'] as const;

export function nextRarity(rarity: string): string | null {
  const idx = RARITY_ORDER.indexOf((rarity || 'Common') as (typeof RARITY_ORDER)[number]);
  if (idx < 0 || idx >= RARITY_ORDER.length - 2) return null; // cap forge at Mythic
  return RARITY_ORDER[idx + 1];
}

export function xpToNext(level: number): number {
  return Math.max(120, level * 130);
}

export async function grantPendingCatXp(supabase: any, userId: string, amount: number): Promise<number> {
  const gain = Math.max(0, Math.floor(Number(amount || 0)));
  if (!gain) return 0;

  const { data: row } = await supabase
    .from('cat_xp_pools')
    .select('pending_xp')
    .eq('user_id', userId)
    .maybeSingle();
  const next = Math.max(0, Number(row?.pending_xp || 0) + gain);

  const { error } = await supabase
    .from('cat_xp_pools')
    .upsert({ user_id: userId, pending_xp: next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) return 0;
  return gain;
}

async function writeCatProgress(supabase: any, catId: string, level: number, xp: number): Promise<void> {
  let { error } = await supabase
    .from('cats')
    .update({ cat_level: level, cat_xp: xp, level, xp })
    .eq('id', catId);
  if (!error) return;

  ({ error } = await supabase
    .from('cats')
    .update({ cat_level: level, cat_xp: xp })
    .eq('id', catId));
  if (!error) return;

  await supabase
    .from('cats')
    .update({ level, xp })
    .eq('id', catId);
}

export async function applyCatXpByAmount(
  supabase: any,
  catId: string,
  rawAmount: number
): Promise<{ applied_xp: number; level: number; remaining_xp: number }> {
  const amount = Math.max(0, Math.floor(Number(rawAmount || 0)));
  if (!amount) {
    const { data: cat } = await supabase
      .from('cats')
      .select('cat_level, cat_xp, level, xp')
      .eq('id', catId)
      .maybeSingle();
    const level = Math.max(1, Number(cat?.cat_level || cat?.level || 1));
    const xp = Math.max(0, Number(cat?.cat_xp || cat?.xp || 0));
    return { applied_xp: 0, level, remaining_xp: xp };
  }

  const { data: catRow } = await supabase
    .from('cats')
    .select('id, cat_level, cat_xp, level, xp')
    .eq('id', catId)
    .maybeSingle();
  if (!catRow) return { applied_xp: 0, level: 1, remaining_xp: 0 };

  let level = Math.max(1, Number(catRow.cat_level || catRow.level || 1));
  let xp = Math.max(0, Number(catRow.cat_xp || catRow.xp || 0)) + amount;

  while (level < CAT_LEVEL_CAP && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
  }

  await writeCatProgress(supabase, catId, level, xp);
  return { applied_xp: amount, level, remaining_xp: xp };
}

export async function allocatePendingCatXp(
  supabase: any,
  userId: string,
  catId: string,
  requestedAmount?: number
): Promise<{ applied_xp: number; remaining_pool: number; level: number; cat_xp: number }> {
  const [{ data: poolRow }, { data: catRow }] = await Promise.all([
    supabase.from('cat_xp_pools').select('pending_xp').eq('user_id', userId).maybeSingle(),
    supabase.from('cats').select('id, user_id').eq('id', catId).maybeSingle(),
  ]);

  if (!catRow || String(catRow.user_id || '') !== userId) {
    throw new Error('Cat not found or not owned by you');
  }

  const pool = Math.max(0, Number(poolRow?.pending_xp || 0));
  if (!pool) return { applied_xp: 0, remaining_pool: 0, level: 1, cat_xp: 0 };

  const want = requestedAmount == null ? pool : Math.max(0, Math.floor(Number(requestedAmount || 0)));
  const applied = Math.max(0, Math.min(pool, want || pool));
  if (!applied) {
    const { data: cat } = await supabase.from('cats').select('cat_level, cat_xp, level, xp').eq('id', catId).maybeSingle();
    return {
      applied_xp: 0,
      remaining_pool: pool,
      level: Math.max(1, Number(cat?.cat_level || cat?.level || 1)),
      cat_xp: Math.max(0, Number(cat?.cat_xp || cat?.xp || 0)),
    };
  }

  const nextPool = pool - applied;
  await supabase
    .from('cat_xp_pools')
    .upsert({ user_id: userId, pending_xp: nextPool, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

  const result = await applyCatXpByAmount(supabase, catId, applied);
  return { applied_xp: applied, remaining_pool: nextPool, level: result.level, cat_xp: result.remaining_xp };
}
