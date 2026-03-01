import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../_lib/guest';
import { isRelationMissingError } from '../../_lib/tactical';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const guestId = await getGuestId();
    if (!guestId) return NextResponse.json({ ok: false, error: 'No session' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const catId = String(body.cat_id || '').trim();

    if (!catId) return NextResponse.json({ ok: false, error: 'Missing cat_id' }, { status: 400 });

    const { data: cat } = await supabase.from('cats').select('id, user_id').eq('id', catId).maybeSingle();
    if (!cat) return NextResponse.json({ ok: false, error: 'Cat not found' }, { status: 404 });
    if (cat.user_id !== guestId) return NextResponse.json({ ok: false, error: 'You can only pin your own cat' }, { status: 403 });

    const { error } = await supabase.from('profiles').update({ signature_cat_id: catId }).eq('id', guestId);
    if (error) {
      if (isRelationMissingError(error) || String(error.message).includes('column "signature_cat_id"')) {
        return NextResponse.json({ ok: false, error: 'signature_cat_id missing on profiles. Run latest migrations.' }, { status: 500 });
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, signature_cat_id: catId });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
