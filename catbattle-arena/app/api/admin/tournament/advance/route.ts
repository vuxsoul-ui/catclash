import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '../../_lib/auth';
import { runTournamentTick } from '../../../_lib/tournament-engine';

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

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const resolveRounds = body?.resolveRounds === true;
  const tick = await runTournamentTick({ includeOldActive: true, resolveRounds });
  if (!tick.ok) {
    return NextResponse.json({ ok: false, error: tick.error || 'Advance failed' }, { status: 500 });
  }

  const actions = Array.isArray(tick.actions) ? tick.actions : [];
  const createdTournament = actions.some((a: any) => Boolean(a?.create?.created));
  const seededMain = actions
    .filter((a: any) => a?.type === 'main' && a?.topup_votable)
    .reduce((sum: number, a: any) => sum + Number(a?.topup_votable?.inserted || 0), 0);
  const seededRookie = actions
    .filter((a: any) => a?.type === 'rookie' && a?.topup_votable)
    .reduce((sum: number, a: any) => sum + Number(a?.topup_votable?.inserted || 0), 0);
  const resolveActions = actions.filter((a: any) => a?.result?.action);
  const resolvedRound = resolveActions.some((a: any) => {
    const action = String(a?.result?.action || '').toLowerCase();
    return action === 'advanced' || action === 'completed';
  });
  const advancedToRound = resolveActions
    .map((a: any) => Number(a?.result?.next_round || 0))
    .filter((n: number) => Number.isFinite(n) && n > 0)
    .sort((a: number, b: number) => b - a)[0] || null;

  const notes: string[] = [];
  if (createdTournament) notes.push('Created or recycled tournament for today');
  if (seededMain + seededRookie > 0) notes.push(`Seeded/top-upped ${seededMain + seededRookie} matches`);
  if (resolvedRound) notes.push('Resolved and advanced at least one tournament round');
  if (!resolveRounds) notes.push('Round resolution skipped (safe advance mode)');
  if (notes.length === 0) notes.push('No changes needed; tournament already healthy');

  const sb = supabaseAdmin();
  const { data: currentTournament } = await sb
    .from('tournaments')
    .select('id')
    .in('status', ['active', 'in_progress'] as any)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    tournamentId: String(currentTournament?.id || ''),
    createdTournament,
    seeded: { main: seededMain, rookie: seededRookie },
    resolvedRound,
    advancedToRound,
    notes,
  });
}
