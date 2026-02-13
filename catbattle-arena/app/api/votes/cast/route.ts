import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').substring(0, 16);
}

export async function POST(request: NextRequest) {
  try {
    const { battleId, userId, votedFor } = await request.json();
    
    if (!battleId || !votedFor) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Get IP and hash it
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
    const ipHash = hashIp(ip);
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data, error } = await supabase.rpc('cast_vote', {
      p_battle_id: battleId,
      p_user_id: userId || null,
      p_ip_hash: ipHash,
      p_voted_for: votedFor
    });
    
    if (error) throw error;
    
    return NextResponse.json({
      success: data[0].success,
      errorMessage: data[0].error_message
    });
  } catch (err) {
    console.error('Cast vote error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
