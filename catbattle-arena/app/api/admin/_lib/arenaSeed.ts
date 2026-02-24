import { createClient } from '@supabase/supabase-js';

const OWNER_MATCH_CAP_PER_RUN = 2;
const MAX_SEED_COUNT = 50;
const CANDIDATE_LIMIT = 200;
const ACTIVE_MATCH_SCAN_LIMIT = 200;
const VOTABLE_STATUSES = ['active', 'in_progress', 'pending'] as const;
const NPC_USER_ID = '00000000-0000-0000-0000-000000000000';

export type TournamentTypeInput = 'rookie' | 'main' | 'both';
type ArenaType = 'rookie' | 'main';

type CandidateCat = {
  id: string;
  user_id: string | null;
  created_at: string | null;
};

type ActiveTournament = {
  id: string;
  tournament_type: ArenaType;
  round: number | null;
  created_at: string | null;
};

type MatchRow = {
  cat_a_id: string;
  cat_b_id: string;
};

const supabase = createClient(
  String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\s/g, '').trim(),
  String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export function clampSeedCount(input: unknown): number {
  const n = Number(input);
  if (!Number.isFinite(n)) return 12;
  return Math.max(2, Math.min(MAX_SEED_COUNT, Math.floor(n)));
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function toPairSig(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function orderCandidates(cats: CandidateCat[], prioritizeNew: boolean): CandidateCat[] {
  const byNewest = [...cats].sort((a, b) => {
    const ta = Date.parse(String(a.created_at || '')) || 0;
    const tb = Date.parse(String(b.created_at || '')) || 0;
    return tb - ta;
  });
  if (!prioritizeNew) return shuffle(byNewest);
  const head = byNewest.slice(0, 120);
  const tail = shuffle(byNewest.slice(120));
  return [...head, ...tail];
}

function allocateByArena(tournamentType: TournamentTypeInput, seedCount: number) {
  if (tournamentType === 'rookie') return { rookie: seedCount, main: 0 };
  if (tournamentType === 'main') return { rookie: 0, main: seedCount };
  return { rookie: Math.floor(seedCount / 2), main: seedCount - Math.floor(seedCount / 2) };
}

function pickSeedPairs(params: {
  candidates: CandidateCat[];
  target: number;
  existingPairSigs: Set<string>;
  activeCatIds: Set<string>;
  ownerMatchCount: Map<string, number>;
}) {
  const { candidates, target, existingPairSigs, activeCatIds, ownerMatchCount } = params;
  const picked: Array<{ cat_a_id: string; cat_b_id: string }> = [];
  const chosenPairSigs = new Set<string>();
  const catUseCount = new Map<string, number>();

  const partitioned = [
    ...candidates.filter((c) => !activeCatIds.has(c.id)),
    ...candidates.filter((c) => activeCatIds.has(c.id)),
  ];

  const attempt = (maxCatUse: number) => {
    for (let i = 0; i < partitioned.length; i += 1) {
      if (picked.length >= target) return;
      const a = partitioned[i];
      if ((catUseCount.get(a.id) || 0) >= maxCatUse) continue;
      for (let j = i + 1; j < partitioned.length; j += 1) {
        if (picked.length >= target) return;
        const b = partitioned[j];
        if (!a.id || !b.id || a.id === b.id) continue;
        if ((catUseCount.get(b.id) || 0) >= maxCatUse) continue;
        if (a.user_id && b.user_id && a.user_id === b.user_id) continue;

        const pairSig = toPairSig(a.id, b.id);
        if (existingPairSigs.has(pairSig) || chosenPairSigs.has(pairSig)) continue;
        if (a.user_id && (ownerMatchCount.get(a.user_id) || 0) >= OWNER_MATCH_CAP_PER_RUN) continue;
        if (b.user_id && (ownerMatchCount.get(b.user_id) || 0) >= OWNER_MATCH_CAP_PER_RUN) continue;

        picked.push({ cat_a_id: a.id, cat_b_id: b.id });
        chosenPairSigs.add(pairSig);
        catUseCount.set(a.id, (catUseCount.get(a.id) || 0) + 1);
        catUseCount.set(b.id, (catUseCount.get(b.id) || 0) + 1);
        if (a.user_id) ownerMatchCount.set(a.user_id, (ownerMatchCount.get(a.user_id) || 0) + 1);
        if (b.user_id) ownerMatchCount.set(b.user_id, (ownerMatchCount.get(b.user_id) || 0) + 1);
        break;
      }
    }
  };

  attempt(1);
  if (picked.length < target) attempt(2);
  return picked;
}

async function seedForArena(params: {
  arena: ArenaType;
  target: number;
  prioritizeNew: boolean;
  ownerMatchCount: Map<string, number>;
  tournamentId?: string | null;
}) {
  const { arena, target, prioritizeNew, ownerMatchCount, tournamentId } = params;
  if (target <= 0) return { inserted: 0, catsUsed: new Set<string>(), tournamentId: '' };

  let activeTournament: ActiveTournament | null = null;
  if (tournamentId) {
    const { data: tournamentRow, error: rowErr } = await supabase
      .from('tournaments')
      .select('id, tournament_type, round, created_at')
      .eq('id', tournamentId)
      .maybeSingle();
    if (rowErr) throw new Error(rowErr.message);
    if (tournamentRow) activeTournament = tournamentRow as ActiveTournament;
  } else {
    const { data: tournaments, error: tErr } = await supabase
      .from('tournaments')
      .select('id, tournament_type, round, created_at')
      .in('status', ['active', 'in_progress'] as any)
      .eq('tournament_type', arena)
      .order('created_at', { ascending: false })
      .limit(3);
    if (tErr) throw new Error(tErr.message);
    activeTournament = ((tournaments || []) as ActiveTournament[])[0] || null;
  }
  if (!activeTournament?.id) return { inserted: 0, catsUsed: new Set<string>(), tournamentId: '' };

  const { count: beforeVotableCount } = await supabase
    .from('tournament_matches')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', activeTournament.id)
    .in('status', ['active', 'in_progress'] as any);

  const [candidatesRes, activeRes] = await Promise.all([
    supabase
      .from('cats')
      .select('id, user_id, created_at, status, image_review_status, origin, image_path, image_url_thumb')
      .eq('status', 'approved')
      .eq('origin', 'submitted')
      .neq('user_id', NPC_USER_ID)
      .order('created_at', { ascending: false })
      .limit(CANDIDATE_LIMIT),
    supabase
      .from('tournament_matches')
      .select('cat_a_id, cat_b_id')
      .eq('tournament_id', activeTournament.id)
      .in('status', [...VOTABLE_STATUSES] as any)
      .order('created_at', { ascending: false })
      .limit(ACTIVE_MATCH_SCAN_LIMIT),
  ]);
  if (candidatesRes.error) throw new Error(candidatesRes.error.message);
  if (activeRes.error) throw new Error(activeRes.error.message);

  const candidateCats = ((candidatesRes.data || []) as Array<any>)
    .filter((c) => {
      const review = String(c.image_review_status || '').toLowerCase();
      if (!(review === '' || review === 'approved')) return false;
      const imageHint = String(c.image_url_thumb || c.image_path || '');
      return !/\/starter\//i.test(imageHint);
    })
    .map((c) => ({
      id: String(c.id),
      user_id: c.user_id ? String(c.user_id) : null,
      created_at: c.created_at ? String(c.created_at) : null,
    }))
    .filter((c) => !!c.id);

  const orderedCandidates = orderCandidates(candidateCats, prioritizeNew);
  const activeMatches = (activeRes.data || []) as MatchRow[];
  const activeCatIds = new Set<string>();
  const existingPairSigs = new Set<string>();
  for (const m of activeMatches) {
    if (!m?.cat_a_id || !m?.cat_b_id) continue;
    activeCatIds.add(String(m.cat_a_id));
    activeCatIds.add(String(m.cat_b_id));
    existingPairSigs.add(toPairSig(String(m.cat_a_id), String(m.cat_b_id)));
  }

  const pairs = pickSeedPairs({
    candidates: orderedCandidates,
    target,
    existingPairSigs,
    activeCatIds,
    ownerMatchCount,
  });

  if (pairs.length === 0) return { inserted: 0, catsUsed: new Set<string>(), tournamentId: String(activeTournament.id) };

  const rows = pairs.map((p) => ({
    tournament_id: activeTournament.id,
    round: Math.max(1, Number(activeTournament?.round || 1)),
    cat_a_id: p.cat_a_id,
    cat_b_id: p.cat_b_id,
    status: 'active',
    votes_a: 0,
    votes_b: 0,
  }));
  const insertRes = await supabase
    .from('tournament_matches')
    .insert(rows)
    .select('id, tournament_id, status, created_at, cat_a_id, cat_b_id');
  if (insertRes.error) throw new Error(insertRes.error.message);

  const { data: newestRows, error: newestErr } = await supabase
    .from('tournament_matches')
    .select('id, tournament_id, status, created_at')
    .eq('tournament_id', activeTournament.id)
    .order('created_at', { ascending: false })
    .limit(5);
  if (newestErr) throw new Error(newestErr.message);

  const insertedIds = new Set((insertRes.data || []).map((r: any) => String(r?.id || '')));
  const covered = (newestRows || []).filter((r: any) => insertedIds.has(String(r?.id || '')));
  if (covered.length === 0 && insertedIds.size > 0) {
    throw new Error(`seed verification failed: inserted rows not in newest window for tournament ${activeTournament.id}`);
  }
  for (const row of covered) {
    const tid = String((row as any).tournament_id || '');
    const st = String((row as any).status || '').toLowerCase();
    if (tid !== String(activeTournament.id)) {
      throw new Error(`seed verification failed: tournament mismatch for row ${String((row as any).id || '')}`);
    }
    if (!VOTABLE_STATUSES.includes(st as any)) {
      throw new Error(`seed verification failed: status mismatch (${st}) for row ${String((row as any).id || '')}`);
    }
  }

  const catsUsed = new Set<string>();
  for (const row of insertRes.data || []) {
    if ((row as any).cat_a_id) catsUsed.add(String((row as any).cat_a_id));
    if ((row as any).cat_b_id) catsUsed.add(String((row as any).cat_b_id));
  }
  const { count: afterVotableCount } = await supabase
    .from('tournament_matches')
    .select('id', { count: 'exact', head: true })
    .eq('tournament_id', activeTournament.id)
    .in('status', ['active', 'in_progress'] as any);
  const before = Number(beforeVotableCount || 0);
  const after = Number(afterVotableCount || 0);
  if (after <= before && (insertRes.data || []).length > 0) {
    throw new Error(`seed verification failed: votable count did not increase for tournament ${activeTournament.id}`);
  }

  return {
    inserted: (insertRes.data || []).length,
    catsUsed,
    tournamentId: String(activeTournament.id),
    votableBefore: before,
    votableAfter: after,
  };
}

export async function runAdminArenaSeed(params: {
  tournamentType: TournamentTypeInput;
  seedCount: number;
  prioritizeNew?: boolean;
  tournamentIds?: Partial<Record<ArenaType, string>>;
}) {
  const tournamentType = params.tournamentType;
  if (!['rookie', 'main', 'both'].includes(tournamentType)) {
    throw new Error('Invalid tournamentType');
  }
  const seedCount = clampSeedCount(params.seedCount);
  const prioritizeNew = params.prioritizeNew !== false;
  const split = allocateByArena(tournamentType, seedCount);
  const ownerMatchCount = new Map<string, number>();

  const rookieResult = await seedForArena({
    arena: 'rookie',
    target: split.rookie,
    prioritizeNew,
    ownerMatchCount,
    tournamentId: params.tournamentIds?.rookie || null,
  });
  const mainResult = await seedForArena({
    arena: 'main',
    target: split.main,
    prioritizeNew,
    ownerMatchCount,
    tournamentId: params.tournamentIds?.main || null,
  });

  const catsUsed = new Set<string>([...rookieResult.catsUsed, ...mainResult.catsUsed]);
  const insertedMatches = rookieResult.inserted + mainResult.inserted;

  return {
    insertedMatches,
    rookieInserted: rookieResult.inserted,
    mainInserted: mainResult.inserted,
    catsUsed: catsUsed.size,
    mainVotableBefore: Number((mainResult as any).votableBefore || 0),
    mainVotableAfter: Number((mainResult as any).votableAfter || 0),
    rookieVotableBefore: Number((rookieResult as any).votableBefore || 0),
    rookieVotableAfter: Number((rookieResult as any).votableAfter || 0),
    mainTournamentId: String(mainResult.tournamentId || ''),
    rookieTournamentId: String(rookieResult.tournamentId || ''),
  };
}

