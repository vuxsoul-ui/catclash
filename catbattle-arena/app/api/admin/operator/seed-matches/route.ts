import { NextRequest, NextResponse } from 'next/server';
import { clampSeedCount, runAdminArenaSeed, TournamentTypeInput } from '../../_lib/arenaSeed';
import { getAdminOperatorIdentity } from '../../../_lib/adminOperator';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function POST(request: NextRequest) {
  const identity = await getAdminOperatorIdentity();
  if (!identity.isAdmin) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const tournamentType = String(body?.tournamentType || 'both') as TournamentTypeInput;
  const seedCount = clampSeedCount(body?.seedCount);
  const prioritizeNew = body?.prioritizeNew !== false;

  if (!['rookie', 'main', 'both'].includes(tournamentType)) {
    return NextResponse.json({ ok: false, error: 'Invalid tournamentType' }, { status: 400 });
  }

  const seeded = await runAdminArenaSeed({
    tournamentType,
    seedCount,
    prioritizeNew,
  });

  return NextResponse.json({ ok: true, ...seeded });
}
