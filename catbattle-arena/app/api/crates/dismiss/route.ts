import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireGuestId } from '../../_lib/guest';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getServiceClient() {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: NextRequest) {
  let identityKey = '';
  try {
    identityKey = await requireGuestId();
  } catch {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as { openingId?: string }));
  const openingId = String(body?.openingId || '').trim();
  if (!openingId) {
    return NextResponse.json({ ok: false, error: 'Missing openingId' }, { status: 400 });
  }

  const sb = getServiceClient();
  const { error } = await sb
    .from('crate_openings')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', openingId)
    .eq('identity_key', identityKey)
    .is('dismissed_at', null);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
