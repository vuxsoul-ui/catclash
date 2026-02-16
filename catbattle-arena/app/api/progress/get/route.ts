import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

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
    
    // Get user progress
    const { data: progress, error: progressError } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (progressError) throw progressError;
    
    // Get streak info
    const { data: streak, error: streakError } = await supabase
      .from('streaks')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (streakError) throw streakError;
    
    // Check for level up
    const { data: levelData, error: levelError } = await supabase.rpc(
      'check_level_up',
      { p_user_id: userId }
    );
    
    if (levelError) throw levelError;
    
    // Get XP required for next level
    const { data: nextLevelXp } = await supabase.rpc(
      'get_xp_for_level',
      { p_level: progress.level + 1 }
    );
    
    return NextResponse.json({
      xp: progress.xp,
      level: progress.level,
      xpForNextLevel: nextLevelXp,
      currentStreak: streak.current_streak,
      lastClaimDate: streak.last_claim_date,
      leveledUp: levelData?.[0]?.leveled_up || false,
      newLevel: levelData?.[0]?.new_level || progress.level
    });
  } catch (err) {
    console.error('Get progress error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}