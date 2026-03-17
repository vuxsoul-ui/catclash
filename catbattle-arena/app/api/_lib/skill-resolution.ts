import type { SupabaseClient } from '@supabase/supabase-js';
import { computeVoteProbabilities } from './vote-stats';

export type SkillRow = {
  id: string;
  name: string;
  description: string | null;
  trigger: string;
  trigger_value: number | null;
  delta: number | null;
  is_counter: boolean | null;
  counter_to?: string | null;
};

export type MatchSkillContext = {
  opponentStreak: number;
  voteShare: number;
  opponentVoteShare: number;
  voteGap: number;
  isUnderdog: boolean;
  isFavourite: boolean;
  hasVotes: boolean;
  opponentSkillId: string | null;
};

export type ResolvedSkillEffect = {
  skillId: string | null;
  triggered: boolean;
  delta: number;
};

export type MatchupResolution = {
  baseProbA: number;
  baseProbB: number;
  skillDeltaA: number;
  skillDeltaB: number;
  netSkillDelta: number;
  finalProbA: number;
  finalProbB: number;
  skillATriggered: boolean;
  skillBTriggered: boolean;
  skillAId: string | null;
  skillBId: string | null;
  skillsCancelled: boolean;
  winnerSide: 'a' | 'b';
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function evaluateSkill(skill: SkillRow | null, context: MatchSkillContext): number {
  if (!skill || !context.hasVotes) return 0;
  const trigger = String(skill.trigger || '').trim().toLowerCase();
  const triggerValue = Number(skill.trigger_value || 0);
  const delta = Number(skill.delta || 0);

  switch (trigger) {
    case 'opponent_on_streak':
      return context.opponentStreak >= triggerValue ? delta : 0;
    case 'underdog':
      return context.isUnderdog ? delta : 0;
    case 'favourite':
      return context.isFavourite ? delta : 0;
    case 'vote_gap_close':
    case 'close_vote_gap':
      return context.voteGap < triggerValue / 100 ? delta : 0;
    case 'counter':
      return context.opponentSkillId && String(skill.counter_to || '').trim() === context.opponentSkillId ? delta : 0;
    default:
      return 0;
  }
}

function skillsDirectlyCounter(skillA: SkillRow | null, skillB: SkillRow | null) {
  if (!skillA || !skillB) return false;
  if (!skillA.is_counter || !skillB.is_counter) return false;
  return String(skillA.counter_to || '').trim() === String(skillB.id || '').trim()
    && String(skillB.counter_to || '').trim() === String(skillA.id || '').trim();
}

export function resolveMatchup(
  catA: { votes: number; skill: SkillRow | null; opponentStreak: number },
  catB: { votes: number; skill: SkillRow | null; opponentStreak: number },
  pulseId: string,
  rng: () => number = Math.random
): MatchupResolution {
  void pulseId;

  const base = computeVoteProbabilities(catA.votes, catB.votes);
  const contextA: MatchSkillContext = {
    opponentStreak: catA.opponentStreak,
    voteShare: base.prob_a,
    opponentVoteShare: base.prob_b,
    voteGap: Math.abs(base.prob_a - base.prob_b),
    isUnderdog: base.prob_a < 0.4,
    isFavourite: base.prob_a >= 0.6,
    hasVotes: catA.votes > 0,
    opponentSkillId: catB.skill?.id || null,
  };
  const contextB: MatchSkillContext = {
    opponentStreak: catB.opponentStreak,
    voteShare: base.prob_b,
    opponentVoteShare: base.prob_a,
    voteGap: Math.abs(base.prob_a - base.prob_b),
    isUnderdog: base.prob_b < 0.4,
    isFavourite: base.prob_b >= 0.6,
    hasVotes: catB.votes > 0,
    opponentSkillId: catA.skill?.id || null,
  };

  let skillDeltaA = evaluateSkill(catA.skill, contextA);
  let skillDeltaB = evaluateSkill(catB.skill, contextB);
  let skillATriggered = skillDeltaA !== 0;
  let skillBTriggered = skillDeltaB !== 0;
  let skillsCancelled = false;

  if (skillsDirectlyCounter(catA.skill, catB.skill)) {
    skillDeltaA = 0;
    skillDeltaB = 0;
    skillATriggered = false;
    skillBTriggered = false;
    skillsCancelled = true;
  }

  let netSkillDelta = clamp(skillDeltaA - skillDeltaB, -0.15, 0.15);
  const finalProbA = clamp(base.prob_a + netSkillDelta, 0.05, 0.95);
  const finalProbB = 1 - finalProbA;
  const winnerSide = rng() < finalProbA ? 'a' : 'b';

  return {
    baseProbA: base.prob_a,
    baseProbB: base.prob_b,
    skillDeltaA,
    skillDeltaB,
    netSkillDelta,
    finalProbA,
    finalProbB,
    skillATriggered,
    skillBTriggered,
    skillAId: catA.skill?.id || null,
    skillBId: catB.skill?.id || null,
    skillsCancelled,
    winnerSide,
  };
}

export async function loadLockedSkillsForCats(supabase: SupabaseClient, catIds: string[]) {
  if (catIds.length === 0) return {} as Record<string, SkillRow | null>;
  const { data, error } = await supabase
    .from('cat_skills')
    .select('cat_id, skill_id, locked, skills(id, name, description, trigger, trigger_value, delta, is_counter, counter_to)')
    .in('cat_id', catIds)
    .eq('locked', true);

  if (error) return {} as Record<string, SkillRow | null>;

  const out: Record<string, SkillRow | null> = {};
  for (const row of (data || []) as Array<{ cat_id: string; skills: SkillRow | SkillRow[] | null }>) {
    const skill = Array.isArray(row.skills) ? row.skills[0] || null : row.skills;
    out[row.cat_id] = skill || null;
  }
  return out;
}

export async function loadEquippedSkillsForCats(supabase: SupabaseClient, catIds: string[]) {
  if (catIds.length === 0) return {} as Record<string, SkillRow | null>;
  const { data, error } = await supabase
    .from('cat_skills')
    .select('cat_id, equipped_at, skills(id, name, description, trigger, trigger_value, delta, is_counter, counter_to)')
    .in('cat_id', catIds)
    .order('equipped_at', { ascending: false });

  if (error) return {} as Record<string, SkillRow | null>;

  const out: Record<string, SkillRow | null> = {};
  for (const row of (data || []) as Array<{ cat_id: string; skills: SkillRow | SkillRow[] | null }>) {
    if (out[row.cat_id] !== undefined) continue;
    const skill = Array.isArray(row.skills) ? row.skills[0] || null : row.skills;
    out[row.cat_id] = skill || null;
  }
  return out;
}

export async function loadCurrentStreakMap(supabase: SupabaseClient, catIds: string[]) {
  if (catIds.length === 0) return {} as Record<string, number>;
  const { data, error } = await supabase
    .from('cats')
    .select('id, wins')
    .in('id', catIds);
  if (error) return {} as Record<string, number>;
  const out: Record<string, number> = {};
  for (const row of (data || []) as Array<{ id: string; wins?: number | null }>) {
    out[row.id] = Math.max(0, Number(row.wins || 0));
  }
  return out;
}

export async function lockPulse(supabase: SupabaseClient, pulseId: string, lockedAt: string) {
  const { data: tournaments, error: tournamentErr } = await supabase
    .from('tournaments')
    .select('id')
    .eq('date', pulseId)
    .in('status', ['active', 'in_progress'] as any);

  if (tournamentErr) return { ok: false, error: tournamentErr.message, locked_matches: 0, locked_skills: 0 };
  const tournamentIds = (tournaments || []).map((t: any) => String(t.id)).filter(Boolean);
  if (tournamentIds.length === 0) return { ok: true, locked_matches: 0, locked_skills: 0 };

  const { data: matches, error: matchErr } = await supabase
    .from('tournament_matches')
    .select('id, cat_a_id, cat_b_id, votes_a, votes_b')
    .in('tournament_id', tournamentIds)
    .in('status', ['active', 'pending'] as any);

  if (matchErr) return { ok: false, error: matchErr.message, locked_matches: 0, locked_skills: 0 };

  const catIds = Array.from(new Set((matches || []).flatMap((m: any) => [String(m.cat_a_id || ''), String(m.cat_b_id || '')]).filter(Boolean)));
  let lockedMatches = 0;
  for (const match of matches || []) {
    const frozen = computeVoteProbabilities(Number((match as any).votes_a || 0), Number((match as any).votes_b || 0));
    const { error } = await supabase
      .from('tournament_matches')
      .update({
        status: 'locked',
        voting_locked_at: lockedAt,
        locked_votes_a: frozen.votes_a,
        locked_votes_b: frozen.votes_b,
        locked_prob_a: frozen.prob_a,
        locked_prob_b: frozen.prob_b,
      })
      .eq('id', (match as any).id);
    if (!error) lockedMatches += 1;
  }

  let lockedSkills = 0;
  if (catIds.length > 0) {
    const { error } = await supabase
      .from('cat_skills')
      .update({ locked: true })
      .in('cat_id', catIds)
      .eq('locked', false);
    if (!error) {
      const { count } = await supabase
        .from('cat_skills')
        .select('id', { head: true, count: 'exact' })
        .in('cat_id', catIds)
        .eq('locked', true);
      lockedSkills = Number(count || 0);
    }
  }

  return { ok: true, locked_matches: lockedMatches, locked_skills: lockedSkills };
}
