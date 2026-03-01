import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../../_lib/guest';
import { isRelationMissingError } from '../../../_lib/tactical';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const VALID_STANCES = new Set(['aggro', 'guard', 'chaos']);

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const guestId = await getGuestId();
    if (!guestId) return NextResponse.json({ ok: false, error: 'No session' }, { status: 401 });

    const { id: catId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const stance = String(body.stance || '').toLowerCase();

    if (!VALID_STANCES.has(stance)) {
      return NextResponse.json({ ok: false, error: 'Invalid stance' }, { status: 400 });
    }

    const { data: cat, error: catErr } = await supabase.from('cats').select('id, user_id').eq('id', catId).maybeSingle();
    if (catErr || !cat) return NextResponse.json({ ok: false, error: 'Cat not found' }, { status: 404 });
    if (cat.user_id !== guestId) return NextResponse.json({ ok: false, error: 'You do not own this cat' }, { status: 403 });

    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await supabase.from('cat_stances').select('updated_day').eq('cat_id', catId).maybeSingle();
    if (existing?.updated_day === today) {
      const next = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      return NextResponse.json({ ok: false, error: 'Stance can only be changed once per UTC day', next_change_at: next }, { status: 400 });
    }

    const { error: upErr } = await supabase.from('cat_stances').upsert({ cat_id: catId, stance, updated_day: today, updated_at: new Date().toISOString() }, { onConflict: 'cat_id' });
    if (upErr) {
      if (isRelationMissingError(upErr)) {
        return NextResponse.json({ ok: false, error: 'Stance table missing. Run latest migrations.' }, { status: 500 });
      }
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, cat_id: catId, stance, next_change_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
