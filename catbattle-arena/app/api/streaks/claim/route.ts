import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data, error } = await supabase.rpc('claim_daily_streak', {
      p_user_id: userId
    });
    
    if (error) throw error;
    
    return NextResponse.json({
      success: data[0].success,
      newStreak: data[0].new_streak,
      xpEarned: data[0].xp_earned
    });
  } catch (err) {
    console.error('Claim streak error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
