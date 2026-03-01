import { NextResponse } from 'next/server';
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

export async function GET() {
  let identityKey = '';
  try {
    identityKey = await requireGuestId();
  } catch {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const sb = getServiceClient();
  const { data, error } = await sb
    .from('crate_openings')
    .select('id, identity_key, crate_type, status, cat_id, reward_payload, created_at, completed_at, dismissed_at')
    .eq('identity_key', identityKey)
    .eq('status', 'complete')
    .is('dismissed_at', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ ok: true, opening: null }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }

  return NextResponse.json(
    {
      ok: true,
      opening: data,
      reward: data.reward_payload || null,
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
