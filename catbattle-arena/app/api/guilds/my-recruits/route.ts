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

export async function GET() {
  try {
    const userId = await getGuestId();
    if (!userId) return NextResponse.json({ ok: false, error: 'No session' }, { status: 401 });

    await sb.rpc('bootstrap_user', { p_user_id: userId });

    const [{ data: me }, { data: refs }] = await Promise.all([
      sb.from('profiles').select('guild').eq('id', userId).maybeSingle(),
      sb.from('social_referrals').select('recruit_user_id, claimable_sigils, total_sigils_earned').eq('referrer_user_id', userId),
    ]);

    const guild = me?.guild === 'sun' || me?.guild === 'moon' ? me.guild : null;
    const recruitIds = (refs || []).map((r) => String(r.recruit_user_id || '')).filter(Boolean);
    if (recruitIds.length === 0) {
      return NextResponse.json({ ok: true, guild, recruits: [], stats: { total_recruits: 0, same_guild_recruits: 0, claimable_pouch: 0 } });
    }

    const [{ data: profiles }, { data: progress }, { data: duels }] = await Promise.all([
      sb.from('profiles').select('id, username, guild').in('id', recruitIds),
      sb.from('user_progress').select('user_id, level').in('user_id', recruitIds),
      sb
        .from('duel_challenges')
        .select('id, status, challenger_user_id, challenged_user_id')
        .in('status', ['pending', 'voting'])
        .or(`and(challenger_user_id.eq.${userId},challenged_user_id.in.(${recruitIds.join(',')})),and(challenged_user_id.eq.${userId},challenger_user_id.in.(${recruitIds.join(',')}))`),
    ]);

    const profileMap = Object.fromEntries((profiles || []).map((p) => [String(p.id), p]));
    const levelMap = Object.fromEntries((progress || []).map((p) => [String(p.user_id), Number(p.level || 1)]));

    const activeByRecruit: Record<string, number> = {};
    for (const d of duels || []) {
      const a = String(d.challenger_user_id || '');
      const b = String(d.challenged_user_id || '');
      const rid = a === userId ? b : b === userId ? a : '';
      if (!rid) continue;
      activeByRecruit[rid] = (activeByRecruit[rid] || 0) + 1;
    }

    const recruits = recruitIds
      .map((rid) => {
        const p = profileMap[rid];
        return {
          user_id: rid,
          username: String(p?.username || `Player ${rid.slice(0, 8)}`),
          guild: p?.guild || null,
          level: levelMap[rid] || 1,
          same_guild: !!guild && !!p?.guild && String(p.guild) === String(guild),
          active_duels: activeByRecruit[rid] || 0,
          claimable_sigils: Math.max(0, Number((refs || []).find((x) => String(x.recruit_user_id) === rid)?.claimable_sigils || 0)),
          total_sigils_earned: Math.max(0, Number((refs || []).find((x) => String(x.recruit_user_id) === rid)?.total_sigils_earned || 0)),
        };
      })
      .sort((a, b) => Number(b.same_guild) - Number(a.same_guild));

    const claimablePouch = (refs || []).reduce((acc, row) => acc + Math.max(0, Number(row.claimable_sigils || 0)), 0);

    return NextResponse.json({
      ok: true,
      guild,
      recruits,
      stats: {
        total_recruits: recruits.length,
        same_guild_recruits: recruits.filter((r) => r.same_guild).length,
        claimable_pouch: claimablePouch,
      },
    }, { headers: { 'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate' } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
