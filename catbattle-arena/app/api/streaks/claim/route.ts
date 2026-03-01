import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { evaluateAndMaybeQualifyFlame } from '../../_lib/arenaFlame';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const flame = await evaluateAndMaybeQualifyFlame(supabase, String(userId), 'status', new Date());

    return NextResponse.json({
      success: true,
      deprecated: true,
      message: 'Legacy streak claim is deprecated. Arena Flame is gameplay-driven.',
      newStreak: flame.dayCount,
      flame,
      xpEarned: 0,
      cat_xp_banked: 0,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Server error', details: String(err) }, { status: 500 });
  }
}
