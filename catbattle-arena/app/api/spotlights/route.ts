import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveCatImageUrl } from '../_lib/images';
import { FEATURES } from '../_lib/flags';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET() {
  try {
    const { data: rows, error } = await supabase
      .from('site_spotlights')
      .select('slot, cat_id, note, updated_at, tagline, theme, expires_at')
      .in('slot', ['hall_of_fame', 'cat_of_week']);

    if (error) {
      const msg = String(error.message || '').toLowerCase();
      if (msg.includes('site_spotlights')) {
        return NextResponse.json({ ok: true, hall_of_fame: null, cat_of_week: null });
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const catIds = Array.from(new Set((rows || []).map((r) => r.cat_id).filter(Boolean)));
    if (catIds.length === 0) {
      return NextResponse.json({ ok: true, hall_of_fame: null, cat_of_week: null });
    }

    const { data: cats } = await supabase
      .from('cats')
      .select('id, user_id, name, rarity, image_path, image_review_status')
      .in('id', catIds);

    const userIds = Array.from(new Set((cats || []).map((c) => c.user_id).filter(Boolean)));
    const { data: profiles } = userIds.length
      ? await supabase.from('profiles').select('id, username').in('id', userIds)
      : { data: [] as Array<{ id: string; username: string | null }> };

    const profileMap: Record<string, string> = {};
    for (const p of profiles || []) profileMap[p.id] = String(p.username || '').trim();

    const catMap: Record<string, any> = {};
    for (const c of cats || []) {
      catMap[c.id] = {
        id: c.id,
        name: c.name,
        rarity: c.rarity || 'Common',
        owner_username: c.user_id ? (profileMap[c.user_id] || null) : null,
        image_url: await resolveCatImageUrl(supabase, c.image_path, c.image_review_status || null),
      };
    }

    const pick = (slot: string) => {
      const row = (rows || []).find((r) => r.slot === slot);
      if (!row) return null;
      return {
        slot,
        note: row.note || null,
        tagline: FEATURES.SPOTLIGHTS_V2 ? (row.tagline || null) : null,
        theme: FEATURES.SPOTLIGHTS_V2 ? (row.theme || null) : null,
        expires_at: FEATURES.SPOTLIGHTS_V2 ? (row.expires_at || null) : null,
        expires_in_hours: FEATURES.SPOTLIGHTS_V2 && row.expires_at
          ? Math.max(0, Math.floor((new Date(String(row.expires_at)).getTime() - Date.now()) / 3600000))
          : null,
        updated_at: row.updated_at,
        cat: catMap[row.cat_id] || null,
      };
    };

    return NextResponse.json({
      ok: true,
      // Temporarily disabled per launch request; keep DB record intact for easy re-enable.
      hall_of_fame: null,
      cat_of_week: pick('cat_of_week'),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
