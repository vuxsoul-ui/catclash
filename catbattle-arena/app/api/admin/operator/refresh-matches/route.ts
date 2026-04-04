import { NextRequest, NextResponse } from 'next/server';
import { runTournamentTick } from '../../../_lib/tournament-engine';
import { getAdminOperatorIdentity } from '../../../_lib/adminOperator';
import { clampSeedCount, runAdminArenaSeed, TournamentTypeInput } from '../../_lib/arenaSeed';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function POST(request: NextRequest) {
  const identity = await getAdminOperatorIdentity();
  if (!identity.isAdmin) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const resolveRounds = body?.resolveRounds === true;
  const tournamentType = String(body?.tournamentType || 'both') as TournamentTypeInput;
  const seedCount = clampSeedCount(body?.seedCount);
  const prioritizeNew = body?.prioritizeNew !== false;
  const tick = await runTournamentTick({ includeOldActive: true, resolveRounds });
  if (!tick.ok) {
    return NextResponse.json({ ok: false, error: tick.error || 'Refresh failed' }, { status: 500 });
  }
  if (!['rookie', 'main', 'both'].includes(tournamentType)) {
    return NextResponse.json({ ok: false, error: 'Invalid tournamentType' }, { status: 400 });
  }
  const seeded = await runAdminArenaSeed({
    tournamentType,
    seedCount,
    prioritizeNew,
  });

  const actions = Array.isArray(tick.actions) ? tick.actions : [];
  const tickSeededCount = actions
    .filter((a: any) => a?.topup_votable)
    .reduce((sum: number, a: any) => sum + Number(a?.topup_votable?.inserted || 0), 0);
  const seededCount = Number(tickSeededCount || 0) + Number(seeded?.insertedMatches || 0);

  return NextResponse.json({
    ok: true,
    seededCount,
    tickSeededCount,
    operatorSeededCount: Number(seeded?.insertedMatches || 0),
    operatorSeeded: seeded,
    actionCount: actions.length,
  });
}
