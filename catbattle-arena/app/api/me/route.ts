import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../_lib/guest';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  try {
    const guestId = await getGuestId();
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    // Bootstrap user first
    await supabase.rpc('bootstrap_user', { p_user_id: guestId });
    
    // Get user state
    const { data, error } = await supabase.rpc('get_user_state', { p_user_id: guestId });
    
    if (error) {
      return NextResponse.json({ error: 'Failed to get state: ' + error.message }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      guest_id: guestId,
      data: data
    });
  } catch (e) {
    return NextResponse.json({ error: 'Server error', details: String(e) }, { status: 500 });
  }
}
