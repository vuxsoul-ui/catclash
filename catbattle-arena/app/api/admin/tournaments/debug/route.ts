import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '../../_lib/auth';
import { NPC_USER_ID } from '../../../_lib/tournament-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const date = todayUtc();
    const { data: tournaments, error: tErr } = await supabase
      .from('tournaments')
      .select('id, tournament_type, status, round, champion_id, created_at')
      .eq('date', date)
      .in('tournament_type', ['main', 'rookie'])
      .order('created_at', { ascending: false });
    if (tErr) return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });

    const ids = (tournaments || []).map((t) => String(t.id || '')).filter(Boolean);
    const [entryRes, matchRes, npcRes, catsRes] = await Promise.all([
      ids.length
        ? supabase
            .from('tournament_entries')
            .select('tournament_id, cat_id, user_id', { count: 'exact' })
            .in('tournament_id', ids)
        : Promise.resolve({ data: [], count: 0, error: null } as any),
      ids.length
        ? supabase
            .from('tournament_matches')
            .select('tournament_id, status', { count: 'exact' })
            .in('tournament_id', ids)
        : Promise.resolve({ data: [], count: 0, error: null } as any),
      supabase.from('cats').select('id, name, status, image_path, created_at').eq('user_id', NPC_USER_ID).order('created_at', { ascending: false }).limit(20),
      supabase.from('cats').select('id, status', { count: 'exact', head: true }).eq('status', 'approved'),
    ]);

    const entryByTournament: Record<string, number> = {};
    const npcEntriesByTournament: Record<string, number> = {};
    for (const e of (entryRes.data || [])) {
      const tid = String((e as any).tournament_id || '');
      if (!tid) continue;
      entryByTournament[tid] = (entryByTournament[tid] || 0) + 1;
      if (String((e as any).user_id || '') === NPC_USER_ID) {
        npcEntriesByTournament[tid] = (npcEntriesByTournament[tid] || 0) + 1;
      }
    }

    const matchStatusByTournament: Record<string, Record<string, number>> = {};
    for (const m of (matchRes.data || [])) {
      const tid = String((m as any).tournament_id || '');
      const st = String((m as any).status || 'unknown');
      if (!tid) continue;
      if (!matchStatusByTournament[tid]) matchStatusByTournament[tid] = {};
      matchStatusByTournament[tid][st] = (matchStatusByTournament[tid][st] || 0) + 1;
    }

    const rows = (tournaments || []).map((t) => ({
      id: t.id,
      type: t.tournament_type || 'main',
      status: t.status,
      round: t.round || 1,
      entries: entryByTournament[t.id] || 0,
      npc_entries: npcEntriesByTournament[t.id] || 0,
      match_status: matchStatusByTournament[t.id] || {},
      expected_entries: 8,
      full_bracket: (entryByTournament[t.id] || 0) === 8,
    }));

    const main = rows.find((r) => r.type === 'main') || null;
    const rookie = rows.find((r) => r.type === 'rookie') || null;

    return NextResponse.json({
      ok: true,
      day: date,
      tournaments: rows,
      summary: {
        main,
        rookie,
        all_approved_cats: Number(catsRes.count || 0),
      },
      npc_pool: {
        user_id: NPC_USER_ID,
        approved_count: (npcRes.data || []).filter((c) => String((c as any).status || '').toLowerCase() === 'approved').length,
        recent: (npcRes.data || []).slice(0, 8).map((c) => ({
          id: (c as any).id,
          name: (c as any).name,
          status: (c as any).status,
          image_path: (c as any).image_path,
          created_at: (c as any).created_at,
        })),
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
