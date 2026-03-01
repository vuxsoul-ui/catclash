import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '../_lib/auth';
import { FEATURES } from '../../_lib/flags';
import { getGuestId } from '../../_lib/guest';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    if (!isAdmin(request)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const slot = String(body?.slot || '').trim();
    const catId = String(body?.cat_id || '').trim();
    const note = String(body?.note || '').trim() || null;
    const tagline = FEATURES.SPOTLIGHTS_V2 ? (String(body?.tagline || '').trim() || null) : null;
    const theme = FEATURES.SPOTLIGHTS_V2 ? (String(body?.theme || '').trim() || null) : null;
    const expiresAtRaw = FEATURES.SPOTLIGHTS_V2 ? String(body?.expires_at || '').trim() : '';
    let expiresAt: string | null = null;
    if (expiresAtRaw) {
      const parsed = new Date(expiresAtRaw);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ ok: false, error: 'Invalid expires_at date' }, { status: 400 });
      }
      expiresAt = parsed.toISOString();
    }

    if (!['hall_of_fame', 'cat_of_week'].includes(slot)) {
      return NextResponse.json({ ok: false, error: 'Invalid slot' }, { status: 400 });
    }
    if (!catId) return NextResponse.json({ ok: false, error: 'Missing cat_id' }, { status: 400 });

    const { data: cat } = await supabase.from('cats').select('id').eq('id', catId).maybeSingle();
    if (!cat) return NextResponse.json({ ok: false, error: 'Cat not found' }, { status: 404 });

    const updatedBy = await getGuestId().catch(() => null);
    const { error } = await supabase.from('site_spotlights').upsert({
      slot,
      cat_id: catId,
      note,
      tagline,
      theme,
      expires_at: expiresAt,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'slot' });

    if (error) {
      const msg = String(error.message || '').toLowerCase();
      if (msg.includes('site_spotlights')) {
        return NextResponse.json({ ok: false, error: 'Run spotlight migrations (021 + 022) first.' }, { status: 500 });
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, slot, cat_id: catId });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
