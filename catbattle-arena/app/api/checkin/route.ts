import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../_lib/guest';
import { evaluateAndMaybeQualifyFlame } from '../_lib/arenaFlame';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST() {
  try {
    const guestId = await getGuestId();
    if (!guestId) return NextResponse.json({ success: false, error: 'No session' }, { status: 401 });

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const flame = await evaluateAndMaybeQualifyFlame(supabase, guestId, 'status', new Date());

    return NextResponse.json({
      success: true,
      deprecated: true,
      message: 'Check-in is deprecated. Arena Flame now advances through gameplay actions.',
      guest_id: guestId,
      current_streak: flame.dayCount,
      already_checked_in: true,
      guild_leader_bonus_sigils: 0,
      xp_earned: 0,
      cat_xp_banked: 0,
      streak_milestone_hit: null,
      streak_milestone_sigils: 0,
      flame,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Server error', details: String(e) }, { status: 500 });
  }
}
