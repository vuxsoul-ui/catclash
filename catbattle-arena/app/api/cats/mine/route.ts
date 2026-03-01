import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../_lib/guest';
import { resolveCatImageUrl } from '../../_lib/images';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const sb = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET() {
  try {
    const userId = await getGuestId();
    if (!userId) return NextResponse.json({ ok: false, error: 'No session' }, { status: 401 });

    const rich = await sb
      .from('cats')
      .select('id, name, image_path, image_review_status, rarity, status, cat_level, cat_xp, level, xp, origin')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    let rows = rich.data as Array<Record<string, unknown>> | null;
    if (rich.error) {
      const legacy = await sb
        .from('cats')
        .select('id, name, image_path, rarity, status, level, xp')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (legacy.error) return NextResponse.json({ ok: false, error: legacy.error.message }, { status: 500 });
      rows = legacy.data as Array<Record<string, unknown>> | null;
    }

    const cats = await Promise.all((rows || []).map(async (r) => ({
      id: String(r.id || ''),
      name: String(r.name || 'Unnamed'),
      rarity: String(r.rarity || 'Common'),
      status: String(r.status || 'pending'),
      origin: String(r.origin || 'submitted'),
      cat_level: Math.max(1, Number(r.cat_level || r.level || 1)),
      cat_xp: Math.max(0, Number(r.cat_xp || r.xp || 0)),
      image_url: await resolveCatImageUrl(sb, (r.image_path as string | null) || null, (r.image_review_status as string | null) || null),
    })));

    return NextResponse.json({ ok: true, cats });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
