import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../../_lib/guest';
import { isRelationMissingError } from '../../../_lib/tactical';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const guestId = await getGuestId();
    const { id: matchId } = await context.params;

    const { data: match, error: matchErr } = await supabase
      .from('tournament_matches')
      .select('id, cat_a_id, cat_b_id, votes_a, votes_b, status')
      .eq('id', matchId)
      .maybeSingle();

    if (matchErr || !match) return NextResponse.json({ ok: false, error: 'Match not found' }, { status: 404 });
    let userPrediction: { predicted_cat_id: string; bet_sigils: number } | null = null;
    if (guestId) {
      const { data: myPred } = await supabase
        .from('match_predictions')
        .select('predicted_cat_id, bet_sigils')
        .eq('match_id', matchId)
        .eq('voter_user_id', guestId)
        .maybeSingle();
      userPrediction = myPred || null;
    }

    const { data: predRows, error: predErr } = await supabase
      .from('match_predictions')
      .select('bet_sigils, predicted_cat_id')
      .eq('match_id', matchId);

    if (predErr && isRelationMissingError(predErr)) {
      return NextResponse.json({ ok: false, error: 'Prediction tables missing. Run latest migrations.' }, { status: 500 });
    }

    const predictionPool = (predRows || []).reduce((acc, row) => {
      acc.total += row.bet_sigils || 0;
      acc.by_cat[row.predicted_cat_id] = (acc.by_cat[row.predicted_cat_id] || 0) + (row.bet_sigils || 0);
      return acc;
    }, { total: 0, by_cat: {} as Record<string, number> });

    return NextResponse.json({
      ok: true,
      match_id: matchId,
      prediction_available: match.status === 'active',
      user_prediction: userPrediction,
      prediction_pool: predictionPool,
      is_close_match: Math.abs((match.votes_a || 0) - (match.votes_b || 0)) <= 2,
      note: 'Tactical actions are retired. Predictions remain active.',
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
