import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireGuestId } from '../../_lib/guest';
import {
  PREDICTION_MATCH_CAP,
  computePredictionDailyCap,
  getUserPredictionDailyUsed,
  impliedProbability,
  isRelationMissingError,
  predictionMultiplierFromProbability,
  predictionStreakBonusPct,
  underdogBonusPct,
} from '../../_lib/tactical';
import { evaluateAndMaybeQualifyFlame } from '../../_lib/arenaFlame';
import { checkRateLimitMany, getClientIp, hashValue } from '../../_lib/rateLimit';
import { logReferralEvent } from '../../_lib/referrals';
import { trackAppEvent } from '../../_lib/telemetry';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const guestId = await requireGuestId();
    if (!guestId) return NextResponse.json({ ok: false, error: 'No session' }, { status: 401 });
    const ipHash = hashValue(getClientIp(req));
    const limitResult = checkRateLimitMany([
      { key: `rl:predict:user:${guestId}`, limit: 10, windowMs: 60_000 },
      { key: `rl:predict:ip:${ipHash || 'unknown'}`, limit: 60, windowMs: 60_000 },
    ]);
    if (!limitResult.allowed) {
      return NextResponse.json(
        { ok: false, error: 'Rate limit exceeded. Try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(limitResult.retryAfterSec) } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const matchId = String(body.match_id || '');
    const predictedCatId = String(body.predicted_cat_id || '');
    const bet = Math.floor(Number(body.bet || 0));

    if (!matchId || !predictedCatId || !Number.isFinite(bet) || bet < 1 || bet > PREDICTION_MATCH_CAP) {
      return NextResponse.json({ ok: false, error: `Bet must be between 1 and ${PREDICTION_MATCH_CAP}` }, { status: 400 });
    }

    const { data: match, error: matchErr } = await supabase
      .from('tournament_matches')
      .select('id, cat_a_id, cat_b_id, status, votes_a, votes_b')
      .eq('id', matchId)
      .maybeSingle();

    if (matchErr || !match) return NextResponse.json({ ok: false, error: 'Match not found' }, { status: 404 });
    if (match.status !== 'active') return NextResponse.json({ ok: false, error: 'Match is not active' }, { status: 400 });
    if (predictedCatId !== match.cat_a_id && predictedCatId !== match.cat_b_id) {
      return NextResponse.json({ ok: false, error: 'Invalid predicted cat' }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from('match_predictions')
      .select('id')
      .eq('match_id', matchId)
      .eq('voter_user_id', guestId)
      .maybeSingle();

    if (existing?.id) {
      return NextResponse.json({ ok: false, error: 'Prediction already locked for this match' }, { status: 409 });
    }

    const { data: progress } = await supabase
      .from('user_progress')
      .select('sigils')
      .eq('user_id', guestId)
      .maybeSingle();

    const currentSigils = progress?.sigils || 0;
    if (currentSigils < bet) {
      return NextResponse.json({ ok: false, error: 'Not enough sigils', current_sigils: currentSigils }, { status: 400 });
    }

    const dailyUsed = await getUserPredictionDailyUsed(supabase, guestId);
    const dailyCap = computePredictionDailyCap(currentSigils);
    if (dailyUsed + bet > dailyCap) {
      return NextResponse.json({ ok: false, error: `Daily prediction cap is ${dailyCap} sigils`, daily_used: dailyUsed, daily_cap: dailyCap }, { status: 400 });
    }

    const nextSigils = currentSigils - bet;
    const { error: deductErr } = await supabase
      .from('user_progress')
      .update({ sigils: nextSigils })
      .eq('user_id', guestId);

    if (deductErr) return NextResponse.json({ ok: false, error: deductErr.message }, { status: 500 });

    const { error: insErr } = await supabase
      .from('match_predictions')
      .insert({
        match_id: matchId,
        voter_user_id: guestId,
        predicted_cat_id: predictedCatId,
        bet_sigils: bet,
        resolved: false,
      });

    if (insErr) {
      await supabase.from('user_progress').update({ sigils: currentSigils }).eq('user_id', guestId);
      if (isRelationMissingError(insErr)) {
        return NextResponse.json({ ok: false, error: 'Prediction tables missing. Run latest migrations.' }, { status: 500 });
      }
      return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
    }

    await supabase.rpc('ensure_user_prediction_stats', { p_user_id: guestId });
    const { data: predStats } = await supabase
      .from('user_prediction_stats')
      .select('current_streak, best_streak')
      .eq('user_id', guestId)
      .maybeSingle();

    const currentStreak = predStats?.current_streak || 0;
    const predictedIsA = predictedCatId === match.cat_a_id;
    const impliedProb = impliedProbability(predictedIsA, match.votes_a, match.votes_b);
    const baseMultiplier = predictionMultiplierFromProbability(impliedProb);
    const underdogBonus = underdogBonusPct(impliedProb);
    const dailyUsedNext = dailyUsed + bet;
    await logReferralEvent(supabase, guestId, 'first_predict', { match_id: matchId, bet });
    await trackAppEvent(supabase, 'prediction_placed', { match_id: matchId, bet, predicted_cat_id: predictedCatId }, guestId);
    await evaluateAndMaybeQualifyFlame(supabase, guestId, 'prediction', new Date());
    return NextResponse.json({
      ok: true,
      bet_locked: true,
      sigils_after: nextSigils,
      daily_used: dailyUsedNext,
      daily_cap: dailyCap,
      daily_remaining: Math.max(0, dailyCap - dailyUsedNext),
      current_streak: currentStreak,
      best_prediction_streak: predStats?.best_streak || currentStreak,
      streak_bonus_pct: predictionStreakBonusPct(currentStreak),
      implied_probability: impliedProb,
      base_multiplier: Number(baseMultiplier.toFixed(2)),
      underdog_bonus_pct: underdogBonus,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: '/api/match/predict',
    method: 'POST',
    usage: {
      match_id: 'uuid',
      predicted_cat_id: 'uuid',
      bet: 'number (1-20)',
    },
    note: 'Use POST to lock a prediction. Opening this URL in a browser is a GET request.',
  });
}
