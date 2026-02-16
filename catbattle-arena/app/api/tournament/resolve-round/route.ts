// PLACE AT: app/api/admin/tournament/resolve-round/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin-secret-change-me';

export async function POST(request: NextRequest) {
  try {
    // Auth check - allow admin secret via header OR cron secret via query param
    const authHeader = request.headers.get('x-admin-secret');
    const { searchParams } = new URL(request.url);
    const cronSecret = searchParams.get('cron_secret');

    if (authHeader !== ADMIN_SECRET && cronSecret !== ADMIN_SECRET) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Get today's active tournament
    const today = new Date().toISOString().split('T')[0];
    const { data: tournament, error: tErr } = await supabase
      .from('tournaments')
      .select('id, round, status')
      .eq('date', today)
      .eq('status', 'active')
      .single();

    if (tErr || !tournament) {
      return NextResponse.json({ ok: false, error: 'No active tournament today' }, { status: 404 });
    }

    // 2. Get all active matches for current round
    const { data: matches, error: mErr } = await supabase
      .from('tournament_matches')
      .select('id, cat_a_id, cat_b_id, votes_a, votes_b, status')
      .eq('tournament_id', tournament.id)
      .eq('round', tournament.round)
      .eq('status', 'active');

    if (mErr) {
      return NextResponse.json({ ok: false, error: 'Failed to fetch matches: ' + mErr.message }, { status: 500 });
    }

    if (!matches || matches.length === 0) {
      return NextResponse.json({ ok: false, error: 'No active matches in current round' }, { status: 404 });
    }

    // 3. Resolve each match - pick winner
    const winners: string[] = [];
    const results: Array<{ match_id: string; winner_id: string; votes_a: number; votes_b: number }> = [];

    for (const match of matches) {
      let winnerId: string;

      if (match.votes_a > match.votes_b) {
        winnerId = match.cat_a_id;
      } else if (match.votes_b > match.votes_a) {
        winnerId = match.cat_b_id;
      } else {
        // Tie-breaker: random
        winnerId = Math.random() > 0.5 ? match.cat_a_id : match.cat_b_id;
      }

      // Update match with winner
      const { error: updateErr } = await supabase
        .from('tournament_matches')
        .update({ winner_id: winnerId, status: 'complete' })
        .eq('id', match.id);

      if (updateErr) {
        console.error('[RESOLVE] Failed to update match:', match.id, updateErr);
        continue;
      }

// Update cat win/loss records
const loserId = winnerId === match.cat_a_id ? match.cat_b_id : match.cat_a_id;

const { error: incWinErr } = await supabase.rpc("increment_cat_counter", {
  p_cat_id: winnerId,
  p_field: "wins",
  p_amount: 1,
});

if (incWinErr) {
  console.warn("increment_field(wins) failed:", incWinErr.message);
}

const { error: incLossErr } = await supabase.rpc("increment_field", {
  p_cat_id: loserId,
  p_field: "losses",
  p_amount: 1,
});

if (incLossErr) {
  console.warn("increment_field(losses) failed:", incLossErr.message);
}

      

      // Simple increment via raw update
      const { data: winnerCat } = await supabase.from('cats').select('wins, losses, battles_fought').eq('id', winnerId).single();
      if (winnerCat) {
        await supabase.from('cats').update({
          wins: (winnerCat.wins || 0) + 1,
          battles_fought: (winnerCat.battles_fought || 0) + 1,
        }).eq('id', winnerId);
      }

      const { data: loserCat } = await supabase.from('cats').select('wins, losses, battles_fought').eq('id', loserId).single();
      if (loserCat) {
        await supabase.from('cats').update({
          losses: (loserCat.losses || 0) + 1,
          battles_fought: (loserCat.battles_fought || 0) + 1,
        }).eq('id', loserId);
      }

      winners.push(winnerId);
      results.push({ match_id: match.id, winner_id: winnerId, votes_a: match.votes_a, votes_b: match.votes_b });
    }

    // 4. Check if tournament is over (only 1 winner = champion)
    if (winners.length === 1) {
      // We have a champion!
      await supabase
        .from('tournaments')
        .update({ status: 'complete' })
        .eq('id', tournament.id);

      // Award champion XP bonus
      const { data: champ } = await supabase.from('cats').select('cat_xp, xp').eq('id', winners[0]).single();
      if (champ) {
        await supabase.from('cats').update({
          cat_xp: (champ.cat_xp || 0) + 100,
          xp: (champ.xp || 0) + 100,
        }).eq('id', winners[0]);
      }

      return NextResponse.json({
        ok: true,
        message: 'Tournament complete! Champion crowned!',
        champion_id: winners[0],
        round_resolved: tournament.round,
        results,
      });
    }

    // 5. Create next round matches from winners
    const nextRound = tournament.round + 1;
    const nextMatches = [];

    for (let i = 0; i < winners.length; i += 2) {
      if (i + 1 < winners.length) {
        nextMatches.push({
          tournament_id: tournament.id,
          round: nextRound,
          cat_a_id: winners[i],
          cat_b_id: winners[i + 1],
          status: 'active',
          votes_a: 0,
          votes_b: 0,
        });
      } else {
        // Odd number of winners - bye round (auto-advance)
        // This shouldn't happen in a proper bracket but handle it
        nextMatches.push({
          tournament_id: tournament.id,
          round: nextRound,
          cat_a_id: winners[i],
          cat_b_id: winners[i], // vs self = auto win next resolve
          status: 'active',
          votes_a: 0,
          votes_b: 0,
        });
      }
    }

    const { error: insertErr } = await supabase
      .from('tournament_matches')
      .insert(nextMatches);

    if (insertErr) {
      return NextResponse.json({ ok: false, error: 'Failed to create next round: ' + insertErr.message }, { status: 500 });
    }

    // Update tournament round
    await supabase
      .from('tournaments')
      .update({ round: nextRound })
      .eq('id', tournament.id);

    return NextResponse.json({
      ok: true,
      message: `Round ${tournament.round} resolved! ${winners.length} winners advance to Round ${nextRound}`,
      round_resolved: tournament.round,
      next_round: nextRound,
      winners_count: winners.length,
      next_matches_count: nextMatches.length,
      results,
    });
  } catch (e) {
    console.error('[RESOLVE] Exception:', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}