import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveVoterIdentity } from '../../_lib/voterIdentity';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ ok: false, error: 'missing_env' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const matchIdsRaw = Array.isArray(body?.match_ids) ? body.match_ids : [];
    const matchIds = Array.from(
      new Set(
        matchIdsRaw
          .map((id: unknown) => String(id || '').trim())
          .filter(Boolean)
      )
    ).slice(0, 200);

    if (matchIds.length === 0) {
      return NextResponse.json({ ok: true, votes: {} }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
    }

    let identityUserId = '';
    let identityIpHash: string | null = null;
    try {
      const identity = await resolveVoterIdentity(request);
      identityUserId = identity.voterUserId;
      identityIpHash = identity.ipHash;
    } catch {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[DEV][votes-for-matches-identity]', {
          identityType: 'unauthorized',
          requestedMatchCount: matchIds.length,
        });
      }
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[DEV][votes-for-matches-identity]', {
        identityType: 'voter_user_id+ip_hash',
        requestedMatchCount: matchIds.length,
        hasIpHash: !!identityIpHash,
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: byUser, error: byUserError } = await supabase
      .from('votes')
      .select('battle_id, voted_for')
      .eq('voter_user_id', identityUserId)
      .in('battle_id', matchIds);

    if (byUserError) {
      return NextResponse.json({ ok: false, error: byUserError.message || 'query_failed' }, { status: 500 });
    }

    let byIp: any[] = [];
    if (identityIpHash) {
      const { data, error } = await supabase
        .from('votes')
        .select('battle_id, voted_for')
        .eq('ip_hash', identityIpHash)
        .in('battle_id', matchIds);
      if (error) {
        return NextResponse.json({ ok: false, error: error.message || 'query_failed' }, { status: 500 });
      }
      byIp = Array.isArray(data) ? data : [];
    }

    const votes: Record<string, string> = {};
    for (const row of [...(byUser || []), ...byIp]) {
      const matchId = String((row as any)?.battle_id || '').trim();
      const votedFor = String((row as any)?.voted_for || '').trim();
      if (!matchId || !votedFor) continue;
      votes[matchId] = votedFor;
    }
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[DEV][votes-for-matches-result]', {
        identityType: 'voter_user_id+ip_hash',
        requestedMatchCount: matchIds.length,
        restoredVoteCount: Object.keys(votes).length,
      });
    }

    return NextResponse.json({ ok: true, votes }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || 'server_error' }, { status: 500 });
  }
}
