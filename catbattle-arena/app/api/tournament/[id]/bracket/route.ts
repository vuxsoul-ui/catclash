import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { thumbUrlForCat } from '../../../../lib/cat-images';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type CatRow = {
  id: string;
  name: string;
  rarity: string | null;
  cat_level?: number | null;
  level?: number | null;
  ability?: string | null;
  wins?: number | null;
  losses?: number | null;
};

type MatchRow = {
  id: string;
  round: number;
  cat_a_id: string | null;
  cat_b_id: string | null;
  winner_id: string | null;
  status: string | null;
  votes_a: number | null;
  votes_b: number | null;
  created_at: string | null;
};

function nextPowerOfTwo(n: number) {
  if (n <= 1) return 2;
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function minBracketSizeForRound(round: number) {
  if (round <= 1) return 2;
  return 2 ** Math.ceil(Math.log2(2 ** round));
}

function statusPriority(status: string, isCurrentRound: boolean) {
  const normalized = String(status || '').toLowerCase();
  if (isCurrentRound && (normalized === 'pending' || normalized === 'open' || normalized === 'active')) return 0;
  if (normalized === 'pending' || normalized === 'open' || normalized === 'active') return 1;
  if (normalized === 'voted') return 2;
  if (normalized === 'resolved' || normalized === 'complete' || normalized === 'completed') return 3;
  return 4;
}

function isOpenLikeStatus(status: string) {
  const normalized = String(status || '').toLowerCase();
  return normalized === 'pending' || normalized === 'open' || normalized === 'active' || normalized === 'in_progress';
}

function toCatDto(row: CatRow | null | undefined) {
  if (!row?.id) return null;
  return {
    id: String(row.id),
    name: String(row.name || 'Unknown'),
    rarity: String(row.rarity || 'Common'),
    level: Math.max(1, Number(row.cat_level || row.level || 1)),
    ability: row.ability || null,
    wins: Number(row.wins || 0),
    losses: Number(row.losses || 0),
    image_url: thumbUrlForCat(String(row.id)),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tournamentId = String(id || '').trim();
    if (!tournamentId) {
      return NextResponse.json({ ok: false, error: 'missing_tournament_id' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: tournament, error: tournamentErr } = await supabase
      .from('tournaments')
      .select('id, date, round, status, tournament_type, champion_id, created_at')
      .eq('id', tournamentId)
      .maybeSingle();

    if (tournamentErr) {
      return NextResponse.json({ ok: false, error: tournamentErr.message }, { status: 500 });
    }
    if (!tournament) {
      return NextResponse.json({ ok: false, error: 'tournament_not_found' }, { status: 404 });
    }

    const { data: matchRows, error: matchErr } = await supabase
      .from('tournament_matches')
      .select('id, round, cat_a_id, cat_b_id, winner_id, status, votes_a, votes_b, created_at')
      .eq('tournament_id', tournamentId)
      .order('round', { ascending: true })
      .order('created_at', { ascending: true });

    if (matchErr) {
      return NextResponse.json({ ok: false, error: matchErr.message }, { status: 500 });
    }

    const catIds = new Set<string>();
    for (const row of matchRows || []) {
      if (row.cat_a_id) catIds.add(String(row.cat_a_id));
      if (row.cat_b_id) catIds.add(String(row.cat_b_id));
      if (row.winner_id) catIds.add(String(row.winner_id));
    }
    if (tournament.champion_id) catIds.add(String(tournament.champion_id));

    const { data: catRows, error: catErr } = catIds.size > 0
      ? await supabase
        .from('cats')
        .select('id, name, rarity, cat_level, level, ability, wins, losses')
        .in('id', Array.from(catIds))
      : { data: [] as CatRow[], error: null as { message?: string } | null };

    if (catErr) {
      return NextResponse.json({ ok: false, error: catErr.message }, { status: 500 });
    }

    const catMap = new Map<string, ReturnType<typeof toCatDto>>();
    for (const row of (catRows || []) as CatRow[]) {
      const dto = toCatDto(row);
      if (dto) catMap.set(dto.id, dto);
    }

    const rawMatches = (matchRows || []).map((row: MatchRow) => ({
      match_id: String(row.id),
      round: Number(row.round || 1),
      status: String(row.status || 'pending'),
      winner_id: row.winner_id ? String(row.winner_id) : null,
      votes_a: Number(row.votes_a || 0),
      votes_b: Number(row.votes_b || 0),
      total_votes: Number(row.votes_a || 0) + Number(row.votes_b || 0),
      created_at: row.created_at || null,
      cat_a_id: row.cat_a_id ? String(row.cat_a_id) : null,
      cat_b_id: row.cat_b_id ? String(row.cat_b_id) : null,
      cat_a: row.cat_a_id
        ? catMap.get(String(row.cat_a_id)) || {
            id: String(row.cat_a_id),
            name: 'Unknown',
            rarity: 'Common',
            level: 1,
            ability: null,
            wins: 0,
            losses: 0,
            image_url: thumbUrlForCat(String(row.cat_a_id)),
          }
        : null,
      cat_b: row.cat_b_id
        ? catMap.get(String(row.cat_b_id)) || {
            id: String(row.cat_b_id),
            name: 'Unknown',
            rarity: 'Common',
            level: 1,
            ability: null,
            wins: 0,
            losses: 0,
            image_url: thumbUrlForCat(String(row.cat_b_id)),
          }
        : null,
    })).filter((row) => !!row.cat_a_id && !!row.cat_b_id);

    const { count: entryCount } = await supabase
      .from('tournament_entries')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId);

    const participantCount = Math.max(2, Number(entryCount || 0));
    const roundOneCount = rawMatches.filter((m) => Number(m.round || 1) === 1).length;
    const observedBracketFromRoundOne = roundOneCount > 0 ? nextPowerOfTwo(roundOneCount * 2) : 2;
    const maxRoundInRows = rawMatches.reduce((max, m) => Math.max(max, Number(m.round || 1)), 1);
    const roundFloor = Math.max(Number(tournament.round || 1), maxRoundInRows);
    const baseBracketSize = nextPowerOfTwo(participantCount);
    const roundDrivenBracketSize = minBracketSizeForRound(roundFloor);
    const bracketSize = Math.max(baseBracketSize, roundDrivenBracketSize, observedBracketFromRoundOne);
    const totalRounds = Math.max(Math.log2(bracketSize), roundFloor);
    const expectedByRound = new Map<number, number>();
    for (let r = 1; r <= totalRounds; r += 1) {
      expectedByRound.set(r, Math.max(1, bracketSize / 2 ** r));
    }

    const byRound = new Map<number, typeof rawMatches>();
    for (const m of rawMatches) {
      if (!byRound.has(m.round)) byRound.set(m.round, []);
      byRound.get(m.round)!.push(m);
    }

    const matches: typeof rawMatches = [];
    const dropDebug = {
      invalid_empty_side: 0,
      invalid_same_cat: 0,
      duplicate_pair: 0,
      capped_by_round_limit: 0,
    };
    for (let round = 1; round <= totalRounds; round += 1) {
      const bucket = (byRound.get(round) || []).slice().sort((a, b) => {
        const aPriority = statusPriority(a.status, round === Number(tournament.round || 1));
        const bPriority = statusPriority(b.status, round === Number(tournament.round || 1));
        if (aPriority !== bPriority) return aPriority - bPriority;
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      });
      if (!bucket.length) continue;
      const wanted = Number(expectedByRound.get(round) || 0);
      const seenPair = new Set<string>();
      const picked: typeof rawMatches = [];
      const mustKeepCurrentOpen = round === Number(tournament.round || 1)
        ? bucket.filter((m) => isOpenLikeStatus(m.status))
        : [];
      for (const m of bucket) {
        const a = String(m.cat_a?.id || '');
        const b = String(m.cat_b?.id || '');
        if (!a || !b) {
          dropDebug.invalid_empty_side += 1;
          continue;
        }
        if (a === b) {
          dropDebug.invalid_same_cat += 1;
          continue;
        }
        const pairKey = [a, b].sort().join(':');
        const keepDuplicateIfCurrentOpen =
          round === Number(tournament.round || 1) &&
          statusPriority(m.status, true) <= 1;
        if (!keepDuplicateIfCurrentOpen && seenPair.has(pairKey)) {
          dropDebug.duplicate_pair += 1;
          continue;
        }
        seenPair.add(pairKey);
        picked.push(m);
        const isMustKeep = mustKeepCurrentOpen.some((openMatch) => openMatch.match_id === m.match_id);
        if (!isMustKeep && picked.length >= wanted) {
          break;
        }
      }
      if (picked.length > wanted) {
        dropDebug.capped_by_round_limit += Math.max(0, picked.length - wanted);
      }
      matches.push(...picked);
    }

    const champion = tournament.champion_id ? catMap.get(String(tournament.champion_id)) || null : null;

    const response = {
      ok: true,
      success: true,
      tournament: {
        id: String(tournament.id),
        date: String(tournament.date || ''),
        round: Number(tournament.round || 1),
        status: String(tournament.status || ''),
        tournament_type: String(tournament.tournament_type || 'main'),
        champion_id: tournament.champion_id ? String(tournament.champion_id) : null,
        created_at: tournament.created_at || null,
        champion,
      },
      matches,
      bracket_size: bracketSize,
      expected_match_count: bracketSize - 1,
      round_count: new Set(matches.map((m) => m.round)).size,
    } as Record<string, unknown>;

    if (process.env.NODE_ENV !== 'production') {
      response.debug = {
        raw_match_count: rawMatches.length,
        kept_match_count: matches.length,
        dropped_match_count: Math.max(0, rawMatches.length - matches.length),
        drop_reasons: dropDebug,
        current_round: Number(tournament.round || 1),
        current_round_open_kept: matches.filter((m) => m.round === Number(tournament.round || 1) && isOpenLikeStatus(m.status)).length,
      };
    }

    return NextResponse.json(response);
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
