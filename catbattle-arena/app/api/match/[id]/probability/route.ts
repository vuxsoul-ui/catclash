import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { computeVoteProbabilities } from '../../../_lib/vote-stats';
import { computePulseWindow } from '../../../_lib/pulse';
import { loadCurrentStreakMap, loadEquippedSkillsForCats, loadLockedSkillsForCats, resolveMatchup } from '../../../_lib/skill-resolution';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getSupabase() {
  return createClient(
    String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\s/g, '').trim(),
    String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const supabase = getSupabase();

    const { data: match, error } = await supabase
      .from('tournament_matches')
      .select('id, tournament_id, cat_a_id, cat_b_id, status, votes_a, votes_b, locked_votes_a, locked_votes_b, locked_prob_a, locked_prob_b, voting_locked_at')
      .eq('id', id)
      .maybeSingle();

    if (error || !match) {
      return NextResponse.json({ ok: false, error: 'Match not found' }, { status: 404 });
    }

    const pulse = await computePulseWindow(new Date());
    const isLocked = pulse.isLocked || String(match.status || '').toLowerCase() === 'locked';
    const frozenA = Number(match.locked_votes_a ?? match.votes_a ?? 0);
    const frozenB = Number(match.locked_votes_b ?? match.votes_b ?? 0);
    const catIds = [String(match.cat_a_id || ''), String(match.cat_b_id || '')].filter(Boolean);
    const [skillMap, streakMap] = await Promise.all([
      isLocked ? loadLockedSkillsForCats(supabase, catIds) : loadEquippedSkillsForCats(supabase, catIds),
      loadCurrentStreakMap(supabase, catIds),
    ]);
    const live = computeVoteProbabilities(
      isLocked ? frozenA : Number(match.votes_a || 0),
      isLocked ? frozenB : Number(match.votes_b || 0)
    );
    const resolved = resolveMatchup(
      {
        votes: live.votes_a,
        skill: skillMap[String(match.cat_a_id || '')] || null,
        opponentStreak: Math.max(0, Number(streakMap[String(match.cat_b_id || '')] || 0)),
      },
      {
        votes: live.votes_b,
        skill: skillMap[String(match.cat_b_id || '')] || null,
        opponentStreak: Math.max(0, Number(streakMap[String(match.cat_a_id || '')] || 0)),
      },
      String(match.tournament_id || '')
    );

    return NextResponse.json({
      ok: true,
      match_id: match.id,
      tournament_id: match.tournament_id,
      cat_a_id: match.cat_a_id,
      cat_b_id: match.cat_b_id,
      votes_a: live.votes_a,
      votes_b: live.votes_b,
      total_votes: live.total_votes,
      base_prob_a: resolved.baseProbA,
      base_prob_b: resolved.baseProbB,
      skill_delta: resolved.netSkillDelta,
      skill_a_triggered: resolved.skillATriggered,
      skill_b_triggered: resolved.skillBTriggered,
      skill_a_id: resolved.skillAId,
      skill_b_id: resolved.skillBId,
      prob_a: resolved.finalProbA,
      prob_b: resolved.finalProbB,
      percent_a: Number((resolved.finalProbA * 100).toFixed(2)),
      percent_b: Number((resolved.finalProbB * 100).toFixed(2)),
      display: `Cat A: ${(resolved.finalProbA * 100).toFixed(2)}%  ·  Cat B: ${(resolved.finalProbB * 100).toFixed(2)}%`,
      voting_locked: isLocked,
      vote_locks_at: pulse.voteLocksAt,
      resolves_at: pulse.resolvesAt,
      voting_locked_at: match.voting_locked_at || null,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
