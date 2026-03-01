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

function normalizeCrateType(body: Record<string, unknown>): 'daily' | 'premium' | 'epic' {
  const crateType = String(body?.crate_type || '').trim().toLowerCase();
  const mode = String(body?.mode || '').trim().toLowerCase();
  if (crateType === 'epic' || mode === 'epic') return 'epic';
  if (crateType === 'premium' || mode === 'paid') return 'premium';
  return 'daily';
}

export async function POST(req: NextRequest) {
  let identityKey = '';
  try {
    identityKey = await requireGuestId();
  } catch {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const crateType = normalizeCrateType(body);
  const idempotencyKey = String(req.headers.get('idempotency-key') || '').trim().slice(0, 128) || null;
  const sb = getServiceClient();

  const rpc = await sb.rpc('open_crate_idempotent', {
    identity_key: identityKey,
    crate_type: crateType,
    idempotency_key: idempotencyKey,
    resume_window_minutes: 12,
  });

  if (rpc.error) {
    return NextResponse.json({ ok: false, error: rpc.error.message }, { status: 500 });
  }

  const envelope = rpc.data as {
    ok?: boolean;
    just_created?: boolean;
    resume?: boolean;
    idempotency_hit?: boolean;
    opening?: {
      id: string;
      status: 'pending' | 'complete';
      idempotency_key?: string | null;
      reward_payload?: Record<string, unknown> | null;
      cat_id?: string | null;
    };
  } | null;

  const opening = envelope?.opening;
  if (!envelope?.ok || !opening?.id) {
    return NextResponse.json({ ok: false, error: 'Failed to create crate opening' }, { status: 500 });
  }

  if (opening.status === 'complete' && opening.reward_payload) {
    return NextResponse.json({
      ...(opening.reward_payload || {}),
      ok: true,
      opening,
      resumed: true,
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  }

  // If another request already owns this pending opening, avoid double-spend.
  if (envelope.resume && !envelope.just_created) {
    if (envelope.idempotency_hit) {
      return NextResponse.json(
        {
          ok: true,
          pending: true,
          resumed: true,
          opening,
        },
        { headers: { 'Cache-Control': 'no-store, max-age=0' } }
      );
    }
    return NextResponse.json(
      {
        ok: false,
        pending: true,
        opening,
        error: 'Crate opening in progress. Please retry in a moment.',
      },
      { status: 409, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }

  const claimUrl = new URL('/api/crate/claim', req.url);
  const claimRes = await fetch(claimUrl.toString(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: req.headers.get('cookie') || '',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const claimData = await claimRes.json().catch(() => ({} as Record<string, unknown>));
  if (!claimRes.ok || claimData?.ok === false || claimData?.success === false) {
    await sb
      .from('crate_openings')
      .delete()
      .eq('id', opening.id)
      .eq('identity_key', identityKey)
      .eq('status', 'pending');

    return NextResponse.json(
      { ok: false, error: String(claimData?.error || 'Crate opening failed') },
      { status: claimRes.status >= 400 ? claimRes.status : 400, headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }

  const catId = String((claimData as { cat_drop?: { id?: string } })?.cat_drop?.id || '').trim() || null;
  const { data: completed, error: completeErr } = await sb
    .from('crate_openings')
    .update({
      status: 'complete',
      cat_id: catId,
      reward_payload: claimData,
      completed_at: new Date().toISOString(),
    })
    .eq('id', opening.id)
    .eq('identity_key', identityKey)
    .select('id, identity_key, crate_type, status, cat_id, reward_payload, created_at, completed_at, dismissed_at')
    .single();

  if (completeErr || !completed) {
    return NextResponse.json({ ok: false, error: completeErr?.message || 'Failed to finalize crate opening' }, { status: 500 });
  }

  return NextResponse.json(
    {
      ...claimData,
      ok: true,
      opening: completed,
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
