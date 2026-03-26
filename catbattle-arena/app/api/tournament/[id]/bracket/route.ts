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

    const matches = (matchRows || []).map((row: MatchRow) => ({
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
      cat_a: row.cat_a_id ? catMap.get(String(row.cat_a_id)) || null : null,
      cat_b: row.cat_b_id ? catMap.get(String(row.cat_b_id)) || null : null,
    })).filter((row) => !!row.cat_a && !!row.cat_b);

    const champion = tournament.champion_id ? catMap.get(String(tournament.champion_id)) || null : null;

    return NextResponse.json({
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
      round_count: new Set(matches.map((m) => m.round)).size,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
