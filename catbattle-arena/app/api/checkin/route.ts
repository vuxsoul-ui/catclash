import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../_lib/guest';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST() {
  try {
    const guestId = getGuestId();
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    // Step 1: Bootstrap user (creates profiles, user_progress, streaks, daily_rewards)
    const { error: bootstrapError } = await supabase.rpc('bootstrap_user', { 
      p_user_id: guestId 
    });
    
    if (bootstrapError) {
      return NextResponse.json({ 
        success: false, 
        guest_id: guestId,
        error: 'Bootstrap failed: ' + bootstrapError.message
      }, { status: 500 });
    }
    
    // Step 2: Checkin and update streak
    const { data: checkinData, error: checkinError } = await supabase.rpc('checkin_and_update_streak', { 
      p_user_id: guestId 
    });
    
    if (checkinError) {
      return NextResponse.json({ 
        success: false, 
        guest_id: guestId,
        error: 'Checkin failed: ' + checkinError.message
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      guest_id: guestId,
      current_streak: checkinData.current_streak, 
      already_checked_in: checkinData.already_checked_in 
    });
  } catch (e) {
    return NextResponse.json({ error: 'Server error', details: String(e) }, { status: 500 });
  }
}
