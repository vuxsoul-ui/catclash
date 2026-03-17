import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function parseBearer(value: string | null): string {
  const raw = String(value || '').trim();
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

function safeEq(a: string, b: string): boolean {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  try {
    const expected = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    const supplied = parseBearer(request.headers.get('authorization'));

    if (!expected || !supplied || !safeEq(expected, supplied)) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const dryRun = Boolean(body?.dry_run);
    const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\s/g, '').trim().replace(/\/+$/, '');
    if (!supabaseUrl) {
      return NextResponse.json({ ok: false, error: 'Missing NEXT_PUBLIC_SUPABASE_URL' }, { status: 500 });
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/resolve-pulse`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${expected}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dry_run: dryRun,
        resolved_by: 'admin',
      }),
      cache: 'no-store',
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: data?.error || 'Pulse resolution failed', dry_run: dryRun },
        { status: response.status }
      );
    }

    return NextResponse.json({
      ok: true,
      pulse_id: data?.pulse_id || null,
      matchups_resolved: Number(data?.matchups_resolved || 0),
      dry_run: dryRun,
      results: Array.isArray(data?.results) ? data.results : [],
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Pulse resolution failed' },
      { status: 500 }
    );
  }
}
