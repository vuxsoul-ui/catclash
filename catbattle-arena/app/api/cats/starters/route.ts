import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
  return NextResponse.json(
    { ok: false, error: 'Starter adoption has been removed.', choices: [] },
    { status: 410, headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
