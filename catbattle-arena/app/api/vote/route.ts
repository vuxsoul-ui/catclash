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
    const body = await request.json();
    const { battleId, userId, votedFor } = body;
    
    if (!battleId || !votedFor) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
    const ipHash = hashIp(ip);
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Rate limit: 20 votes per minute per IP
    const { data: rateData } = await supabase
      .from('rate_limits')
      .select('*')
      .eq('key', `vote:${ipHash}`)
      .single();
    
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    
    if (rateData && rateData.window_start > oneMinuteAgo && rateData.count >= 20) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }
    
    // Check if already voted
    const { data: existingVote } = await supabase
      .from('votes')
      .select('*')
      .eq('battle_id', battleId)
      .or(`voter_user_id.eq.${userId || '00000000-0000-0000-0000-000000000000'},ip_hash.eq.${ipHash}`)
      .maybeSingle();
    
    if (existingVote) {
      return NextResponse.json({ error: 'already_voted' }, { status: 409 });
    }
    
    // Record vote
    await supabase.from('votes').insert({
      battle_id: battleId,
      voter_user_id: userId || null,
      ip_hash: ipHash,
      voted_for: votedFor
    });
    
    // Update rate limit
    if (rateData) {
      await supabase.from('rate_limits').update({ count: rateData.count + 1 }).eq('key', `vote:${ipHash}`);
    } else {
      await supabase.from('rate_limits').insert({ key: `vote:${ipHash}`, count: 1, window_start: new Date().toISOString() });
    }
    
    // Award XP
    if (userId) {
      const { data: progress } = await supabase.from('user_progress').select('*').eq('user_id', userId).single();
      if (progress) {
        await supabase.from('user_progress').update({ xp: progress.xp + 5 }).eq('user_id', userId);
      }
    }
    
    return NextResponse.json({ success: true, xp_earned: 5 });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
