import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '../../_lib/auth';
import { reseedNpcRoster } from '../../../_lib/tournament-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const count = Math.max(8, Math.min(48, Number(body?.count || 24)));
    const result = await reseedNpcRoster(count);
    return NextResponse.json({
      ...result,
      message: `NPC roster reseeded. Active NPCs: ${result.active_count}`,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
