import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../../_lib/guest';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getGuestId();
    if (!userId) return NextResponse.json({ ok: false, error: 'No session' }, { status: 401 });

    const p = await params;
    const catId = String(p.id || '').trim();
    if (!catId) return NextResponse.json({ ok: false, error: 'Missing cat id' }, { status: 400 });

    const { data: cat, error: catErr } = await supabase
      .from('cats')
      .select('id, user_id, image_path')
      .eq('id', catId)
      .maybeSingle();
    if (catErr) return NextResponse.json({ ok: false, error: catErr.message }, { status: 500 });
    if (!cat) return NextResponse.json({ ok: false, error: 'Cat not found' }, { status: 404 });
    if (String(cat.user_id || '') !== userId) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const { error: delErr } = await supabase.from('cats').delete().eq('id', catId);
    if (delErr) {
      const msg = String(delErr.message || '').toLowerCase();
      if (msg.includes('tournaments_champion_id_fkey')) {
        const { error: clearErr } = await supabase.from('tournaments').update({ champion_id: null }).eq('champion_id', catId);
        if (clearErr) return NextResponse.json({ ok: false, error: clearErr.message }, { status: 500 });
        const { error: retryErr } = await supabase.from('cats').delete().eq('id', catId);
        if (retryErr) return NextResponse.json({ ok: false, error: retryErr.message }, { status: 500 });
      } else {
        return NextResponse.json({ ok: false, error: delErr.message }, { status: 500 });
      }
    }

    if (cat.image_path) {
      await supabase.storage.from('cat-images').remove([String(cat.image_path)]);
    }

    return NextResponse.json({ ok: true, cat_id: catId });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

