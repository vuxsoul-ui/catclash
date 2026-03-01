import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../_lib/guest';
import { containsBlockedCatNameContent } from '../../_lib/name-filter';
import { checkRateLimitMany, getClientIp, hashValue } from '../../_lib/rateLimit';
import { requireUsername } from '../../_lib/require-username';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const COMMENT_LIMIT = 40;
const COMMENT_COOLDOWN_MS = 10_000;

function isMissingCommentsTable(errorMessage: string): boolean {
  const m = String(errorMessage || '').toLowerCase();
  return m.includes('tournament_comments') && (m.includes('does not exist') || m.includes('relation'));
}

function sanitizeComment(raw: string): string {
  return String(raw || '').replace(/\s+/g, ' ').trim();
}

function normalizeEquipSlot(slot: string): 'title' | 'border' | 'color' {
  const s = String(slot || '').toLowerCase();
  if (s === 'title' || s === 'cat_title' || s === 'badge') return 'title';
  if (s === 'border' || s === 'cat_border' || s === 'frame') return 'border';
  return 'color';
}

async function getCommenterMeta(userIds: string[]): Promise<{
  usernames: Record<string, string>;
  cosmetics: Record<string, { title: string | null; border_slug: string | null; color_slug: string | null; color_name: string | null }>;
}> {
  if (!userIds.length) return { usernames: {}, cosmetics: {} };

  const usernames: Record<string, string> = {};
  const cosmetics: Record<string, { title: string | null; border_slug: string | null; color_slug: string | null; color_name: string | null }> = {};

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', userIds);
  for (const row of profileRows || []) {
    const id = String((row as { id?: string }).id || '');
    if (!id) continue;
    usernames[id] = String((row as { username?: string | null }).username || 'Guest');
  }

  const { data: eqRows, error: eqErr } = await supabase
    .from('equipped_cosmetics')
    .select('user_id, slot, cosmetic_id')
    .in('user_id', userIds);
  if (eqErr || !(eqRows || []).length) {
    return { usernames, cosmetics };
  }

  const cosmeticIds = Array.from(new Set((eqRows || []).map((r) => String((r as { cosmetic_id?: string }).cosmetic_id || '')).filter(Boolean)));
  if (!cosmeticIds.length) {
    return { usernames, cosmetics };
  }

  const { data: cosmeticRows } = await supabase
    .from('cosmetics')
    .select('id, slug, name')
    .in('id', cosmeticIds);
  const cosmeticMap = Object.fromEntries(
    (cosmeticRows || []).map((c) => [String((c as { id?: string }).id || ''), c as { slug?: string; name?: string }])
  );

  for (const row of eqRows || []) {
    const userId = String((row as { user_id?: string }).user_id || '');
    const slot = normalizeEquipSlot(String((row as { slot?: string }).slot || ''));
    const cosmeticId = String((row as { cosmetic_id?: string }).cosmetic_id || '');
    const cosmetic = cosmeticMap[cosmeticId];
    if (!userId || !cosmetic) continue;
    if (!cosmetics[userId]) {
      cosmetics[userId] = { title: null, border_slug: null, color_slug: null, color_name: null };
    }
    if (slot === 'title') cosmetics[userId].title = String(cosmetic.name || '').trim() || null;
    if (slot === 'border') cosmetics[userId].border_slug = String(cosmetic.slug || '').trim() || null;
    if (slot === 'color') {
      cosmetics[userId].color_slug = String(cosmetic.slug || '').trim() || null;
      cosmetics[userId].color_name = String(cosmetic.name || '').trim() || null;
    }
  }

  return { usernames, cosmetics };
}

export async function GET(request: NextRequest) {
  try {
    const matchId = String(request.nextUrl.searchParams.get('match_id') || '').trim();
    if (!matchId) {
      return NextResponse.json({ ok: false, error: 'Missing match_id' }, { status: 400 });
    }

    const { data: comments, error } = await supabase
      .from('tournament_comments')
      .select('id, match_id, user_id, body, created_at')
      .eq('match_id', matchId)
      .order('created_at', { ascending: false })
      .limit(COMMENT_LIMIT);

    if (error) {
      if (isMissingCommentsTable(error.message)) {
        return NextResponse.json({ ok: true, comments: [], disabled: true });
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const userIds = Array.from(new Set((comments || []).map((c) => String((c as { user_id?: string }).user_id || '')).filter(Boolean)));
    const { usernames, cosmetics } = await getCommenterMeta(userIds);

    return NextResponse.json({
      ok: true,
      comments: (comments || []).map((c) => {
        const row = c as { id: string; match_id: string; user_id: string; body: string; created_at: string };
        return {
          id: row.id,
          match_id: row.match_id,
          user_id: row.user_id,
          username: usernames[row.user_id] || 'Guest',
          commenter_cosmetics: cosmetics[row.user_id] || { title: null, border_slug: null, color_slug: null, color_name: null },
          body: row.body,
          created_at: row.created_at,
        };
      }),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getGuestId();
    if (!userId) return NextResponse.json({ ok: false, error: 'No session' }, { status: 401 });
    const usernameCheck = await requireUsername(supabase, userId, 'post comments');
    if (!usernameCheck.ok) return usernameCheck.response;
    const ipHash = hashValue(getClientIp(request));
    const rate = checkRateLimitMany([
      { key: `rl:comment:user:${userId}`, limit: 12, windowMs: 60_000 },
      { key: `rl:comment:ip:${ipHash || 'unknown'}`, limit: 40, windowMs: 60_000 },
    ]);
    if (!rate.allowed) {
      return NextResponse.json(
        { ok: false, error: 'Rate limit exceeded. Slow down.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } }
      );
    }

    await supabase.rpc('bootstrap_user', { p_user_id: userId });

    const body = await request.json().catch(() => ({}));
    const matchId = String(body?.match_id || '').trim();
    const comment = sanitizeComment(body?.comment || '');

    if (!matchId) return NextResponse.json({ ok: false, error: 'Missing match_id' }, { status: 400 });
    if (comment.length < 1 || comment.length > 240) {
      return NextResponse.json({ ok: false, error: 'Comment must be 1-240 characters' }, { status: 400 });
    }
    if (containsBlockedCatNameContent(comment)) {
      return NextResponse.json({ ok: false, error: 'Comment rejected by content filter' }, { status: 400 });
    }

    const { data: match } = await supabase
      .from('tournament_matches')
      .select('id')
      .eq('id', matchId)
      .maybeSingle();
    if (!match) return NextResponse.json({ ok: false, error: 'Match not found' }, { status: 404 });

    const now = Date.now();
    const rateKey = `comment:${userId}:${matchId}`;
    const { data: rlRow } = await supabase
      .from('rate_limits')
      .select('window_start')
      .eq('key', rateKey)
      .maybeSingle();
    if (rlRow?.window_start) {
      const lastMs = new Date(rlRow.window_start).getTime();
      if (!Number.isNaN(lastMs) && now - lastMs < COMMENT_COOLDOWN_MS) {
        const retrySec = Math.ceil((COMMENT_COOLDOWN_MS - (now - lastMs)) / 1000);
        return NextResponse.json({ ok: false, error: `Slow down. Try again in ${retrySec}s.` }, { status: 429 });
      }
    }

    const { data: inserted, error: insErr } = await supabase
      .from('tournament_comments')
      .insert({ match_id: matchId, user_id: userId, body: comment })
      .select('id, match_id, user_id, body, created_at')
      .single();

    if (insErr) {
      if (isMissingCommentsTable(insErr.message)) {
        return NextResponse.json({ ok: false, error: 'Comments are not enabled yet on this deployment' }, { status: 503 });
      }
      return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
    }

    await supabase
      .from('rate_limits')
      .upsert({ key: rateKey, count: 1, window_start: new Date(now).toISOString() }, { onConflict: 'key' });

    const { usernames, cosmetics } = await getCommenterMeta([userId]);

    return NextResponse.json({
      ok: true,
      comment: {
        id: inserted.id,
        match_id: inserted.match_id,
        user_id: inserted.user_id,
        username: usernames[userId] || 'Guest',
        commenter_cosmetics: cosmetics[userId] || { title: null, border_slug: null, color_slug: null, color_name: null },
        body: inserted.body,
        created_at: inserted.created_at,
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
