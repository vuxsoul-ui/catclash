import { NextResponse } from 'next/server';
import { resolveCatImageUrl } from '../_lib/images';
import { FEATURES } from '../_lib/flags';
import { createServerSupabaseClient, logInvalidSupabaseKey } from '../_lib/server-supabase';

export const dynamic = 'force-dynamic';

const supabase = createServerSupabaseClient();

type SchemaishError = { message?: string; code?: string; details?: string; hint?: string } | null | undefined;

function isSchemaMismatch(error: unknown): boolean {
  const msg = String((error as any)?.message || error || "").toLowerCase();

  return (
    msg.includes("does not exist") ||
    msg.includes("relation") ||
    msg.includes("column") ||
    msg.includes("function") ||
    msg.includes("rpc") ||
    msg.includes("schema") ||
    msg.includes("not found") ||
    msg.includes("undefined table") ||
    msg.includes("could not find") ||
    msg.includes("postgres")
  );
}

function isFailSoftBackendError(error: unknown): boolean {
  const msg = String((error as any)?.message || error || '').toLowerCase();
  return isSchemaMismatch(error) || msg.includes('invalid api key');
}

function buildSpotlightsFallback() {
  return { ok: true, hall_of_fame: null, cat_of_week: null };
}

function assertNoSupabaseError(error: SchemaishError): asserts error is null | undefined {
  if (error) throw error;
}

export async function GET() {
  try {
    const { data: rows, error } = await supabase
      .from('site_spotlights')
      .select('slot, cat_id, note, updated_at, tagline, theme, expires_at')
      .in('slot', ['hall_of_fame', 'cat_of_week']);

    assertNoSupabaseError(error);

    const catIds = Array.from(new Set((rows || []).map((r) => r.cat_id).filter(Boolean)));
    if (catIds.length === 0) {
      return NextResponse.json({ ok: true, hall_of_fame: null, cat_of_week: null });
    }

    const { data: cats, error: catsError } = await supabase
      .from('cats')
      .select('id, user_id, name, rarity, image_path, image_review_status')
      .in('id', catIds);
    assertNoSupabaseError(catsError);

    const userIds = Array.from(new Set((cats || []).map((c) => c.user_id).filter(Boolean)));
    const profilesRes = userIds.length
      ? await supabase.from('profiles').select('id, username').in('id', userIds)
      : { data: [] as Array<{ id: string; username: string | null }>, error: null as SchemaishError };
    assertNoSupabaseError(profilesRes.error);
    const profiles = profilesRes.data;

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
    logInvalidSupabaseKey(e);
    console.error('[api/spotlights] GET failed', e);
    try {
      console.error('[api/spotlights] GET failed JSON', JSON.stringify(e, null, 2));
    } catch {}
    if (isFailSoftBackendError(e)) {
      return NextResponse.json(buildSpotlightsFallback(), { status: 200 });
    }
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}
