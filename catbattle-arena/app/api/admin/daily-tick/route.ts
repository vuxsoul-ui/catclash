import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '../_lib/auth';
import { runTournamentTick } from '../../_lib/tournament-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runTournamentTick({ includeOldActive: true });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: 'Daily tick completed', result });
}
