import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireGuestId } from '../../_lib/guest';

export const dynamic = 'force-dynamic';

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: false, error: 'missing_env' }, { status: 500 });
  }

  let guestId = '';
  try {
    guestId = await requireGuestId();
  } catch {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existingVotes, error: existingVotesErr } = await supabase
    .from('votes')
    .select('battle_id')
    .eq('voter_user_id', guestId);
  if (existingVotesErr) {
    return NextResponse.json({ ok: false, error: 'read_failed' }, { status: 500 });
  }

  const affectedMatchIds = Array.from(
    new Set((existingVotes || []).map((row: any) => String(row?.battle_id || '')).filter(Boolean))
  );

  const { error: deleteErr } = await supabase
    .from('votes')
    .delete()
    .eq('voter_user_id', guestId);
  if (deleteErr) {
    return NextResponse.json({ ok: false, error: 'delete_failed' }, { status: 500 });
  }

  if (affectedMatchIds.length > 0) {
    const { data: matches } = await supabase
      .from('tournament_matches')
      .select('id, cat_a_id, cat_b_id')
      .in('id', affectedMatchIds);

    for (const match of matches || []) {
      const matchId = String(match?.id || '');
      const catA = String(match?.cat_a_id || '');
      const catB = String(match?.cat_b_id || '');
      if (!matchId || !catA || !catB) continue;

      const [{ count: countA }, { count: countB }] = await Promise.all([
        supabase.from('votes').select('id', { head: true, count: 'exact' }).eq('battle_id', matchId).eq('voted_for', catA),
        supabase.from('votes').select('id', { head: true, count: 'exact' }).eq('battle_id', matchId).eq('voted_for', catB),
      ]);

      await supabase
        .from('tournament_matches')
        .update({
          votes_a: Math.max(0, Number(countA || 0)),
          votes_b: Math.max(0, Number(countB || 0)),
        })
        .eq('id', matchId);
    }
  }

  return NextResponse.json({
    ok: true,
    guestId,
    resetVotes: affectedMatchIds.length,
    matchIds: affectedMatchIds,
  });
}
