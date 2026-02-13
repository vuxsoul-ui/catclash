import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../_lib/guest';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: Request) {
  try {
    const guestId = getGuestId();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    // Bootstrap user if not exists
    await supabase.rpc('bootstrap_user', { p_user_id: guestId });
    
    const { data: streak } = await supabase
      .from('streaks')
      .select('*')
      .eq('user_id', guestId)
      .single();
    
    if (!streak) {
      await supabase.from('streaks').insert({
        user_id: guestId,
        current_streak: 1,
        last_claim_date: today
      });
      return NextResponse.json({ success: true, current_streak: 1, already_checked_in: false });
    }
    
    if (streak.last_claim_date === today) {
      return NextResponse.json({ success: true, current_streak: streak.current_streak, already_checked_in: true });
    }
    
    const newStreak = streak.last_claim_date === yesterday ? streak.current_streak + 1 : 1;
    
    await supabase.from('streaks').update({
      current_streak: newStreak,
      last_claim_date: today
    }).eq('user_id', guestId);
    
    return NextResponse.json({ success: true, current_streak: newStreak, already_checked_in: false });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
