import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireGuestId } from '../../_lib/guest';
import { requireUsername } from '../../_lib/require-username';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const sb = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const SHARE_REWARD_SIGILS = 25;
const DAILY_CAP = 3;
const COOLDOWN_SECONDS = 60;

function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  try {
    let userId = '';
    try {
      userId = await requireGuestId();
    } catch {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    await sb.rpc('bootstrap_user', { p_user_id: userId });
    const usernameCheck = await requireUsername(sb, userId, 'claim share rewards');
    if (!usernameCheck.ok) return usernameCheck.response;

    const body = await request.json().catch(() => ({}));
    const catId = String(body?.cat_id || '').trim();
    const method = String(body?.method || 'share').trim().toLowerCase();
    if (!catId) return NextResponse.json({ ok: false, error: 'Missing cat_id' }, { status: 400 });
    if (method !== 'share' && method !== 'copy') return NextResponse.json({ ok: false, error: 'Invalid method' }, { status: 400 });

    const day = utcDayKey();
    const prefix = `share_reward:${day}:`;
    const { data: todayClaims, error: todayErr } = await sb
      .from('user_reward_claims')
      .select('reward_key, created_at')
      .eq('user_id', userId)
      .ilike('reward_key', `${prefix}%`)
      .order('created_at', { ascending: false });
    if (todayErr) return NextResponse.json({ ok: false, error: todayErr.message }, { status: 500 });

    const count = (todayClaims || []).length;
    if (count >= DAILY_CAP) {
      return NextResponse.json({
        ok: true,
        rewarded: false,
        reason: 'daily_cap_reached',
        shares_today: count,
        shares_remaining: 0,
        cooldown_seconds: 0,
      });
    }

    const latest = todayClaims?.[0]?.created_at ? new Date(String(todayClaims[0].created_at)).getTime() : 0;
    const nowMs = Date.now();
    const cooldownLeft = latest > 0 ? Math.max(0, COOLDOWN_SECONDS - Math.floor((nowMs - latest) / 1000)) : 0;
    if (cooldownLeft > 0) {
      return NextResponse.json({
        ok: true,
        rewarded: false,
        reason: 'cooldown',
        shares_today: count,
        shares_remaining: Math.max(0, DAILY_CAP - count),
        cooldown_seconds: cooldownLeft,
      });
    }

    const seq = count + 1;
    const claimKey = `${prefix}${seq}:${catId}:${method}`;
    const ins = await sb
      .from('user_reward_claims')
      .insert({ user_id: userId, reward_key: claimKey, reward_sigils: SHARE_REWARD_SIGILS });
    if (ins.error) {
      if (String(ins.error.code || '') === '23505') {
        return NextResponse.json({ ok: true, rewarded: false, reason: 'already_rewarded' });
      }
      return NextResponse.json({ ok: false, error: ins.error.message }, { status: 500 });
    }

    const { data: progress } = await sb
      .from('user_progress')
      .select('sigils')
      .eq('user_id', userId)
      .maybeSingle();
    const nextSigils = Number(progress?.sigils || 0) + SHARE_REWARD_SIGILS;
    await sb.from('user_progress').update({ sigils: nextSigils }).eq('user_id', userId);

    return NextResponse.json({
      ok: true,
      rewarded: true,
      sigils_awarded: SHARE_REWARD_SIGILS,
      sigils_after: nextSigils,
      shares_today: seq,
      shares_remaining: Math.max(0, DAILY_CAP - seq),
      cooldown_seconds: COOLDOWN_SECONDS,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
