import { NextRequest, NextResponse } from 'next/server';
import { runTournamentTick } from '../../_lib/tournament-engine';
import { requireAdmin } from '../../_lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const adminCheck = requireAdmin(request);
  if (adminCheck instanceof NextResponse) {
    return adminCheck;
  }

  const result = await runTournamentTick({ includeOldActive: true, resolveRounds: true });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: 'Tournament round resolution complete',
    result,
  });
}
