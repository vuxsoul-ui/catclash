import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireGuestId } from '../../_lib/guest';
import { normalizeCatImageUrl } from '../../_lib/images';
import { checkRateLimitMany, getClientIp, hashValue } from '../../_lib/rateLimit';
import { isFeatureTesterId } from '../../_lib/tester';

export const dynamic = 'force-dynamic';

type ArenaType = 'main' | 'rookie';

type MatchRow = {
  id: string;
  status: string;
  votes_a: number;
  votes_b: number;
  winner_id: string | null;
  cat_a_id: string;
  cat_b_id: string;
};

function parseArena(value: string | null): ArenaType {
  return 'main';
}

function supabaseAdmin() {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET(request: NextRequest) {
  try {
    let identityKey = '';
    try {
      identityKey = await requireGuestId();
    } catch {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    const testerMode = isFeatureTesterId(identityKey);

    const url = new URL(request.url);
    const arenaType = parseArena(url.searchParams.get('arena'));
    const pageSize = Math.max(1, Math.min(12, Number(url.searchParams.get('page_size') || 6)));
    const totalSize = Math.max(pageSize, Math.min(120, Number(url.searchParams.get('total_size') || 36)));

    const ipHash = hashValue(getClientIp(request));
    const rl = checkRateLimitMany([
      { key: `rl:arena-page:ip:${ipHash || 'unknown'}`, limit: 120, windowMs: 60_000 },
      { key: `rl:arena-page:user:${identityKey}:${arenaType}`, limit: 80, windowMs: 60_000 },
    ]);
    if (!rl.allowed) {
      return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } });
    }

    const sb = supabaseAdmin();
    const { data: pageData, error: pageErr } = await sb.rpc('get_or_create_arena_page', {
      p_identity_key: identityKey,
      p_arena_type: arenaType,
      p_page_size: pageSize,
      p_total_size: totalSize,
    });
    if (pageErr) {
      return NextResponse.json({ ok: false, error: pageErr.message }, { status: 500 });
    }

    const page = (pageData || {}) as Record<string, unknown>;
    if (!page.ok) {
      return NextResponse.json({ ok: false, error: String(page.error || 'Failed to load page') }, { status: 400 });
    }

    const matchIds = Array.isArray(page.match_ids) ? page.match_ids.map((id) => String(id)).filter(Boolean) : [];
    if (matchIds.length === 0) {
      return NextResponse.json({
        ok: true,
        arena_type: arenaType,
        page_index: Number(page.page_index || 0),
        page_size: 0,
        total_size: Number(page.total_size || totalSize),
        voted_count: testerMode ? 0 : Number(page.voted_count || 0),
        page_complete: testerMode ? false : !!page.page_complete,
        matches: [],
      }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
    }

    const { data: matchRows, error: matchErr } = await sb
      .from('tournament_matches')
      .select('id, status, votes_a, votes_b, winner_id, cat_a_id, cat_b_id')
      .in('id', matchIds);
    if (matchErr) {
      return NextResponse.json({ ok: false, error: matchErr.message }, { status: 500 });
    }

    const typedMatches = (matchRows || []) as MatchRow[];
    const catIds = Array.from(new Set(typedMatches.flatMap((m) => [String(m.cat_a_id || ''), String(m.cat_b_id || '')]).filter(Boolean)));

    const { data: catsData } = catIds.length
      ? await sb
          .from('cats')
          .select('id, user_id, name, image_path, image_url_thumb, image_url_card, image_url_original, image_review_status, status, rarity, cat_level, level, ability, description, origin, wins, losses, attack, defense, speed, charisma, chaos')
          .in('id', catIds)
      : { data: [] as Array<Record<string, unknown>> };

    const cats = (catsData || []) as Array<Record<string, unknown>>;
    const ownerIds = Array.from(new Set(cats.map((c) => String(c.user_id || '')).filter(Boolean)));
    const { data: ownerRows } = ownerIds.length
      ? await sb.from('profiles').select('id, username, guild').in('id', ownerIds)
      : { data: [] as Array<{ id: string; username: string | null; guild: string | null }> };

    const ownerMap = new Map<string, { username: string | null; guild: 'sun' | 'moon' | null }>();
    for (const row of ownerRows || []) {
      ownerMap.set(String(row.id), {
        username: String(row.username || '').trim() || null,
        guild: row.guild === 'sun' || row.guild === 'moon' ? row.guild : null,
      });
    }

    const catMap = new Map<string, Record<string, unknown>>();
    for (const cat of cats) {
      const id = String(cat.id || '').trim();
      if (!id) continue;
      const ownerId = String(cat.user_id || '').trim() || null;
      const source = String(cat.image_url_thumb || cat.image_url_card || cat.image_url_original || cat.image_path || '').trim();
      const normalizedName = String(cat.name || '').trim() || 'Unknown';
      catMap.set(id, {
        id,
        name: normalizedName,
        image_url: normalizeCatImageUrl({ id, image_url: source }),
        rarity: String(cat.rarity || 'Common'),
        level: Math.max(1, Number(cat.cat_level || cat.level || 1)),
        ability: cat.ability ? String(cat.ability) : null,
        description: cat.description ? String(cat.description) : null,
        origin: cat.origin ? String(cat.origin) : null,
        wins: Number(cat.wins || 0),
        losses: Number(cat.losses || 0),
        owner_id: ownerId,
        owner_username: ownerId ? (ownerMap.get(ownerId)?.username || null) : null,
        owner_guild: ownerId ? (ownerMap.get(ownerId)?.guild || null) : null,
        stats: {
          attack: Number(cat.attack || 0),
          defense: Number(cat.defense || 0),
          speed: Number(cat.speed || 0),
          charisma: Number(cat.charisma || 0),
          chaos: Number(cat.chaos || 0),
        },
      });
    }

    const rowById = new Map(typedMatches.map((m) => [String(m.id), m]));
    const matches = matchIds
      .map((id) => {
        const row = rowById.get(id);
        if (!row) return null;
        const catA = catMap.get(String(row.cat_a_id || ''));
        const catB = catMap.get(String(row.cat_b_id || ''));
        if (!catA || !catB) return null;
        if (!testerMode && String((catA as any).owner_id || '') && String((catA as any).owner_id || '') === String((catB as any).owner_id || '')) return null;
        return {
          match_id: id,
          status: testerMode ? 'active' : String(row.status || 'active'),
          votes_a: Number(row.votes_a || 0),
          votes_b: Number(row.votes_b || 0),
          winner_id: testerMode ? null : (row.winner_id ? String(row.winner_id) : null),
          is_close_match: Math.abs(Number(row.votes_a || 0) - Number(row.votes_b || 0)) <= 2,
          cat_a: catA,
          cat_b: catB,
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      ok: true,
      arena_type: arenaType,
      page_index: Number(page.page_index || 0),
      page_size: Number(page.page_size || pageSize),
      total_size: Number(page.total_size || totalSize),
      voted_count: testerMode ? 0 : Number(page.voted_count || 0),
      page_complete: testerMode ? false : !!page.page_complete,
      matches,
      tester_mode: testerMode,
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
