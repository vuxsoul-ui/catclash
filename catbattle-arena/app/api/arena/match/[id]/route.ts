import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../../_lib/guest';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim();

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getGuestId();
    const { id } = await context.params;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: match, error } = await supabase
      .from('arena_matches')
      .select('id, challenger_user_id, snapshot_a_id, snapshot_b_id, opponent_name, winner_snapshot_id, winner_cat_id, status, turns, rating_delta, summary, created_at')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      const msg = error.message || 'Match lookup failed';
      const lower = msg.toLowerCase();
      if (lower.includes('could not find the table') || lower.includes('arena_matches')) {
        return NextResponse.json({ ok: false, error: 'Whisker Arena is not initialized. Run migration 016 first.' }, { status: 503 });
      }
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
    if (!match) return NextResponse.json({ ok: false, error: 'Match not found' }, { status: 404 });
    if (match.challenger_user_id !== userId) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });

    const { data: events, error: evErr } = await supabase
      .from('arena_events')
      .select('turn_no, actor_slot, action_type, value, payload, created_at')
      .eq('match_id', id)
      .order('turn_no', { ascending: true });
    if (evErr) return NextResponse.json({ ok: false, error: evErr.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      match,
      state: match.summary?.state || null,
      events: events || [],
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
