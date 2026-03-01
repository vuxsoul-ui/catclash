import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '../../_lib/auth';
import { clampSeedCount, runAdminArenaSeed, TournamentTypeInput } from '../../_lib/arenaSeed';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

function supabaseAdmin() {
  return createClient(
    String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\s/g, '').trim(),
    String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const seed = String(body?.seed || 'both') as TournamentTypeInput;
  const seedNewest = body?.seedNewest !== false;
  const seedCount = clampSeedCount(body?.seedCount);
  if (!['both', 'main', 'rookie'].includes(seed)) {
    return NextResponse.json({ ok: false, error: 'Invalid seed selection' }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data: oldRows, error: oldErr } = await sb
    .from('tournaments')
    .select('id, tournament_type')
    .in('status', ['active', 'in_progress'] as any)
    .in('tournament_type', ['main', 'rookie'] as any)
    .order('created_at', { ascending: false });
  if (oldErr) {
    return NextResponse.json({ ok: false, error: oldErr.message }, { status: 500 });
  }
  const oldTournamentIds = (oldRows || []).map((r: any) => String(r?.id || '')).filter(Boolean);
  const oldTournamentId = oldTournamentIds[0] || null;

  if (oldTournamentIds.length > 0) {
    const { error: closeErr } = await sb
      .from('tournaments')
      .update({ status: 'complete' })
      .in('id', oldTournamentIds);
    if (closeErr) {
      return NextResponse.json({ ok: false, error: closeErr.message }, { status: 500 });
    }
  }

  const date = todayUtc();
  const createdByType: Record<'main' | 'rookie', string> = { main: '', rookie: '' };
  for (const type of ['main', 'rookie'] as const) {
    const { data: existingToday, error: existingErr } = await sb
      .from('tournaments')
      .select('id')
      .eq('date', date)
      .eq('tournament_type', type)
      .maybeSingle();
    if (existingErr) {
      return NextResponse.json({ ok: false, error: existingErr.message }, { status: 500 });
    }

    let tournamentId = '';
    if (existingToday?.id) {
      tournamentId = String(existingToday.id);
      const { error: resetErr } = await sb
        .from('tournaments')
        .update({ status: 'active', round: 1, champion_id: null })
        .eq('id', tournamentId);
      if (resetErr) {
        return NextResponse.json({ ok: false, error: resetErr.message }, { status: 500 });
      }

      await sb.from('tournament_matches').delete().eq('tournament_id', tournamentId);
      await sb.from('arena_match_queue').delete().eq('tournament_id', tournamentId);
      // Clear per-user arena page caches so users don't keep stale match_ids after reset.
      await sb.from('arena_page_state').delete().eq('arena_type', type);
    } else {
      const { data: inserted, error: insertErr } = await sb
        .from('tournaments')
        .insert({
          date,
          status: 'active',
          round: 1,
          tournament_type: type,
        })
        .select('id')
        .single();
      if (insertErr || !inserted?.id) {
        return NextResponse.json({ ok: false, error: insertErr?.message || `Failed to create ${type} tournament` }, { status: 500 });
      }
      tournamentId = String(inserted.id);
    }
    createdByType[type] = tournamentId;
  }

  const seeded = await runAdminArenaSeed({
    tournamentType: seed,
    seedCount,
    prioritizeNew: seedNewest,
    tournamentIds: createdByType,
  });

  return NextResponse.json({
    ok: true,
    oldTournamentId,
    oldTournamentIds,
    newTournamentId: createdByType.main || createdByType.rookie || '',
    newTournamentIds: createdByType,
    seeded: {
      main: Number(seeded.mainInserted || 0),
      rookie: Number(seeded.rookieInserted || 0),
    },
  });
}
