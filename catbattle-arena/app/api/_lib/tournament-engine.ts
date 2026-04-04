import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { logStatChange } from './statAuditLog';
import {
  impliedProbability,
  isRelationMissingError,
  predictionMultiplierFromProbability,
  predictionStreakBonusPct,
  underdogBonusPct,
} from './tactical';
import { pickRandomCatUsername } from './cat-usernames';
import { computePulseWindow } from './pulse';
import { computeVoteProbabilities } from './vote-stats';
import { loadCurrentStreakMap, loadLockedSkillsForCats, lockPulse, resolveMatchup } from './skill-resolution';

type TournamentRow = {
  id: string;
  date: string;
  status: string;
  round: number;
  tournament_type: string | null;
  champion_id: string | null;
};

type MatchRow = {
  id: string;
  tournament_id?: string;
  round: number;
  cat_a_id: string;
  cat_b_id: string | null;
  votes_a: number | null;
  votes_b: number | null;
  locked_votes_a?: number | null;
  locked_votes_b?: number | null;
  locked_prob_a?: number | null;
  locked_prob_b?: number | null;
  winner_id: string | null;
  status: string;
  created_at: string;
  voting_locked_at?: string | null;
  resolved_at?: string | null;
};

type CatRow = {
  id: string;
  user_id: string;
  name: string;
  image_path: string | null;
  image_url_thumb?: string | null;
};

export const NPC_USER_ID = '00000000-0000-0000-0000-000000000000';
const MAIN_ARENA_SIZE = Math.max(8, Number(process.env.MAIN_ARENA_SIZE || 8));
const ROOKIE_ARENA_SIZE = Math.max(8, Number(process.env.ROOKIE_ARENA_SIZE || 8));
const TOURNAMENT_CONFIG = [
  { type: 'main', size: MAIN_ARENA_SIZE, minNpcShare: 0 },
  { type: 'rookie', size: ROOKIE_ARENA_SIZE, minNpcShare: 0 },
];
const VOTABLE_MATCH_STATUSES = ['active', 'in_progress'] as const;

function supabaseAdmin(): SupabaseClient {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim();
  const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim();
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function currentPulseKey(now = new Date()) {
  return (await computePulseWindow(now)).pulseKey;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function matchPriorityScore(status: string): number {
  const s = String(status || '').toLowerCase();
  if (s === 'active') return 3;
  if (s === 'in_progress') return 2;
  if (s === 'pending') return 1;
  return 0;
}

function normalizedPairImageKey(value: string | null | undefined): string | null {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  return raw
    .replace(/[?#].*$/, '')
    .replace(/\/(thumb|card|original)\.(webp|png|jpg|jpeg)$/i, '')
    .replace(/\.(webp|png|jpg|jpeg)$/i, '');
}

async function recordResolvedMatchHistory(
  supabase: SupabaseClient,
  match: MatchRow,
  resolution: {
    baseProbA: number;
    skillDeltaA: number;
    skillDeltaB: number;
    netSkillDelta: number;
    finalProbA: number;
    skillATriggered: boolean;
    skillBTriggered: boolean;
    skillAId: string | null;
    skillBId: string | null;
    skillsCancelled: boolean;
  },
  winnerId: string,
  loserId: string | null,
  resolvedAt: string
) {
  if (match.cat_a_id === match.cat_b_id || (winnerId && loserId && winnerId === loserId)) {
    return;
  }

  const lockedVotesA = Number(match.locked_votes_a ?? match.votes_a ?? 0);
  const lockedVotesB = Number(match.locked_votes_b ?? match.votes_b ?? 0);
  await supabase.from('match_history').upsert({
    match_id: match.id,
    tournament_id: match.tournament_id || null,
    pulse_id: match.tournament_id || null,
    round: match.round,
    cat_a_id: match.cat_a_id,
    cat_b_id: match.cat_b_id,
    votes_a: lockedVotesA,
    votes_b: lockedVotesB,
    base_prob_a: resolution.baseProbA,
    skill_delta: resolution.netSkillDelta,
    final_prob_a: resolution.finalProbA,
    skills_cancelled: resolution.skillsCancelled,
    skill_a_triggered: resolution.skillATriggered,
    skill_b_triggered: resolution.skillBTriggered,
    skill_a_id: resolution.skillAId,
    skill_b_id: resolution.skillBId,
    winner_id: winnerId,
    loser_id: loserId,
    resolved_at: resolvedAt,
  }, { onConflict: 'match_id' });
}

async function resolvePredictionPayouts(
  supabase: SupabaseClient,
  matchId: string,
  winnerId: string
) {
  const { data: matchRow } = await supabase
    .from('tournament_matches')
    .select('cat_a_id, cat_b_id, votes_a, votes_b')
    .eq('id', matchId)
    .maybeSingle();

  const { data: predictions, error: predErr } = await supabase
    .from('match_predictions')
    .select('id, voter_user_id, predicted_cat_id, bet_sigils')
    .eq('match_id', matchId)
    .eq('resolved', false);

  if (predErr) {
    if (isRelationMissingError(predErr)) return;
    return;
  }

  const userIds = Array.from(new Set((predictions || []).map((p) => p.voter_user_id)));

  const streakMap: Record<string, number> = {};
  if (userIds.length > 0) {
    const { data: streakRows } = await supabase
      .from('user_prediction_stats')
      .select('user_id, current_streak')
      .in('user_id', userIds);
    for (const row of streakRows || []) streakMap[row.user_id] = row.current_streak || 0;
  }

  for (const p of predictions || []) {
    const won = p.predicted_cat_id === winnerId;
    const predictedIsA = p.predicted_cat_id === matchRow?.cat_a_id;
    const impliedProb = impliedProbability(predictedIsA, matchRow?.votes_a, matchRow?.votes_b);
    const baseMultiplier = predictionMultiplierFromProbability(impliedProb);
    const streakPct = won ? predictionStreakBonusPct(streakMap[p.voter_user_id] || 0) : 0;
    const underdogPct = won ? underdogBonusPct(impliedProb) : 0;
    const totalMultiplier = Math.min(4, baseMultiplier * (1 + streakPct / 100) * (1 + underdogPct / 100));
    const payout = won ? Math.floor((p.bet_sigils || 0) * totalMultiplier) : 0;

    const { data: applied, error: applyErr } = await supabase.rpc('apply_prediction_resolution', {
      p_prediction_id: p.id,
      p_won: won,
      p_payout: payout,
    });
    if (applyErr) {
      await supabase
        .from('match_predictions')
        .update({ resolved: true, won, payout_sigils: payout })
        .eq('id', p.id)
        .eq('resolved', false);
      if (won && payout > 0) {
        const { data: progress } = await supabase
          .from('user_progress')
          .select('sigils')
          .eq('user_id', p.voter_user_id)
          .maybeSingle();
        const sigils = progress?.sigils || 0;
        await supabase
          .from('user_progress')
          .update({ sigils: sigils + payout })
          .eq('user_id', p.voter_user_id);
      }
      if (won) {
        await awardPredictionCratePoint(supabase, p.voter_user_id);
      }
      continue;
    }
    const first = Array.isArray(applied) ? applied[0] : null;
    if (first?.current_streak != null) {
      streakMap[p.voter_user_id] = first.current_streak;
    }
    if (won) {
      await awardPredictionCratePoint(supabase, p.voter_user_id);
    }
  }
}

async function awardPredictionCratePoint(supabase: SupabaseClient, userId: string) {
  const key = `prediction_crate_points:${userId}`;
  const { data: row } = await supabase.from('rate_limits').select('count').eq('key', key).maybeSingle();
  const points = Math.max(0, Number(row?.count || 0)) + 1;
  const grantCrates = Math.floor(points / 10);
  const remainder = points % 10;
  await supabase.from('rate_limits').upsert({ key, count: remainder, window_start: new Date().toISOString() }, { onConflict: 'key' });
  if (grantCrates <= 0) return;

  await supabase.rpc('ensure_user_prediction_stats', { p_user_id: userId });
  const { data: stats } = await supabase
    .from('user_prediction_stats')
    .select('bonus_rolls')
    .eq('user_id', userId)
    .maybeSingle();
  const nextRolls = Math.max(0, Number(stats?.bonus_rolls || 0)) + grantCrates;
  await supabase.from('user_prediction_stats').update({ bonus_rolls: nextRolls }).eq('user_id', userId);
}

function pairParticipantsAvoidingSameOwner(cats: CatRow[]): Array<[CatRow, CatRow]> {
  const pool = shuffle(cats);
  const pairs: Array<[CatRow, CatRow]> = [];

  while (pool.length > 1) {
    const a = pool.shift() as CatRow;
    const aImageKey = normalizedPairImageKey(a.image_url_thumb || a.image_path || null);
    let opponentIndex = pool.findIndex((c) => {
      if (c.user_id === a.user_id) return false;
      const bImageKey = normalizedPairImageKey(c.image_url_thumb || c.image_path || null);
      return !(aImageKey && bImageKey && aImageKey === bImageKey);
    });
    if (opponentIndex < 0) opponentIndex = 0;
    const b = pool.splice(opponentIndex, 1)[0] || a;
    pairs.push([a, b]);
  }

  if (pool.length === 1) {
    const a = pool.shift() as CatRow;
    pairs.push([a, a]);
  }

  return pairs;
}

async function uploadNpcImage(supabase: SupabaseClient, seed: string): Promise<string> {
  const catApiKey = String(process.env.CAT_API_KEY || process.env.THECATAPI_API_KEY || '').trim();
  const catApiEndpoint = catApiKey
    ? `https://api.thecatapi.com/v1/images/search?limit=1&mime_types=jpg,png,webp&api_key=${encodeURIComponent(catApiKey)}`
    : 'https://api.thecatapi.com/v1/images/search?limit=1&mime_types=jpg,png,webp';

  let source = '';
  try {
    const catApiRes = await fetch(catApiEndpoint, {
      cache: 'no-store',
      headers: catApiKey ? { 'x-api-key': catApiKey } : undefined,
    });
    if (catApiRes.ok) {
      const payload = (await catApiRes.json()) as Array<{ url?: string }>;
      const candidate = String(payload?.[0]?.url || '').trim();
      if (/^https?:\/\//i.test(candidate)) source = candidate;
    }
  } catch {
    source = '';
  }
  if (!source) {
    source = `https://cataas.com/cat?width=512&height=512&r=${encodeURIComponent(seed)}`;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(source, { cache: 'no-store' });
      if (!res.ok) continue;
      const contentType = res.headers.get('content-type') || 'image/jpeg';
      const buf = new Uint8Array(await res.arrayBuffer());
      if (!contentType.startsWith('image/') || buf.byteLength < 1024) continue;
      const path = `npc/${Date.now()}-${seed}.jpg`;
      const { error } = await supabase.storage.from('cat-images').upload(path, buf, {
        contentType,
        upsert: false,
      });
      if (!error) return path;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  if (process.env.CATAAS_DIRECT_FALLBACK !== '0') {
    return `https://robohash.org/${encodeURIComponent(`npc-${seed}`)}?set=set4&size=512x512&bgset=bg2`;
  }
  return `https://robohash.org/${encodeURIComponent(`npc-${seed}`)}?set=set4&size=512x512&bgset=bg2`;
}

async function seedNpcCatsIfNeeded(
  supabase: SupabaseClient,
  minApprovedNpc: number,
  options?: { promoteRejected?: boolean }
) {
  const promoteRejected = options?.promoteRejected !== false;
  await supabase
    .from('profiles')
    .upsert({ id: NPC_USER_ID, username: 'Arena NPC' }, { onConflict: 'id' });

  if (promoteRejected) {
    const { data: rejectedNpc } = await supabase
      .from('cats')
      .select('id')
      .eq('user_id', NPC_USER_ID)
      .eq('status', 'rejected')
      .limit(Math.max(0, minApprovedNpc));

    if (rejectedNpc && rejectedNpc.length > 0) {
      const toPromote = rejectedNpc.map((c) => c.id);
      await supabase.from('cats').update({ status: 'approved' }).in('id', toPromote);
    }
  }

  const { data: existing } = await supabase
    .from('cats')
    .select('id, name')
    .eq('user_id', NPC_USER_ID)
    .eq('status', 'approved');

  const approvedNpcCount = (existing || []).length;
  const needed = Math.max(0, minApprovedNpc - approvedNpcCount);
  if (needed === 0) return 0;

  const count = Math.min(needed, 16);
  const rarities = ['Common', 'Common', 'Rare', 'Rare', 'Epic', 'Legendary'];
  const usedNames = new Set<string>(
    (existing || [])
      .map((c: { name?: string | null }) => String(c.name || '').toLowerCase())
      .filter(Boolean)
  );
  const inserts: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    const image_path = await uploadNpcImage(supabase, `${Date.now()}_${i}`);
    let generatedName = '';
    for (let n = 0; n < 30; n += 1) {
      const candidate = pickRandomCatUsername(`npc:${Date.now()}:${i}:${n}`).slice(0, 24);
      const lower = candidate.toLowerCase();
      if (!usedNames.has(lower)) {
        usedNames.add(lower);
        generatedName = candidate;
        break;
      }
    }
    if (!generatedName) generatedName = `ArenaNPC${1000 + i}`;
    inserts.push({
      user_id: NPC_USER_ID,
      name: generatedName,
      image_path,
      rarity: rarities[i % rarities.length],
      attack: 45 + Math.floor(Math.random() * 55),
      defense: 45 + Math.floor(Math.random() * 55),
      speed: 45 + Math.floor(Math.random() * 55),
      charisma: 45 + Math.floor(Math.random() * 55),
      chaos: 45 + Math.floor(Math.random() * 55),
      ability: 'NPC Instinct',
      power: 'NPC Instinct',
      cat_xp: 0,
      cat_level: 1,
      xp: 0,
      level: 1,
      battles_fought: 0,
      wins: 0,
      losses: 0,
      evolution: 'Kitten',
      status: 'approved',
      description: 'Arena NPC challenger',
    });
  }

  if (inserts.length > 0) {
    const { error } = await supabase.from('cats').insert(inserts);
    if (error) {
      return 0;
    }
  }
  return inserts.length;
}

export async function reseedNpcRoster(targetCount = 24) {
  const supabase = supabaseAdmin();
  await supabase
    .from('profiles')
    .upsert({ id: NPC_USER_ID, username: 'Arena NPC' }, { onConflict: 'id' });

  const { data: existingApproved } = await supabase
    .from('cats')
    .select('id')
    .eq('user_id', NPC_USER_ID)
    .eq('status', 'approved');

  const archived = (existingApproved || []).length;
  if (archived > 0) {
    await supabase
      .from('cats')
      .update({ status: 'rejected', image_review_status: 'approved' })
      .eq('user_id', NPC_USER_ID)
      .eq('status', 'approved');
  }

  const seeded = await seedNpcCatsIfNeeded(supabase, Math.max(8, targetCount), { promoteRejected: false });

  const { data: active } = await supabase
    .from('cats')
    .select('id, name, image_path')
    .eq('user_id', NPC_USER_ID)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(30);

  return {
    ok: true,
    archived,
    seeded,
    active_count: (active || []).length,
    samples: (active || []).slice(0, 8),
  };
}

async function pickParticipants(supabase: SupabaseClient, size: number, minNpcShare: number): Promise<CatRow[]> {
  const { data: approvedCats } = await supabase
    .from('cats')
    .select('id, user_id, name, image_path, image_url_thumb, origin, image_review_status')
    .eq('status', 'approved')
    .eq('origin', 'submitted')
    .or('image_review_status.is.null,image_review_status.eq.approved')
    .neq('user_id', NPC_USER_ID);
  const playerPool = ((approvedCats || []) as unknown as Array<CatRow & { image_path?: string | null }>)
    .filter((cat) => !/\/starter\//i.test(String((cat as any).image_path || ''))) as unknown as CatRow[];
  if (playerPool.length === 0) return [];
  const combined = shuffle(playerPool);

  if (combined.length >= size) return combined.slice(0, size);
  if (combined.length === 0) return [];

  const expanded: CatRow[] = [];
  while (expanded.length < size) expanded.push(...shuffle(combined));
  return shuffle(expanded).slice(0, size);
}

async function createTournamentIfMissing(
  supabase: SupabaseClient,
  date: string,
  type: string,
  size: number,
  minNpcShare: number
) {
  const pulse = await computePulseWindow(new Date());
  const eligibleCatIdsForMatches = async (matches: Array<{ cat_a_id: string; cat_b_id: string }>) => {
    const ids = Array.from(new Set(matches.flatMap((m) => [m.cat_a_id, m.cat_b_id])));
    if (ids.length === 0) return new Set<string>();
    const { data: cats } = await supabase
      .from('cats')
      .select('id, user_id, status, image_review_status, origin, image_path')
      .in('id', ids);
    const set = new Set<string>();
    for (const c of cats || []) {
      const status = String((c as any).status || '').toLowerCase();
      const review = String((c as any).image_review_status || '').toLowerCase();
      const origin = String((c as any).origin || 'submitted').toLowerCase();
      const ownerId = String((c as any).user_id || '');
      if (
        status === 'approved'
        && origin === 'submitted'
        && ownerId !== NPC_USER_ID
        && (review === '' || review === 'approved' || review === 'null')
        && !/\/starter\//i.test(String((c as any).image_path || ''))
      ) {
        set.add((c as any).id);
      }
    }
    return set;
  };

  const insertBracketForTournament = async (tournamentId: string, participants: CatRow[]) => {
    const entries = participants.map((cat, idx) => ({
      tournament_id: tournamentId,
      cat_id: cat.id,
      user_id: cat.user_id,
      seed: idx + 1,
      eliminated: false,
      votes: 0,
    }));
    await supabase.from('tournament_entries').insert(entries);

    const matches: Record<string, unknown>[] = [];
    const seededPairs = pairParticipantsAvoidingSameOwner(participants);
    for (const [a, b] of seededPairs) {
      matches.push({
        tournament_id: tournamentId,
        round: 1,
        cat_a_id: a.id,
        cat_b_id: b.id,
        status: 'active',
        votes_a: 0,
        votes_b: 0,
      });
    }
    await supabase.from('tournament_matches').insert(matches);
    return matches.length;
  };

  const { data: existingAny } = await supabase
    .from('tournaments')
    .select('id, status')
    .eq('date', date)
    .eq('tournament_type', type)
    .limit(1)
    .maybeSingle();

  let existingStatus = String(existingAny?.status || '').toLowerCase();
  if (existingAny?.id && ['active', 'in_progress'].includes(existingStatus)) {
    const { count: entryCount } = await supabase
      .from('tournament_entries')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', existingAny.id);

    const { data: activeProbe } = await supabase
      .from('tournament_matches')
      .select('id, cat_a_id, cat_b_id')
      .eq('tournament_id', existingAny.id)
      .eq('status', 'active')
      .limit(100);
    if (activeProbe && activeProbe.length > 0) {
      const eligibleIds = await eligibleCatIdsForMatches(activeProbe as Array<{ cat_a_id: string; cat_b_id: string }>);
      const validActive = (activeProbe as Array<{ cat_a_id: string; cat_b_id: string }>).some((m) => eligibleIds.has(m.cat_a_id) && eligibleIds.has(m.cat_b_id));
      const validSize = Number(entryCount || 0) === size;
      if (validActive && validSize) {
        return { created: false, id: existingAny.id };
      }
      // Tournament is "active" but all active matches reference invalid/removed cats.
      await supabase
        .from('tournament_matches')
        .update({ status: 'archived' })
        .eq('tournament_id', existingAny.id)
        .in('status', ['active', 'pending']);
      await supabase
        .from('tournaments')
        .update({ status: 'complete' })
        .eq('id', existingAny.id);
    }

    // Stuck or invalid tournament: no valid active matches left.
    await supabase
      .from('tournaments')
      .update({ status: 'complete' })
      .eq('id', existingAny.id);
    existingStatus = 'complete';
  }

  const participants = await pickParticipants(supabase, size, minNpcShare);
  if (participants.length < 2) {
    return { created: false, id: null, skipped: 'not_enough_cats' };
  }

  if (existingAny?.id) {
    const status = existingStatus;
    if (status === 'complete' || status === 'completed') {
      await supabase.from('tournament_matches').update({ status: 'archived' }).eq('tournament_id', existingAny.id);
      await supabase.from('tournament_entries').delete().eq('tournament_id', existingAny.id);
      await supabase
        .from('tournaments')
        .update({
          status: 'active',
          round: 1,
          champion_id: null,
          pulse_starts_at: pulse.pulseStartAt,
          vote_locks_at: pulse.voteLocksAt,
          resolves_at: pulse.resolvesAt,
        })
        .eq('id', existingAny.id);

      const matchCount = await insertBracketForTournament(existingAny.id, participants);
      return { created: true, recycled: true, id: existingAny.id, matches: matchCount };
    }
    return { created: false, id: existingAny.id, skipped: `existing_status:${existingAny.status}` };
  }

  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .insert({
      date,
      status: 'active',
      round: 1,
      tournament_type: type,
      pulse_starts_at: pulse.pulseStartAt,
      vote_locks_at: pulse.voteLocksAt,
      resolves_at: pulse.resolvesAt,
    })
    .select('id')
    .single();

  if (tErr || !tournament?.id) {
    return { created: false, id: null, skipped: tErr?.message || 'failed_create_tournament' };
  }
  const matchCount = await insertBracketForTournament(tournament.id, participants);
  return { created: true, id: tournament.id, matches: matchCount };
}

export async function ensureVotableMatches(params: {
  supabase: SupabaseClient;
  date: string;
  type: string;
  minVotable: number;
  size: number;
  minNpcShare: number;
}) {
  const { supabase, date, type, minVotable, size, minNpcShare } = params;
  await createTournamentIfMissing(supabase, date, type, size, minNpcShare);

  const { data: tournament, error: tErr } = await supabase
    .from('tournaments')
    .select('id, round, status')
    .eq('date', date)
    .eq('tournament_type', type)
    .in('status', ['active', 'in_progress'] as any)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (tErr) return { ok: false, error: tErr.message, inserted: 0, before: 0, after: 0, tournament_id: null };
  if (!tournament?.id) return { ok: false, error: 'no_active_tournament', inserted: 0, before: 0, after: 0, tournament_id: null };

  const { data: existingRows, error: mErr } = await supabase
    .from('tournament_matches')
    .select('id, cat_a_id, cat_b_id, status')
    .eq('tournament_id', tournament.id)
    .order('created_at', { ascending: false })
    .limit(500);
  if (mErr) return { ok: false, error: mErr.message, inserted: 0, before: 0, after: 0, tournament_id: tournament.id };

  const existing = existingRows || [];
  let droppedDuplicatePairCount = 0;
  let droppedDuplicateCatCount = 0;

  // Detect and clean up duplicate pair matches (keep newest by created_at)
  const pairToMatch = new Map<string, { id: string; created_at: string }>();
  const duplicateIds: string[] = [];
  for (const m of existing as Array<any>) {
    const a = String(m?.cat_a_id || '');
    const b = String(m?.cat_b_id || '');
    if (!a || !b || !m?.id) continue;
    const sig = a < b ? `${a}:${b}` : `${b}:${a}`;
    const existing_match = pairToMatch.get(sig);
    if (existing_match) {
      // Keep the one with later created_at
      const existingTime = Date.parse(String(existing_match.created_at || '')) || 0;
      const newTime = Date.parse(String(m.created_at || '')) || 0;
      if (newTime > existingTime) {
        duplicateIds.push(existing_match.id);
        pairToMatch.set(sig, { id: String(m.id), created_at: String(m.created_at || '') });
      } else {
        duplicateIds.push(String(m.id));
      }
    } else {
      pairToMatch.set(sig, { id: String(m.id), created_at: String(m.created_at || '') });
    }
  }

  // Delete duplicate matches if any found
  if (duplicateIds.length > 0) {
    console.warn(`[ensureVotableMatches] Cleaning up ${duplicateIds.length} duplicate matches`);
    await supabase.from('tournament_matches').delete().in('id', duplicateIds);
    droppedDuplicatePairCount = duplicateIds.length;
    // Refresh existing rows after cleanup
    const { data: refreshedRows } = await supabase
      .from('tournament_matches')
      .select('id, cat_a_id, cat_b_id, status')
      .eq('tournament_id', tournament.id)
      .order('created_at', { ascending: false })
      .limit(500);
    existingRows.splice(0, existingRows.length, ...(refreshedRows || []));
  }

  // Enforce per-cat uniqueness in votable pool (active/in_progress/pending).
  const votableRows = (existingRows || []).filter((m: any) =>
    ['active', 'in_progress', 'pending'].includes(String(m?.status || '').toLowerCase())
  );
  const sortedVotableRows = [...votableRows].sort((a: any, b: any) => {
    const pa = matchPriorityScore(String(a?.status || ''));
    const pb = matchPriorityScore(String(b?.status || ''));
    if (pb !== pa) return pb - pa;
    const ta = Date.parse(String(a?.created_at || '')) || 0;
    const tb = Date.parse(String(b?.created_at || '')) || 0;
    return tb - ta;
  });
  const usedCatIds = new Set<string>();
  const duplicateCatMatchIds: string[] = [];
  for (const m of sortedVotableRows as Array<any>) {
    const catA = String(m?.cat_a_id || '');
    const catB = String(m?.cat_b_id || '');
    if (!catA || !catB || !m?.id) continue;
    if (usedCatIds.has(catA) || usedCatIds.has(catB)) {
      duplicateCatMatchIds.push(String(m.id));
      continue;
    }
    usedCatIds.add(catA);
    usedCatIds.add(catB);
  }
  if (duplicateCatMatchIds.length > 0) {
    await supabase
      .from('tournament_matches')
      .update({ status: 'archived' })
      .in('id', duplicateCatMatchIds);
    droppedDuplicateCatCount = duplicateCatMatchIds.length;
    const { data: refreshedRows } = await supabase
      .from('tournament_matches')
      .select('id, cat_a_id, cat_b_id, status, created_at')
      .eq('tournament_id', tournament.id)
      .order('created_at', { ascending: false })
      .limit(500);
    existingRows.splice(0, existingRows.length, ...(refreshedRows || []));
  }

  const before = existingRows.filter((m: any) => VOTABLE_MATCH_STATUSES.includes(String(m?.status || '').toLowerCase() as any)).length;
  const needed = Math.max(0, minVotable - before);
  if (needed <= 0) return { ok: true, inserted: 0, before, after: before, tournament_id: tournament.id };

  // Build existing pairs set from cleaned data
  const existingPairs = new Set<string>();
  for (const m of existingRows as Array<any>) {
    const a = String(m?.cat_a_id || '');
    const b = String(m?.cat_b_id || '');
    if (!a || !b) continue;
    const sig = a < b ? `${a}:${b}` : `${b}:${a}`;
    existingPairs.add(sig);
  }

  const { data: cats, error: cErr } = await supabase
    .from('cats')
    .select('id, user_id, status, image_review_status, created_at, origin, image_path')
    .eq('status', 'approved')
    .eq('origin', 'submitted')
    .neq('user_id', NPC_USER_ID)
    .or('image_review_status.is.null,image_review_status.eq.approved')
    .order('created_at', { ascending: false })
    .limit(500);
  if (cErr) return { ok: false, error: cErr.message, inserted: 0, before, after: before, tournament_id: tournament.id };

  const pool = (cats || [])
    .map((c: any) => ({
      id: String(c?.id || ''),
      user_id: c?.user_id ? String(c.user_id) : '',
      created_at: String(c?.created_at || ''),
      image_path: String(c?.image_path || ''),
    }))
    .filter((c) => !/\/starter\//i.test(c.image_path))
    .filter((c) => !!c.id);

  // Build set of cats already in active matches
  const activeCatIds = new Set<string>();
  for (const m of existingRows) {
    if (m?.cat_a_id) activeCatIds.add(String(m.cat_a_id));
    if (m?.cat_b_id) activeCatIds.add(String(m.cat_b_id));
  }

  // Prioritize cats that haven't played yet, then by newest
  const neverPlayed = pool.filter((c) => !activeCatIds.has(c.id));
  const alreadyPlayed = pool.filter((c) => activeCatIds.has(c.id));

  const sortedNeverPlayed = [...neverPlayed].sort((a, b) =>
    (Date.parse(String(b.created_at || '')) || 0) - (Date.parse(String(a.created_at || '')) || 0)
  );
  const sortedAlreadyPlayed = shuffle(alreadyPlayed);

  // Take from neverPlayed first, then fill with alreadyPlayed
  const candidates = [...sortedNeverPlayed.slice(0, 300), ...sortedAlreadyPlayed.slice(0, 200)];

  const inserts: Array<Record<string, unknown>> = [];
  const usedThisRun = new Set<string>();
  const blockedCatIds = new Set<string>(activeCatIds);
  for (let i = 0; i < candidates.length && inserts.length < needed; i += 1) {
    const a = candidates[i];
    if (!a?.id) continue;
    if (blockedCatIds.has(a.id)) continue;
    for (let j = i + 1; j < candidates.length && inserts.length < needed; j += 1) {
      const b = candidates[j];
      if (!b?.id || b.id === a.id) continue;
      if (blockedCatIds.has(b.id)) continue;
      if (a.user_id && b.user_id && a.user_id === b.user_id) continue;
      const sig = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
      if (existingPairs.has(sig) || usedThisRun.has(sig)) continue;
      inserts.push({
        tournament_id: tournament.id,
        round: Math.max(1, Number(tournament.round || 1)),
        cat_a_id: a.id,
        cat_b_id: b.id,
        status: 'active',
        votes_a: 0,
        votes_b: 0,
      });
      usedThisRun.add(sig);
      blockedCatIds.add(a.id);
      blockedCatIds.add(b.id);
      break;
    }
  }

  if (inserts.length > 0) {
    const { error: insertErr } = await supabase.from('tournament_matches').insert(inserts);
    if (insertErr) return { ok: false, error: insertErr.message, inserted: 0, before, after: before, tournament_id: tournament.id };
  }

  const { count: afterCount } = await supabase
    .from('tournament_matches')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', tournament.id)
    .in('status', [...VOTABLE_MATCH_STATUSES] as any);

  if (process.env.NODE_ENV !== 'production') {
    console.debug('[DEV][tournament-votable-cleanup]', {
      tournamentId: String(tournament.id || ''),
      droppedDuplicatePairs: droppedDuplicatePairCount,
      droppedDuplicateCats: droppedDuplicateCatCount,
      replacementCount: inserts.length,
      needed,
      before,
      after: Number(afterCount || 0),
    });
  }

  return {
    ok: true,
    inserted: inserts.length,
    before,
    after: Number(afterCount || 0),
    tournament_id: tournament.id,
  };
}

async function resolveTournamentRound(supabase: SupabaseClient, tournament: TournamentRow) {
  const currentRound = tournament.round || 1;
  const { data: matches, error: mErr } = await supabase
    .from('tournament_matches')
    .select('id, tournament_id, round, cat_a_id, cat_b_id, votes_a, votes_b, locked_votes_a, locked_votes_b, locked_prob_a, locked_prob_b, winner_id, status, created_at, voting_locked_at, resolved_at')
    .eq('tournament_id', tournament.id)
    .eq('round', currentRound)
    .order('created_at', { ascending: true });

  if (mErr) return { ok: false, action: `error:${mErr.message}` };
  const roundMatches = (matches || []) as MatchRow[];
  if (roundMatches.length === 0) return { ok: true, action: 'no_matches' };

  const resolvable = roundMatches.filter((m) => m.status === 'locked' || m.status === 'active' || m.status === 'pending');
  const catIds = Array.from(
    new Set(
      resolvable
        .flatMap((m) => [m.cat_a_id, m.cat_b_id])
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
  );
  const [lockedSkillMap, streakMap] = await Promise.all([
    loadLockedSkillsForCats(supabase, catIds),
    loadCurrentStreakMap(supabase, catIds),
  ]);
  for (const match of resolvable) {
    const isByeMatch = match.cat_a_id === match.cat_b_id;
    if (isByeMatch) {
      const resolvedAt = new Date().toISOString();
      await supabase
        .from('tournament_matches')
        .update({
          status: 'complete',
          winner_id: match.cat_a_id,
          resolved_at: resolvedAt,
          resolution_source: 'bye_auto_advance',
        })
        .eq('id', match.id);
      continue;
    }

    const catBId = match.cat_b_id;
    if (!catBId) {
      continue;
    }

    const rawA = Number(match.locked_votes_a ?? match.votes_a ?? 0);
    const rawB = Number(match.locked_votes_b ?? match.votes_b ?? 0);
    const resolution = resolveMatchup(
      {
        votes: rawA,
        skill: lockedSkillMap[match.cat_a_id] || null,
        opponentStreak: Math.max(0, Number(streakMap[catBId] || 0)),
      },
      {
        votes: rawB,
        skill: lockedSkillMap[catBId] || null,
        opponentStreak: Math.max(0, Number(streakMap[match.cat_a_id] || 0)),
      },
      String(match.tournament_id || '')
    );
    const side = resolution.winnerSide;
    const winner = side === 'a' ? match.cat_a_id : catBId;
    const loser = winner === match.cat_a_id ? match.cat_b_id : match.cat_a_id;
    const resolvedAt = new Date().toISOString();

    await supabase
      .from('tournament_matches')
      .update({
        status: 'complete',
        winner_id: winner,
        resolved_at: resolvedAt,
        resolution_source: 'weighted_random_vote',
      })
      .eq('id', match.id);

    await resolvePredictionPayouts(supabase, match.id, winner);
    await recordResolvedMatchHistory(supabase, match, resolution, winner, loser, resolvedAt);

    const { data: winnerCat } = await supabase.from('cats').select('wins, battles_fought').eq('id', winner).maybeSingle();
    if (winnerCat) {
      await supabase
        .from('cats')
        .update({
          wins: (winnerCat.wins || 0) + 1,
          battles_fought: (winnerCat.battles_fought || 0) + 1,
        })
        .eq('id', winner);
      await logStatChange({
        catId: winner,
        catName: null,
        changeType: 'match_recorded',
        previousWins: Number(winnerCat.wins || 0),
        newWins: Number(winnerCat.wins || 0) + 1,
        previousLosses: 0,
        newLosses: 0,
        previousBattles: Number(winnerCat.battles_fought || 0),
        newBattles: Number(winnerCat.battles_fought || 0) + 1,
        timestamp: resolvedAt,
        source: 'tournament-engine',
        matchId: match.id,
      });
    }
    if (loser && loser !== winner) {
      const { data: loserCat } = await supabase.from('cats').select('losses, battles_fought').eq('id', loser).maybeSingle();
      if (loserCat) {
        await supabase
          .from('cats')
          .update({
            losses: (loserCat.losses || 0) + 1,
            battles_fought: (loserCat.battles_fought || 0) + 1,
          })
          .eq('id', loser);
        await logStatChange({
          catId: loser,
          catName: null,
          changeType: 'match_recorded',
          previousWins: 0,
          newWins: 0,
          previousLosses: Number(loserCat.losses || 0),
          newLosses: Number(loserCat.losses || 0) + 1,
          previousBattles: Number(loserCat.battles_fought || 0),
          newBattles: Number(loserCat.battles_fought || 0) + 1,
          timestamp: resolvedAt,
          source: 'tournament-engine',
          matchId: match.id,
        });
      }
    }
  }

  const { data: resolvedRound } = await supabase
    .from('tournament_matches')
    .select('id, winner_id')
    .eq('tournament_id', tournament.id)
    .eq('round', currentRound)
    .eq('status', 'complete')
    .order('created_at', { ascending: true });

  const winners = (resolvedRound || []).map((m) => m.winner_id).filter(Boolean) as string[];
  if (winners.length <= 1) {
    await supabase
      .from('tournaments')
      .update({
        status: 'complete',
        champion_id: winners[0] || tournament.champion_id || null,
      })
      .eq('id', tournament.id);
    return { ok: true, action: 'completed', champion: winners[0] || null };
  }

  const nextRound = currentRound + 1;
  const { data: nextRoundMatches } = await supabase
    .from('tournament_matches')
    .select('id')
    .eq('tournament_id', tournament.id)
    .eq('round', nextRound)
    .limit(1);

  if (!nextRoundMatches || nextRoundMatches.length === 0) {
    const inserts: Record<string, unknown>[] = [];
    for (let i = 0; i < winners.length; i += 2) {
      const a = winners[i];
      const b = winners[i + 1] || null;
      if (!b) {
        inserts.push({
          tournament_id: tournament.id,
          round: nextRound,
          cat_a_id: a,
          cat_b_id: null,
          status: 'complete',
          winner_id: a,
          votes_a: 0,
          votes_b: 0,
          resolved_at: new Date().toISOString(),
          resolution_source: 'bye_auto_advance',
        });
        continue;
      }
      inserts.push({
        tournament_id: tournament.id,
        round: nextRound,
        cat_a_id: a,
        cat_b_id: b,
        status: 'active',
        votes_a: 0,
        votes_b: 0,
      });
    }
    await supabase.from('tournament_matches').insert(inserts);
  }

  await supabase.from('tournaments').update({ round: nextRound }).eq('id', tournament.id);
  return { ok: true, action: 'advanced', next_round: nextRound };
}

async function cleanupIneligibleVotableMatches(supabase: SupabaseClient, date: string) {
  const { data: tRows } = await supabase
    .from('tournaments')
    .select('id, tournament_type')
    .eq('date', date)
    .in('tournament_type', ['main', 'rookie'] as any)
    .in('status', ['active', 'in_progress'] as any);
  const tournamentIds = (tRows || []).map((t: any) => String(t?.id || '')).filter(Boolean);
  if (tournamentIds.length === 0) return { updated: 0 };

  const { data: matches } = await supabase
    .from('tournament_matches')
    .select('id, cat_a_id, cat_b_id, status')
    .in('tournament_id', tournamentIds)
    .in('status', ['active', 'in_progress', 'pending'] as any)
    .limit(1000);

  const catIds = Array.from(new Set((matches || []).flatMap((m: any) => [String(m?.cat_a_id || ''), String(m?.cat_b_id || '')]).filter(Boolean)));
  if (catIds.length === 0) return { updated: 0 };

  const { data: cats } = await supabase
    .from('cats')
    .select('id, user_id, status, image_review_status, origin, image_path')
    .in('id', catIds);

  const badCatIds = new Set<string>();
  for (const c of cats || []) {
    const status = String((c as any).status || '').toLowerCase();
    const review = String((c as any).image_review_status || '').toLowerCase();
    const origin = String((c as any).origin || 'submitted').toLowerCase();
    const ownerId = String((c as any).user_id || '');
    const imagePath = String((c as any).image_path || '');
    const eligible = status === 'approved'
      && origin === 'submitted'
      && ownerId !== NPC_USER_ID
      && (review === '' || review === 'approved' || review === 'null')
      && !/\/starter\//i.test(imagePath);
    if (!eligible) badCatIds.add(String((c as any).id || ''));
  }
  const badIds = Array.from(badCatIds).filter(Boolean);
  if (badIds.length === 0) return { updated: 0 };

  const { data: toCompleteA } = await supabase
    .from('tournament_matches')
    .select('id')
    .in('tournament_id', tournamentIds)
    .in('status', ['active', 'in_progress', 'pending'] as any)
    .in('cat_a_id', badIds);
  const { data: toCompleteB } = await supabase
    .from('tournament_matches')
    .select('id')
    .in('tournament_id', tournamentIds)
    .in('status', ['active', 'in_progress', 'pending'] as any)
    .in('cat_b_id', badIds);
  const ids = Array.from(new Set([...(toCompleteA || []), ...(toCompleteB || [])].map((m: any) => String(m?.id || '')).filter(Boolean)));
  if (ids.length === 0) return { updated: 0 };

  const { error } = await supabase
    .from('tournament_matches')
    .update({ status: 'complete' })
    .in('id', ids);
  if (error) return { updated: 0, error: error.message };
  return { updated: ids.length };
}

export async function runTournamentTick(options?: { includeOldActive?: boolean; resolveRounds?: boolean }) {
  const supabase = supabaseAdmin();
  const now = new Date();
  const pulse = await computePulseWindow(now);
  const today = await currentPulseKey(now);
  const includeOldActive = options?.includeOldActive ?? true;
  const resolveRounds = options?.resolveRounds ?? true;
  const actions: Array<Record<string, unknown>> = [];

  for (const cfg of TOURNAMENT_CONFIG) {
    const result = await createTournamentIfMissing(supabase, today, cfg.type, cfg.size, cfg.minNpcShare);
    actions.push({ type: cfg.type, create: result });
  }

  for (const cfg of TOURNAMENT_CONFIG) {
    const topup = await ensureVotableMatches({
      supabase,
      date: today,
      type: cfg.type,
      minVotable: 36,
      size: cfg.size,
      minNpcShare: cfg.minNpcShare,
    });
    actions.push({ type: cfg.type, topup_votable: topup });
  }

  const cleanup = await cleanupIneligibleVotableMatches(supabase, today);
  actions.push({ cleanup_ineligible_votable: cleanup });

  if (resolveRounds) {
    const statusFilter = ['active', 'in_progress', 'locked'];
    let query = supabase
      .from('tournaments')
      .select('id, date, status, round, tournament_type, champion_id')
      .in('status', statusFilter)
      .order('date', { ascending: false });
    if (!includeOldActive) query = query.eq('date', today);

    const { data: tournaments, error: tErr } = await query;
    if (tErr) return { ok: false, error: tErr.message, actions };

    for (const t of (tournaments || []) as TournamentRow[]) {
      if (pulse.isLocked && !pulse.isResolving) {
        const result = await lockPulse(supabase, t.date, pulse.voteLocksAt);
        actions.push({
          type: t.tournament_type || 'main',
          tournament_id: t.id,
          date: t.date,
          result,
        });
      } else if (pulse.isResolving) {
        const result = await resolveTournamentRound(supabase, t);
        actions.push({
          type: t.tournament_type || 'main',
          tournament_id: t.id,
          date: t.date,
          result,
        });
      }
    }

    // Self-heal: if a tournament was resolved into "complete" or got stuck with
    // no active matches, immediately attempt to create/recycle today's bracket.
    for (const cfg of TOURNAMENT_CONFIG) {
      const retry = await createTournamentIfMissing(supabase, today, cfg.type, cfg.size, cfg.minNpcShare);
      actions.push({ type: cfg.type, recreate_after_resolve: retry });
    }
  }

  return { ok: true, actions };
}
