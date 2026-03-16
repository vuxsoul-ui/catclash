import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.3';

type PulseStatus = 'pending' | 'locked' | 'resolved' | 'failed';

type PulseRow = {
  id: string;
  scheduled_at: string;
  locked_at: string;
  resolved_at: string | null;
  status: PulseStatus;
  resolved_by: string | null;
  matchup_count: number | null;
};

type MatchRow = {
  id: string;
  tournament_id: string | null;
  round: number | null;
  cat_a_id: string;
  cat_b_id: string;
  votes_a: number | null;
  votes_b: number | null;
  locked_votes_a: number | null;
  locked_votes_b: number | null;
  status: string | null;
  resolved_at: string | null;
};

type CatRow = {
  id: string;
  user_id: string | null;
  name: string | null;
  wins: number | null;
  losses: number | null;
};

type SkillRow = {
  id: string;
  name: string;
  description: string | null;
  trigger: string;
  trigger_value: number | null;
  delta: number | null;
  is_counter: boolean | null;
  counter_to: string | null;
};

type MatchSkillContext = {
  opponentStreak: number;
  voteShare: number;
  opponentVoteShare: number;
  voteGap: number;
  isUnderdog: boolean;
  isFavourite: boolean;
  hasVotes: boolean;
  opponentSkillId: string | null;
};

type ResolutionResult = {
  baseProbA: number;
  netSkillDelta: number;
  finalProbA: number;
  skillATriggered: boolean;
  skillBTriggered: boolean;
  skillAId: string | null;
  skillBId: string | null;
  skillsCancelled: boolean;
  winnerId: string;
  loserId: string;
};

type SummaryResult = {
  match_id: string;
  cat_a: string;
  cat_b: string;
  winner: string;
  final_prob_a: number;
  skills_cancelled: boolean;
};

type AtomicMatchupResult = {
  match_id: string;
  tournament_id: string | null;
  round: number;
  cat_a_id: string;
  cat_b_id: string;
  votes_a: number;
  votes_b: number;
  base_prob_a: number;
  skill_delta: number;
  final_prob_a: number;
  skill_a_id: string | null;
  skill_b_id: string | null;
  skill_a_triggered: boolean;
  skill_b_triggered: boolean;
  skills_cancelled: boolean;
  winner_id: string;
  loser_id: string;
};

type RequestBody = {
  dry_run?: boolean;
  resolved_by?: 'scheduler' | 'admin';
};

const supabaseUrl = Deno.env.get('APP_SUPABASE_URL') || '';
const serviceRoleKey = String(Deno.env.get('APP_SERVICE_ROLE_KEY') || '').trim();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parseBearer(header: string | null): string {
  const match = String(header || '').trim().match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

function getApiKey(header: string | null): string {
  return String(header || '').trim();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function computeVoteProbabilities(votesA: number, votesB: number) {
  const safeA = Math.max(0, Number(votesA || 0));
  const safeB = Math.max(0, Number(votesB || 0));
  const total = safeA + safeB;
  if (total <= 0) {
    return {
      votes_a: safeA,
      votes_b: safeB,
      total_votes: 0,
      prob_a: 0.5,
      prob_b: 0.5,
    };
  }
  return {
    votes_a: safeA,
    votes_b: safeB,
    total_votes: total,
    prob_a: safeA / total,
    prob_b: safeB / total,
  };
}

function evaluateSkill(skill: SkillRow | null, context: MatchSkillContext): number {
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

function resolveMatch(
  match: MatchRow,
  catA: CatRow,
  catB: CatRow,
  skillA: SkillRow | null,
  skillB: SkillRow | null,
): ResolutionResult {
  const votesA = Number(match.locked_votes_a ?? match.votes_a ?? 0);
  const votesB = Number(match.locked_votes_b ?? match.votes_b ?? 0);
  const base = computeVoteProbabilities(votesA, votesB);

  const contextA: MatchSkillContext = {
    opponentStreak: Math.max(0, Number(catB.wins || 0)),
    voteShare: base.prob_a,
    opponentVoteShare: base.prob_b,
    voteGap: Math.abs(base.prob_a - base.prob_b),
    isUnderdog: base.prob_a < 0.4,
    isFavourite: base.prob_a >= 0.6,
    hasVotes: votesA > 0,
    opponentSkillId: skillB?.id || null,
  };
  const contextB: MatchSkillContext = {
    opponentStreak: Math.max(0, Number(catA.wins || 0)),
    voteShare: base.prob_b,
    opponentVoteShare: base.prob_a,
    voteGap: Math.abs(base.prob_a - base.prob_b),
    isUnderdog: base.prob_b < 0.4,
    isFavourite: base.prob_b >= 0.6,
    hasVotes: votesB > 0,
    opponentSkillId: skillA?.id || null,
  };

  let skillDeltaA = evaluateSkill(skillA, contextA);
  let skillDeltaB = evaluateSkill(skillB, contextB);
  let skillATriggered = skillDeltaA !== 0;
  let skillBTriggered = skillDeltaB !== 0;
  let skillsCancelled = false;

  if (skillsDirectlyCounter(skillA, skillB)) {
    skillDeltaA = 0;
    skillDeltaB = 0;
    skillATriggered = false;
    skillBTriggered = false;
    skillsCancelled = true;
  }

  const netSkillDelta = clamp(skillDeltaA - skillDeltaB, -0.15, 0.15);
  const finalProbA = clamp(base.prob_a + netSkillDelta, 0.05, 0.95);
  const winnerId = Math.random() < finalProbA ? catA.id : catB.id;
  const loserId = winnerId === catA.id ? catB.id : catA.id;

  return {
    baseProbA: base.prob_a,
    netSkillDelta,
    finalProbA,
    skillATriggered,
    skillBTriggered,
    skillAId: skillA?.id || null,
    skillBId: skillB?.id || null,
    skillsCancelled,
    winnerId,
    loserId,
  };
}

function getSupabase() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing APP_SUPABASE_URL or APP_SERVICE_ROLE_KEY');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

Deno.serve(async (req) => {
  let activePulseId: string | null = null;
  let failureResolvedBy: 'scheduler' | 'admin' = 'scheduler';
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, error: 'Method not allowed' }, 405);
    }

    const bearer = parseBearer(req.headers.get('authorization'));
    const apiKey = getApiKey(req.headers.get('apikey'));
    const hasExpectedSecret = Boolean(serviceRoleKey);
    const authMatchedBearer = Boolean(bearer) && bearer === serviceRoleKey;
    const authMatchedApiKey = Boolean(apiKey) && apiKey === serviceRoleKey;

    if (!hasExpectedSecret || (!authMatchedBearer && !authMatchedApiKey)) {
      console.warn('[resolve-pulse] auth rejected', {
        has_authorization_header: Boolean(req.headers.get('authorization')),
        has_apikey_header: Boolean(req.headers.get('apikey')),
        has_expected_secret: hasExpectedSecret,
        auth_branch: !hasExpectedSecret
          ? 'missing_runtime_secret'
          : authMatchedBearer
            ? 'accepted_bearer'
            : authMatchedApiKey
              ? 'accepted_apikey'
              : 'no_matching_header',
      });
      return json({ ok: false, error: 'Unauthorized' }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const dryRun = Boolean(body.dry_run);
    const resolvedBy = body.resolved_by === 'admin' ? 'admin' : 'scheduler';
    failureResolvedBy = resolvedBy;
    const supabase = getSupabase();
    const nowIso = new Date().toISOString();

    const { data: duePulses, error: pulseErr } = await supabase
      .from('pulses')
      .select('id, scheduled_at, locked_at, resolved_at, status, resolved_by, matchup_count')
      .in('status', ['pending', 'locked'])
      .lte('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: true })
      .limit(5);

    if (pulseErr) {
      throw new Error(`Failed to load pulses: ${pulseErr.message}`);
    }

    const pulses = (duePulses || []) as PulseRow[];
    if (pulses.length === 0) {
      console.info('[resolve-pulse] No pulse due');
      return json({
        ok: true,
        pulse_id: null,
        matchups_resolved: 0,
        dry_run: dryRun,
        results: [],
        message: 'No pulse due',
      });
    }

    if (pulses.length > 1) {
      console.warn('[resolve-pulse] Multiple pulses due; resolving oldest first', pulses.map((pulse) => pulse.id));
    }

    const pulse = pulses[0];
    activePulseId = pulse.id;

    if (!dryRun && pulse.status === 'pending' && new Date(nowIso) >= new Date(pulse.locked_at)) {
      const { error: lockErr } = await supabase
        .from('pulses')
        .update({ status: 'locked' })
        .eq('id', pulse.id);
      if (lockErr) {
        throw new Error(`Failed to lock pulse: ${lockErr.message}`);
      }
    }

    const { data: matchRows, error: matchErr } = await supabase
      .from('tournament_matches')
      .select('id, tournament_id, round, cat_a_id, cat_b_id, votes_a, votes_b, locked_votes_a, locked_votes_b, status, resolved_at, winner_id')
      .is('resolved_at', null)
      .not('cat_b_id', 'is', null)
      .in('status', ['active', 'in_progress', 'locked', 'pending']);

    if (matchErr) {
      throw new Error(`Failed to load unresolved matchups: ${matchErr.message}`);
    }

    const matches = (matchRows || []) as MatchRow[];
    const catIds = Array.from(
      new Set(matches.flatMap((match) => [String(match.cat_a_id || ''), String(match.cat_b_id || '')]).filter(Boolean))
    );

    const [{ data: catRows, error: catErr }, { data: skillRows, error: skillErr }] = await Promise.all([
      catIds.length
        ? supabase
            .from('cats')
            .select('id, user_id, name, wins, losses')
            .in('id', catIds)
        : Promise.resolve({ data: [] as CatRow[], error: null }),
      catIds.length
        ? supabase
            .from('cat_skills')
            .select('cat_id, skills(id, name, description, trigger, trigger_value, delta, is_counter, counter_to)')
            .in('cat_id', catIds)
            .eq('locked', true)
        : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null }),
    ]);

    if (catErr) throw new Error(`Failed to load cats: ${catErr.message}`);
    if (skillErr) throw new Error(`Failed to load locked skills: ${skillErr.message}`);

    const cats = new Map<string, CatRow>(
      ((catRows || []) as CatRow[]).map((cat) => [String(cat.id), cat])
    );
    const skillsByCat = new Map<string, SkillRow | null>();
    for (const row of (skillRows || []) as Array<{ cat_id: string; skills: SkillRow | SkillRow[] | null }>) {
      if (skillsByCat.has(String(row.cat_id))) continue;
      const skill = Array.isArray(row.skills) ? row.skills[0] || null : row.skills;
      skillsByCat.set(String(row.cat_id), skill || null);
    }

    const results: SummaryResult[] = [];
    const atomicResults: AtomicMatchupResult[] = [];
    const notifications: Array<Record<string, unknown>> = [];

    for (const match of matches) {
      const catA = cats.get(String(match.cat_a_id || ''));
      const catB = cats.get(String(match.cat_b_id || ''));
      if (!catA || !catB) {
        console.warn('[resolve-pulse] Skipping match with missing cat rows', match.id);
        continue;
      }

      const skillA = skillsByCat.get(catA.id) || null;
      const skillB = skillsByCat.get(catB.id) || null;
      const resolution = resolveMatch(match, catA, catB, skillA, skillB);

      results.push({
        match_id: match.id,
        cat_a: String(catA.name || 'Unknown'),
        cat_b: String(catB.name || 'Unknown'),
        winner: resolution.winnerId === catA.id ? String(catA.name || 'Unknown') : String(catB.name || 'Unknown'),
        final_prob_a: Number(resolution.finalProbA.toFixed(6)),
        skills_cancelled: resolution.skillsCancelled,
      });

      const votesA = Number(match.locked_votes_a ?? match.votes_a ?? 0);
      const votesB = Number(match.locked_votes_b ?? match.votes_b ?? 0);
      const loserName = resolution.loserId === catA.id ? String(catA.name || 'Unknown') : String(catB.name || 'Unknown');
      const winnerName = resolution.winnerId === catA.id ? String(catA.name || 'Unknown') : String(catB.name || 'Unknown');
      const catAFinalProb = resolution.finalProbA;
      const catBFinalProb = 1 - resolution.finalProbA;

      if (!dryRun) {
        atomicResults.push({
          match_id: match.id,
          tournament_id: match.tournament_id || null,
          round: Math.max(1, Number(match.round || 1)),
          cat_a_id: catA.id,
          cat_b_id: catB.id,
          votes_a: votesA,
          votes_b: votesB,
          base_prob_a: resolution.baseProbA,
          skill_delta: resolution.netSkillDelta,
          final_prob_a: resolution.finalProbA,
          skill_a_id: resolution.skillAId,
          skill_b_id: resolution.skillBId,
          skill_a_triggered: resolution.skillATriggered,
          skill_b_triggered: resolution.skillBTriggered,
          skills_cancelled: resolution.skillsCancelled,
          winner_id: resolution.winnerId,
          loser_id: resolution.loserId,
        });
      }

      if (catA.user_id) {
        notifications.push({
          user_id: catA.user_id,
          type: 'pulse_result',
          cat_id: catA.id,
          match_id: match.id,
          payload: {
            won: resolution.winnerId === catA.id,
            opponent_name: String(catB.name || 'Unknown'),
            final_prob: Number(catAFinalProb.toFixed(6)),
            skill_triggered: resolution.skillATriggered,
            winner_name: winnerName,
            loser_name: loserName,
          },
        });
      }
      if (catB.user_id) {
        notifications.push({
          user_id: catB.user_id,
          type: 'pulse_result',
          cat_id: catB.id,
          match_id: match.id,
          payload: {
            won: resolution.winnerId === catB.id,
            opponent_name: String(catA.name || 'Unknown'),
            final_prob: Number(catBFinalProb.toFixed(6)),
            skill_triggered: resolution.skillBTriggered,
            winner_name: winnerName,
            loser_name: loserName,
          },
        });
      }
    }

    if (!dryRun) {
      const { error: resolveErr } = await supabase.rpc('resolve_pulse_atomic', {
        p_pulse_id: pulse.id,
        p_resolved_by: resolvedBy,
        p_matchup_results: atomicResults,
      });
      if (resolveErr) {
        throw new Error(`Failed to resolve pulse atomically: ${resolveErr.message}`);
      }

      if (notifications.length > 0) {
        const { error: notifyErr } = await supabase.from('notifications').insert(notifications);
        if (notifyErr) {
          console.error('[resolve-pulse] notification insert failed after successful resolution', notifyErr);
        }
      }
    }

    return json({
      ok: true,
      pulse_id: pulse.id,
      matchups_resolved: results.length,
      dry_run: dryRun,
      results,
    });
  } catch (error) {
    try {
      if (activePulseId) {
        const supabase = getSupabase();
        await supabase
          .from('pulses')
          .update({ status: 'failed', resolved_by: failureResolvedBy })
          .eq('id', activePulseId)
          .in('status', ['pending', 'locked']);
      }
    } catch {
      // Ignore best-effort failure marking errors.
    }
    console.error('[resolve-pulse] fatal', error);
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
