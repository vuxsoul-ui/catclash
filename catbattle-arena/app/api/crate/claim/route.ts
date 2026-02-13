import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../_lib/guest';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: Request) {
  try {
    const guestId = getGuestId();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const today = new Date().toISOString().split('T')[0];
    
    // Bootstrap user if not exists
    await supabase.rpc('bootstrap_user', { p_user_id: guestId });
    
    const { data: daily } = await supabase
      .from('daily_rewards')
      .select('*')
      .eq('user_id', guestId)
      .single();
    
    if (daily?.last_claim_date === today) {
      return NextResponse.json({ success: false, error: 'already_claimed' }, { status: 409 });
    }
    
    const xpAwarded = 50 + (new Date().getDate() % 50);
    
    if (daily) {
      await supabase.from('daily_rewards').update({
        last_claim_date: today,
        claimed_today: true
      }).eq('user_id', guestId);
    } else {
      await supabase.from('daily_rewards').insert({
        user_id: guestId,
        last_claim_date: today,
        claimed_today: true
      });
    }
    
    const { data: progress } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', guestId)
      .single();
    
    if (progress) {
      await supabase.from('user_progress').update({
        xp: progress.xp + xpAwarded
      }).eq('user_id', guestId);
    } else {
      await supabase.from('user_progress').insert({
        user_id: guestId,
        xp: xpAwarded,
        level: 1
      });
    }
    
    return NextResponse.json({ success: true, xp_awarded: xpAwarded });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
