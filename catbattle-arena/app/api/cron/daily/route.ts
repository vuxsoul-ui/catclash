import { NextRequest, NextResponse } from 'next/server';
import { runTournamentTick } from '../../_lib/tournament-engine';
import { requireAdmin } from '../../_lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const adminCheck = requireAdmin(request);
  if (adminCheck instanceof NextResponse) {
    return adminCheck;
  }

  try {
    const result = await runTournamentTick({ includeOldActive: true });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error('[CRON] Exception:', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
