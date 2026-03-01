import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireGuestId } from '../../_lib/guest';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const sb = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const DAILY_SIGILS = 20;

function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function addDays(dayKey: string, days: number): string {
  const d = new Date(`${dayKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function streakFromClaims(today: string, keys: string[]): number {
  const set = new Set(keys.map((k) => k.replace('daily_visit:', '')));
  let streak = 1;
  let cursor = addDays(today, -1);
  while (set.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export async function POST() {
  try {
    let userId = '';
    try {
      userId = await requireGuestId();
    } catch {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    await sb.rpc('bootstrap_user', { p_user_id: userId });

    const today = utcDayKey();
    const claimKey = `daily_visit:${today}`;

    const { data: already } = await sb
      .from('user_reward_claims')
      .select('reward_key')
      .eq('user_id', userId)
      .eq('reward_key', claimKey)
      .maybeSingle();

    if (already?.reward_key) {
      return NextResponse.json({ ok: true, already_claimed: true });
    }

    const { data: priorClaims } = await sb
      .from('user_reward_claims')
      .select('reward_key')
      .eq('user_id', userId)
      .ilike('reward_key', 'daily_visit:%')
      .order('created_at', { ascending: false })
      .limit(30);

    const streakDay = streakFromClaims(today, (priorClaims || []).map((r) => String(r.reward_key || '')));
    const ins = await sb
      .from('user_reward_claims')
      .insert({ user_id: userId, reward_key: claimKey, reward_sigils: DAILY_SIGILS });
    if (ins.error) {
      if (String(ins.error.code || '') === '23505') {
        return NextResponse.json({ ok: true, already_claimed: true });
      }
      return NextResponse.json({ ok: false, error: ins.error.message }, { status: 500 });
    }

    const { data: progress } = await sb.from('user_progress').select('sigils').eq('user_id', userId).maybeSingle();
    const nextSigils = Number(progress?.sigils || 0) + DAILY_SIGILS;
    await sb.from('user_progress').update({ sigils: nextSigils }).eq('user_id', userId);

    // Timestamp-based tracking when credentials exist.
    await sb
      .from('auth_credentials')
      .update({ last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    return NextResponse.json({
      ok: true,
      already_claimed: false,
      day: streakDay,
      sigils_awarded: DAILY_SIGILS,
      sigils_after: nextSigils,
      next_hint: streakDay + 1 >= 3 ? 'Come back tomorrow for a Rare Crate.' : 'Come back tomorrow to keep your streak going.',
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
