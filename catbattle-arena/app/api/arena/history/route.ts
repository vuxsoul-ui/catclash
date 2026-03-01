import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../_lib/guest';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim();

export async function GET() {
  try {
    const userId = await getGuestId();
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: matches, error } = await supabase
      .from('arena_matches')
      .select('id, challenger_user_id, snapshot_a_id, opponent_cat_id, opponent_name, winner_snapshot_id, status, turns, rating_delta, summary, created_at')
      .eq('challenger_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) {
      const msg = error.message || 'History failed';
      const lower = msg.toLowerCase();
      if ((lower.includes('relation') && lower.includes('arena_matches')) || lower.includes('could not find the table')) {
        return NextResponse.json({ ok: true, matches: [], arena_uninitialized: true });
      }
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }

    const { data: rating } = await supabase
      .from('arena_ratings')
      .select('rating, tier, wins, losses')
      .eq('user_id', userId)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      matches: matches || [],
      rating: rating || { rating: 1000, tier: 'bronze', wins: 0, losses: 0 },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
