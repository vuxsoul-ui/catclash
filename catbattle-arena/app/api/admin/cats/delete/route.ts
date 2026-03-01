import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '../../_lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim();

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const catId = body.catId as string | undefined;
  if (!catId) {
    return NextResponse.json({ ok: false, error: 'Missing catId' }, { status: 400 });
  }

  const supabase = createClient(
    supabaseUrl,
    supabaseServiceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: before, error: beforeErr } = await supabase
    .from('cats')
    .select('id, image_path')
    .eq('id', catId)
    .maybeSingle();

  if (beforeErr) {
    return NextResponse.json({ ok: false, error: beforeErr.message }, { status: 500 });
  }
  if (!before) {
    return NextResponse.json({ ok: true, message: 'Already deleted', catId });
  }

  const { error: deleteErr } = await supabase
    .from('cats')
    .delete()
    .eq('id', catId);
  
  if (!deleteErr) {
    // no-op to keep flow readable
  }

  if (deleteErr) {
    const msg = String(deleteErr.message || '');
    if (msg.toLowerCase().includes('tournaments_champion_id_fkey')) {
      const { error: clearChampionErr } = await supabase
        .from('tournaments')
        .update({ champion_id: null })
        .eq('champion_id', catId);
      if (clearChampionErr) {
        return NextResponse.json({ ok: false, error: 'Delete failed: ' + clearChampionErr.message }, { status: 500 });
      }
      const { error: retryDeleteErr } = await supabase
        .from('cats')
        .delete()
        .eq('id', catId);
      if (retryDeleteErr) {
        return NextResponse.json({ ok: false, error: 'Delete failed: ' + retryDeleteErr.message }, { status: 500 });
      }
    } else {
      return NextResponse.json({ ok: false, error: 'Delete failed: ' + deleteErr.message }, { status: 500 });
    }
  }

  const { data: after, error: afterErr } = await supabase
    .from('cats')
    .select('id')
    .eq('id', catId)
    .maybeSingle();

  if (afterErr) {
    return NextResponse.json({ ok: false, error: 'Verification failed: ' + afterErr.message }, { status: 500 });
  }
  if (after) {
    return NextResponse.json({ ok: false, error: 'Delete did not persist' }, { status: 500 });
  }

  if (before.image_path) {
    await supabase.storage.from('cat-images').remove([before.image_path]);
  }

  return NextResponse.json({ ok: true, message: 'Cat deleted', catId });
}
