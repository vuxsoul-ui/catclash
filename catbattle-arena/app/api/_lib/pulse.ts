import { createClient } from '@supabase/supabase-js';

const PULSE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const VOTE_LOCK_MS = 2 * 60 * 60 * 1000;

type PulseRow = {
  id: string;
  scheduled_at: string;
  locked_at: string;
  resolved_at: string | null;
  status: 'pending' | 'locked' | 'resolved' | 'failed';
};

export type PulseWindow = {
  pulse_id: string;
  scheduled_at: Date;
  locked_at: Date;
  is_locked: boolean;
  is_resolved: boolean;
  next_pulse_at: Date;
  time_until_lock: number;
  time_until_resolution: number;
  pulseKey: string;
  pulseStartAt: string;
  voteLocksAt: string;
  resolvesAt: string;
  seasonDurationDays: number;
  pulseDurationDays: number;
  voteLockHours: number;
  isLocked: boolean;
  isResolving: boolean;
};

function startOfUtcWeek(now = new Date()): Date {
  const d = new Date(now);
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

function buildPulseWindow(base: {
  pulseId: string;
  scheduledAt: Date;
  lockedAt: Date;
  isResolved: boolean;
  nextPulseAt: Date;
}, now = new Date()): PulseWindow {
  const scheduledAt = new Date(base.scheduledAt);
  const lockedAt = new Date(base.lockedAt);
  const nextPulseAt = new Date(base.nextPulseAt);
  const pulseStart = new Date(scheduledAt.getTime() - PULSE_DURATION_MS);
  const isLocked = now >= lockedAt && !base.isResolved;

  return {
    pulse_id: base.pulseId,
    scheduled_at: scheduledAt,
    locked_at: lockedAt,
    is_locked: isLocked,
    is_resolved: base.isResolved,
    next_pulse_at: nextPulseAt,
    time_until_lock: Math.max(0, lockedAt.getTime() - now.getTime()),
    time_until_resolution: Math.max(0, scheduledAt.getTime() - now.getTime()),
    pulseKey: scheduledAt.toISOString().slice(0, 10),
    pulseStartAt: pulseStart.toISOString(),
    voteLocksAt: lockedAt.toISOString(),
    resolvesAt: scheduledAt.toISOString(),
    seasonDurationDays: 28,
    pulseDurationDays: 7,
    voteLockHours: 2,
    isLocked,
    isResolving: base.isResolved || now >= scheduledAt,
  };
}

function fallbackPulseWindow(now = new Date()): PulseWindow {
  const pulseStart = startOfUtcWeek(now);
  const scheduledAt = new Date(pulseStart.getTime() + PULSE_DURATION_MS);
  const lockedAt = new Date(scheduledAt.getTime() - VOTE_LOCK_MS);
  return buildPulseWindow({
    pulseId: `fallback:${scheduledAt.toISOString().slice(0, 10)}`,
    scheduledAt,
    lockedAt,
    isResolved: false,
    nextPulseAt: scheduledAt,
  }, now);
}

function getSupabaseAdmin() {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\s/g, '').trim();
  const supabaseServiceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function computePulseWindow(now = new Date()): Promise<PulseWindow> {
  const fallback = fallbackPulseWindow(now);
  const supabase = getSupabaseAdmin();
  if (!supabase) return fallback;

  try {
    const { data, error } = await supabase
      .from('pulses')
      .select('id, scheduled_at, locked_at, resolved_at, status')
      .order('scheduled_at', { ascending: true })
      .limit(8);

    if (error || !(data || []).length) return fallback;

    const rows = (data || []) as PulseRow[];
    const unresolved = rows.filter((row) => row.status === 'pending' || row.status === 'locked');
    const active = unresolved.find((row) => new Date(row.scheduled_at).getTime() > now.getTime()) || null;
    const latestResolved = [...rows]
      .filter((row) => row.status === 'resolved' || !!row.resolved_at || new Date(row.scheduled_at).getTime() <= now.getTime())
      .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())[0] || null;
    const current = active || latestResolved;
    if (!current) return fallback;

    if (!active && latestResolved) {
      // If the most recent pulse is already resolved and there is no pending/locked
      // row yet, derive the next pulse instead of returning a stale past timestamp.
      let nextScheduledAt = new Date(latestResolved.scheduled_at);
      while (nextScheduledAt.getTime() <= now.getTime()) {
        nextScheduledAt = new Date(nextScheduledAt.getTime() + PULSE_DURATION_MS);
      }
      const nextLockedAt = new Date(nextScheduledAt.getTime() - VOTE_LOCK_MS);
      return buildPulseWindow({
        pulseId: `derived:${nextScheduledAt.toISOString().slice(0, 10)}`,
        scheduledAt: nextScheduledAt,
        lockedAt: nextLockedAt,
        isResolved: false,
        nextPulseAt: nextScheduledAt,
      }, now);
    }

    const scheduledAt = new Date(current.scheduled_at);
    const lockedAt = new Date(current.locked_at);
    const nextPending = unresolved[0] || current;

    return buildPulseWindow({
      pulseId: String(current.id || fallback.pulse_id),
      scheduledAt,
      lockedAt,
      isResolved: !!current.resolved_at || current.status === 'resolved',
      nextPulseAt: new Date(nextPending.scheduled_at),
    }, now);
  } catch {
    return fallback;
  }
}

export async function isPulseVotingLocked(now = new Date()) {
  return (await computePulseWindow(now)).isLocked;
}

export async function isPulseResolvable(now = new Date()) {
  return (await computePulseWindow(now)).isResolving;
}
