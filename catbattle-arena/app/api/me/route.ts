import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../_lib/guest';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: Request) {
  try {
    const guestId = getGuestId();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Bootstrap user if not exists
    await supabase.rpc('bootstrap_user', { p_user_id: guestId });
    
    const [profile, progress, streak, daily] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', guestId).single(),
      supabase.from('user_progress').select('*').eq('user_id', guestId).single(),
      supabase.from('streaks').select('*').eq('user_id', guestId).single(),
      supabase.from('daily_rewards').select('*').eq('user_id', guestId).single()
    ]);
    
    return NextResponse.json({
      success: true,
      data: {
        profile: profile.data,
        progress: progress.data || { xp: 0, level: 1 },
        streak: streak.data || { current_streak: 0, last_claim_date: null },
        daily: daily.data || { last_claim_date: null, claimed_today: false }
      }
    });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
