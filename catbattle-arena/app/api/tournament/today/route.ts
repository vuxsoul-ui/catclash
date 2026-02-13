import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../_lib/guest';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  try {
    const guestId = getGuestId();
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    // Get or create today's tournament
    const { data: tournament, error } = await supabase.rpc('get_today_tournament');
    
    if (error) {
      return NextResponse.json({ error: 'Failed to get tournament: ' + error.message }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      guest_id: guestId,
      tournament
    });
  } catch (e) {
    return NextResponse.json({ error: 'Server error', details: String(e) }, { status: 500 });
  }
}
