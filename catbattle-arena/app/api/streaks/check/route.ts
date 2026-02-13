import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Bootstrap if needed
    await supabase.from('profiles').insert({ id: userId }).select();
    await supabase.from('user_progress').insert({ user_id: userId, xp: 0, level: 1 }).select();
    await supabase.from('streaks').insert({ user_id: userId, current_streak: 0 }).select();
    
    const { data: streak } = await supabase
      .from('streaks')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    return NextResponse.json({
      currentStreak: streak?.current_streak || 0,
      canClaim: true
    });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
