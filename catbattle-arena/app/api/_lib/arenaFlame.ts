import type { SupabaseClient } from '@supabase/supabase-js';

export type FlameState = 'active' | 'fading' | 'expired';

export type FlameProgress = {
  votesToday: number;
  predictionsToday: number;
  catsToday: number;
  qualifiesToday: boolean;
};

export type FlameSnapshot = {
  dayCount: number;
  state: FlameState;
  lastFlameDate: string | null;
  qualifiesToday: boolean;
  todayProgress: FlameProgress;
  fadingExpiresAt: string | null;
  secondsRemaining: number | null;
  nextMilestone: {
    nextDay: number;
    daysRemaining: number;
  };
};

export type FlameRow = {
  current_streak: number | null;
  last_claim_date: string | null;
  flame_state: string | null;
  last_flame_date: string | null;
  fading_expires_at: string | null;
  flame_heat: number | null;
};

const MILESTONES = [1, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90];
const FADING_HOURS = 18;

function toDayKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getUtcDayKey(nowUtc = new Date()): string {
  return toDayKey(nowUtc);
}

export function getUtcDayStartIso(dayKey: string): string {
  return `${dayKey}T00:00:00.000Z`;
}

export function getUtcNextDayStartIso(dayKey: string): string {
  const d = new Date(`${dayKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

function addUtcDays(dayKey: string, days: number): string {
  const d = new Date(`${dayKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toDayKey(d);
}

function normalizeState(value: string | null | undefined): FlameState {
  if (value === 'fading' || value === 'expired') return value;
  return 'active';
}

function toIsoOrNull(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function secondsRemaining(nowUtc: Date, expiresAtIso: string | null, state: FlameState): number | null {
  if (state !== 'fading' || !expiresAtIso) return null;
  const ms = new Date(expiresAtIso).getTime() - nowUtc.getTime();
  return ms > 0 ? Math.floor(ms / 1000) : 0;
}

export function nextFlameMilestone(dayCount: number): { nextDay: number; daysRemaining: number } {
  for (const m of MILESTONES) {
    if (dayCount < m) return { nextDay: m, daysRemaining: m - dayCount };
  }
  const nextDay = MILESTONES[MILESTONES.length - 1];
  return { nextDay, daysRemaining: 0 };
}

export function computeFlameTransition(
  row: FlameRow,
  nowUtc: Date,
  progress: FlameProgress
): {
  updates: Partial<FlameRow>;
  changed: boolean;
  dayCount: number;
  state: FlameState;
  lastFlameDate: string | null;
  fadingExpiresAt: string | null;
} {
  const dayKey = getUtcDayKey(nowUtc);
  let dayCount = Math.max(0, Number(row.current_streak || 0));
  let state = normalizeState(row.flame_state);
  // IMPORTANT:
  // Do not carry over legacy check-in state from last_claim_date.
  // Arena Flame should only use flame-specific date tracking.
  let lastFlameDate = row.last_flame_date || null;
  let fadingExpiresAt = toIsoOrNull(row.fading_expires_at);
  let changed = false;
  const updates: Partial<FlameRow> = {};

  // Legacy streak migration guard:
  // if flame has never been initialized (no last_flame_date), start from 0 days.
  if (!lastFlameDate && dayCount > 0) {
    dayCount = 0;
    updates.current_streak = 0;
    updates.last_claim_date = null;
    changed = true;
  }

  if (state === 'fading' && fadingExpiresAt && nowUtc.getTime() > new Date(fadingExpiresAt).getTime()) {
    state = 'expired';
    fadingExpiresAt = null;
    updates.flame_state = 'expired';
    updates.fading_expires_at = null;
    changed = true;
  }

  if (!progress.qualifiesToday) {
    return { updates, changed, dayCount, state, lastFlameDate, fadingExpiresAt };
  }

  if (state === 'expired') {
    dayCount = 1;
    state = 'active';
    lastFlameDate = dayKey;
    fadingExpiresAt = null;
    updates.current_streak = dayCount;
    updates.flame_state = state;
    updates.last_flame_date = lastFlameDate;
    updates.last_claim_date = lastFlameDate;
    updates.fading_expires_at = null;
    changed = true;
    return { updates, changed, dayCount, state, lastFlameDate, fadingExpiresAt };
  }

  if (!lastFlameDate) {
    dayCount = 1;
    state = 'active';
    lastFlameDate = dayKey;
    fadingExpiresAt = null;
    updates.current_streak = dayCount;
    updates.flame_state = state;
    updates.last_flame_date = lastFlameDate;
    updates.last_claim_date = lastFlameDate;
    updates.fading_expires_at = null;
    changed = true;
    return { updates, changed, dayCount, state, lastFlameDate, fadingExpiresAt };
  }

  if (dayKey === lastFlameDate) {
    return { updates, changed, dayCount, state, lastFlameDate, fadingExpiresAt };
  }

  if (dayKey === addUtcDays(lastFlameDate, 1)) {
    dayCount += 1;
    state = 'active';
    lastFlameDate = dayKey;
    fadingExpiresAt = null;
    updates.current_streak = dayCount;
    updates.flame_state = state;
    updates.last_flame_date = lastFlameDate;
    updates.last_claim_date = lastFlameDate;
    updates.fading_expires_at = null;
    changed = true;
    return { updates, changed, dayCount, state, lastFlameDate, fadingExpiresAt };
  }

  if (state !== 'fading') {
    state = 'fading';
    fadingExpiresAt = new Date(nowUtc.getTime() + FADING_HOURS * 60 * 60 * 1000).toISOString();
    updates.flame_state = 'fading';
    updates.fading_expires_at = fadingExpiresAt;
    changed = true;
    return { updates, changed, dayCount, state, lastFlameDate, fadingExpiresAt };
  }

  if (fadingExpiresAt && nowUtc.getTime() <= new Date(fadingExpiresAt).getTime()) {
    state = 'active';
    lastFlameDate = dayKey;
    fadingExpiresAt = null;
    updates.flame_state = 'active';
    updates.last_flame_date = lastFlameDate;
    updates.last_claim_date = lastFlameDate;
    updates.fading_expires_at = null;
    changed = true;
    return { updates, changed, dayCount, state, lastFlameDate, fadingExpiresAt };
  }

  dayCount = 1;
  state = 'active';
  lastFlameDate = dayKey;
  fadingExpiresAt = null;
  updates.flame_state = 'active';
  updates.current_streak = dayCount;
  updates.last_flame_date = lastFlameDate;
  updates.last_claim_date = lastFlameDate;
  updates.fading_expires_at = null;
  changed = true;
  return { updates, changed, dayCount, state, lastFlameDate, fadingExpiresAt };
}

export async function getTodayFlameProgress(
  supabase: SupabaseClient,
  userId: string,
  nowUtc = new Date()
): Promise<FlameProgress> {
  const dayKey = getUtcDayKey(nowUtc);
  const startIso = getUtcDayStartIso(dayKey);
  const nextIso = getUtcNextDayStartIso(dayKey);

  const [{ count: votesToday }, { count: predictionsToday }, { count: catsToday }] = await Promise.all([
    supabase
      .from('votes')
      .select('id', { head: true, count: 'exact' })
      .eq('voter_user_id', userId)
      .gte('created_at', startIso)
      .lt('created_at', nextIso),
    supabase
      .from('match_predictions')
      .select('id', { head: true, count: 'exact' })
      .eq('voter_user_id', userId)
      .gte('created_at', startIso)
      .lt('created_at', nextIso),
    supabase
      .from('cats')
      .select('id', { head: true, count: 'exact' })
      .eq('user_id', userId)
      .gte('created_at', startIso)
      .lt('created_at', nextIso),
  ]);

  const progress = {
    votesToday: Number(votesToday || 0),
    predictionsToday: Number(predictionsToday || 0),
    catsToday: Number(catsToday || 0),
    qualifiesToday: false,
  };
  progress.qualifiesToday = progress.votesToday >= 5 || progress.predictionsToday >= 1 || progress.catsToday >= 1;
  return progress;
}

export async function evaluateAndMaybeQualifyFlame(
  supabase: SupabaseClient,
  userId: string,
  _actionType: 'vote' | 'prediction' | 'submit' | 'adopt' | 'status',
  nowUtc = new Date()
): Promise<FlameSnapshot> {
  await supabase.rpc('bootstrap_user', { p_user_id: userId });

  const { data: streakRow } = await supabase
    .from('streaks')
    .select('current_streak, last_claim_date, flame_state, last_flame_date, fading_expires_at, flame_heat')
    .eq('user_id', userId)
    .maybeSingle();

  const baseRow: FlameRow = {
    current_streak: Number(streakRow?.current_streak || 0),
    last_claim_date: streakRow?.last_claim_date || null,
    flame_state: streakRow?.flame_state || 'active',
    // Never inherit legacy check-in date into Arena Flame state.
    last_flame_date: streakRow?.last_flame_date || null,
    fading_expires_at: streakRow?.fading_expires_at || null,
    flame_heat: Number(streakRow?.flame_heat || 0),
  };

  const progress = await getTodayFlameProgress(supabase, userId, nowUtc);
  const transition = computeFlameTransition(baseRow, nowUtc, progress);

  if (transition.changed) {
    await supabase
      .from('streaks')
      .update({
        ...transition.updates,
        updated_at: nowUtc.toISOString(),
      })
      .eq('user_id', userId);
  }

  const state = transition.state;
  const remaining = secondsRemaining(nowUtc, transition.fadingExpiresAt, state);
  return {
    dayCount: transition.dayCount,
    state,
    lastFlameDate: transition.lastFlameDate,
    qualifiesToday: progress.qualifiesToday,
    todayProgress: progress,
    fadingExpiresAt: transition.fadingExpiresAt,
    secondsRemaining: remaining,
    nextMilestone: nextFlameMilestone(transition.dayCount),
  };
}
