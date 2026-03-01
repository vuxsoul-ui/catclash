import type { SupabaseClient } from '@supabase/supabase-js';

export const TACTIC_DAILY_TOKENS = 5;
export const PREDICTION_MATCH_CAP = 20;
export const PREDICTION_DAILY_CAP = 100;
export const PREDICTION_HARD_DAILY_CAP = 500;
export const PREDICTION_HOUSE_FACTOR = 0.93;
export const PREDICTION_UNDERDOG_THRESHOLD = 0.35;
export const PREDICTION_UNDERDOG_BONUS_PCT = 5;

export type TacticAction = 'scout' | 'cheer' | 'guard_break';

export function isRelationMissingError(err: unknown): boolean {
  const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message?: string }).message || '') : '';
  return msg.includes('relation') && msg.includes('does not exist');
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

export async function getRemainingTacticTokens(supabase: SupabaseClient, userId: string): Promise<number> {
  const key = `tactic_tokens:${userId}:${todayUtc()}`;
  const { data, error } = await supabase
    .from('rate_limits')
    .select('count')
    .eq('key', key)
    .maybeSingle();

  if (error) return 0;
  if (!data) {
    await supabase.from('rate_limits').insert({ key, count: TACTIC_DAILY_TOKENS, window_start: new Date().toISOString() });
    return TACTIC_DAILY_TOKENS;
  }
  return Math.max(0, data.count || 0);
}

export async function consumeTacticToken(supabase: SupabaseClient, userId: string): Promise<{ ok: boolean; remaining: number }> {
  const key = `tactic_tokens:${userId}:${todayUtc()}`;
  const remaining = await getRemainingTacticTokens(supabase, userId);
  if (remaining <= 0) return { ok: false, remaining: 0 };
  const next = remaining - 1;
  await supabase.from('rate_limits').upsert({ key, count: next, window_start: new Date().toISOString() }, { onConflict: 'key' });
  return { ok: true, remaining: next };
}

export async function getTacticalSummaryForMatches(
  supabase: SupabaseClient,
  matchIds: string[]
): Promise<Record<string, { by_cat: Record<string, number>; clutch_by_cat: Record<string, number>; total_actions: number }>> {
  const summary: Record<string, { by_cat: Record<string, number>; clutch_by_cat: Record<string, number>; total_actions: number }> = {};
  if (matchIds.length === 0) return summary;

  const { data, error } = await supabase
    .from('match_tactics')
    .select('match_id, cat_id, action_type, influence_value')
    .in('match_id', matchIds);

  if (error) return summary;

  for (const t of data || []) {
    if (!summary[t.match_id]) summary[t.match_id] = { by_cat: {}, clutch_by_cat: {}, total_actions: 0 };
    const s = summary[t.match_id];
    const val = t.influence_value || 0;
    s.by_cat[t.cat_id] = (s.by_cat[t.cat_id] || 0) + val;
    if (t.action_type !== 'scout') {
      const current = s.clutch_by_cat[t.cat_id] || 0;
      s.clutch_by_cat[t.cat_id] = Math.min(2, current + val);
    }
    s.total_actions += 1;
  }

  return summary;
}

export async function getUserPredictionDailyUsed(supabase: SupabaseClient, userId: string): Promise<number> {
  const start = `${todayUtc()}T00:00:00.000Z`;
  const end = `${todayUtc()}T23:59:59.999Z`;
  const { data, error } = await supabase
    .from('match_predictions')
    .select('bet_sigils')
    .eq('voter_user_id', userId)
    .gte('created_at', start)
    .lte('created_at', end);

  if (error) return 0;
  return (data || []).reduce((sum, row) => sum + (row.bet_sigils || 0), 0);
}

export function stanceBonus(
  stance: string | null | undefined,
  catStats: { attack?: number | null; defense?: number | null; chaos?: number | null },
  oppStats: { attack?: number | null; defense?: number | null; chaos?: number | null }
): number {
  const s = (stance || '').toLowerCase();
  if (s === 'aggro') return (catStats.attack || 0) > (oppStats.defense || 0) ? 1 : 0;
  if (s === 'guard') return (catStats.defense || 0) >= (oppStats.attack || 0) ? 1 : 0;
  if (s === 'chaos') return Math.random() < 0.45 ? 1 : 0;
  return 0;
}

export function predictionStreakBonusPct(currentStreak: number): number {
  if (currentStreak >= 8) return 20;
  if (currentStreak >= 5) return 15;
  if (currentStreak >= 3) return 10;
  if (currentStreak >= 2) return 5;
  return 0;
}

export function computePredictionDailyCap(currentSigils: number): number {
  const pctCap = Math.floor(Math.max(0, Number(currentSigils || 0)) * 0.1);
  return Math.max(5, Math.min(PREDICTION_HARD_DAILY_CAP, pctCap || 0));
}

export function impliedProbability(
  predictedIsA: boolean,
  votesA: number | null | undefined,
  votesB: number | null | undefined
): number {
  const a = Math.max(0, Number(votesA || 0)) + 1;
  const b = Math.max(0, Number(votesB || 0)) + 1;
  const total = a + b;
  const pA = total > 0 ? a / total : 0.5;
  const p = predictedIsA ? pA : 1 - pA;
  return Math.min(0.95, Math.max(0.05, p));
}

export function predictionMultiplierFromProbability(probability: number): number {
  const p = Math.min(0.95, Math.max(0.05, Number(probability || 0.5)));
  return (1 / p) * PREDICTION_HOUSE_FACTOR;
}

export function underdogBonusPct(probability: number): number {
  return probability < PREDICTION_UNDERDOG_THRESHOLD ? PREDICTION_UNDERDOG_BONUS_PCT : 0;
}
