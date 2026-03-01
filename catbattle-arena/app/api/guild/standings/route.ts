import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../_lib/guest';
import { computeGuildStandings } from '../../_lib/guilds';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim();

export async function GET() {
  try {
    const guestId = await getGuestId();
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const snapshot = await computeGuildStandings(supabase, guestId);

    return NextResponse.json({
      ok: true,
      day: snapshot.day,
      next_refresh_at: snapshot.nextRefreshAt,
      pledged_guild: snapshot.pledgedGuild,
      leader_guild: snapshot.leaderGuild,
      vote_xp_bonus: 1,
      leader_extra_xp_bonus: 1,
      leader_daily_sigils_bonus: 20,
      standings: snapshot.standings,
    }, { headers: { 'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate' } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
