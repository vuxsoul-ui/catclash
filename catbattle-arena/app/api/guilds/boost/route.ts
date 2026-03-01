import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../_lib/guest';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const sb = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function dayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function computeBoost(userId: string) {
  await sb.rpc('bootstrap_user', { p_user_id: userId });

  const [{ data: me }, { data: refs }] = await Promise.all([
    sb.from('profiles').select('guild').eq('id', userId).maybeSingle(),
    sb.from('social_referrals').select('recruit_user_id').eq('referrer_user_id', userId),
  ]);

  const guild = me?.guild === 'sun' || me?.guild === 'moon' ? me.guild : null;
  const recruitIds = (refs || []).map((r) => String(r.recruit_user_id || '')).filter(Boolean);
  if (!guild || recruitIds.length === 0) {
    return { guild, recruits: 0, recruits_in_guild: 0, votes_today: 0, value_boost: 0, trainer_cut_pct: 10, day: dayKey() };
  }

  const [{ data: recruitProfiles }, { data: votes }] = await Promise.all([
    sb.from('profiles').select('id, guild').in('id', recruitIds),
    sb.from('votes').select('voter_user_id').in('voter_user_id', recruitIds).gte('created_at', `${dayKey()}T00:00:00.000Z`),
  ]);

  const sameGuildIds = new Set(
    (recruitProfiles || [])
      .filter((p) => String(p.guild || '') === String(guild))
      .map((p) => String(p.id))
  );

  let votesToday = 0;
  for (const v of votes || []) {
    if (sameGuildIds.has(String(v.voter_user_id || ''))) votesToday += 1;
  }

  return {
    guild,
    recruits: recruitIds.length,
    recruits_in_guild: sameGuildIds.size,
    votes_today: votesToday,
    value_boost: votesToday * 5,
    trainer_cut_pct: 10,
    day: dayKey(),
  };
}

export async function GET() {
  try {
    const userId = await getGuestId();
    if (!userId) return NextResponse.json({ ok: false, error: 'No session' }, { status: 401 });
    const data = await computeBoost(userId);
    return NextResponse.json({ ok: true, ...data }, { headers: { 'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate' } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
