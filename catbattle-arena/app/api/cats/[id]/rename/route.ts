import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../../_lib/guest';
import { validateCatName } from '../../../_lib/name-filter';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getGuestId();
    if (!userId) return NextResponse.json({ ok: false, error: 'No session' }, { status: 401 });

    const { id } = await context.params;
    if (!id) return NextResponse.json({ ok: false, error: 'Missing cat id' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const validated = validateCatName(String(body?.name || ''));
    if (!validated.ok) {
      return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: cat } = await supabase.from('cats').select('id, user_id').eq('id', id).maybeSingle();
    if (!cat) return NextResponse.json({ ok: false, error: 'Cat not found' }, { status: 404 });
    if (cat.user_id !== userId) return NextResponse.json({ ok: false, error: 'Not your cat' }, { status: 403 });

    const { data, error } = await supabase
      .from('cats')
      .update({ name: validated.value })
      .eq('id', id)
      .select('id, name')
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ ok: false, error: error?.message || 'Rename failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, cat_id: data.id, name: data.name });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
