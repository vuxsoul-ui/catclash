import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

function parseArena(value: string | null): 'main' | 'rookie' {
  return value === 'rookie' ? 'rookie' : 'main';
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  if (url.searchParams.get('debug') !== '1') {
    return NextResponse.json({ ok: false, error: 'debug_only' }, { status: 403, headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }

  const arena = parseArena(url.searchParams.get('arena'));
  // Use the "arena pages" generator for debug refresh so we always get vote-renderable matches
  // (the queue/page endpoint can return completed matches when you're already voted through).
  const target = new URL('/api/arena/pages', url);
  target.searchParams.set('arena', arena);
  target.searchParams.set('tab', 'voting');
  target.searchParams.set('page', '0');
  target.searchParams.set('debug', '1');

  const headers = new Headers();
  const cookie = request.headers.get('cookie');
  const ua = request.headers.get('user-agent');
  const xff = request.headers.get('x-forwarded-for');
  const xri = request.headers.get('x-real-ip');
  if (cookie) headers.set('cookie', cookie);
  if (ua) headers.set('user-agent', ua);
  if (xff) headers.set('x-forwarded-for', xff);
  if (xri) headers.set('x-real-ip', xri);

  const res = await fetch(target, { cache: 'no-store', headers });
  const upstream = await res.json().catch(() => null) as any;
  const matches = Array.isArray(upstream?.matches) ? upstream.matches : [];

  // Normalize response shape to what the debug UI expects.
  return NextResponse.json({
    ok: !!upstream?.ok,
    arena_type: upstream?.arena || arena,
    page_index: Number(upstream?.pageIndex || 0),
    page_size: matches.length,
    total_size: Number(upstream?.totalMatches || matches.length || 0),
    voted_count: 0,
    page_complete: false,
    matches,
  }, {
    status: res.ok ? 200 : res.status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
