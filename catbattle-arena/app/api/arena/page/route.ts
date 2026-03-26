import { NextRequest, NextResponse } from 'next/server';
import { requireGuestId } from '../../_lib/guest';
import { normalizeCatImageUrl } from '../../_lib/images';
import { checkRateLimitMany, getClientIp, hashValue } from '../../_lib/rateLimit';
import { isFeatureTesterId } from '../../_lib/tester';
import { computeVoteStats } from '../../_lib/vote-stats';
import { createServerSupabaseClient, logInvalidSupabaseKey } from '../../_lib/server-supabase';

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

type SchemaishError = { message?: string; code?: string; details?: string; hint?: string } | null | undefined;

function parseArena(value: string | null): ArenaType {
  return 'main';
}

function supabaseAdmin() {
  return createServerSupabaseClient();
}

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

function buildArenaPageFallback(arenaType: ArenaType, pageSize: number, totalSize: number, testerMode: boolean) {
  return {
    ok: true,
    arena: arenaType,
    arena_type: arenaType,
    page_index: 0,
    page_size: pageSize,
    total_size: totalSize,
    has_more: false,
    voted_count: 0,
    page_complete: false,
    matches: [],
    tester_mode: testerMode,
  };
}

function assertNoSupabaseError(error: SchemaishError): asserts error is null | undefined {
  if (error) throw error;
}

function pairKey(catAId: string, catBId: string): string {
  const a = String(catAId || '');
  const b = String(catBId || '');
  return a <= b ? `${a}::${b}` : `${b}::${a}`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const fallbackArenaType = parseArena(url.searchParams.get('arena'));
  const fallbackPageSize = Math.max(1, Math.min(12, Number(url.searchParams.get('page_size') || 6)));
  const fallbackTotalSize = Math.max(fallbackPageSize, Math.min(120, Number(url.searchParams.get('total_size') || 36)));
  try {
    let identityKey = '';
    try {
      identityKey = await requireGuestId();
    } catch {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    const testerMode = isFeatureTesterId(identityKey);

    const arenaType = fallbackArenaType;
    const pageSize = fallbackPageSize;
    const totalSize = fallbackTotalSize;

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
    assertNoSupabaseError(pageErr);

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
    assertNoSupabaseError(matchErr);

    const typedMatches = (matchRows || []) as MatchRow[];
    const catIds = Array.from(new Set(typedMatches.flatMap((m) => [String(m.cat_a_id || ''), String(m.cat_b_id || '')]).filter(Boolean)));

    const catsRes = catIds.length
      ? await sb
          .from('cats')
          .select('id, user_id, name, image_path, image_url_thumb, image_url_card, image_url_original, image_review_status, status, rarity, cat_level, level, ability, description, origin, wins, losses, attack, defense, speed, charisma, chaos')
          .in('id', catIds)
      : { data: [] as Array<Record<string, unknown>>, error: null as SchemaishError };
    assertNoSupabaseError(catsRes.error);

    const cats = (catsRes.data || []) as Array<Record<string, unknown>>;
    const ownerIds = Array.from(new Set(cats.map((c) => String(c.user_id || '')).filter(Boolean)));
    const { data: ownerRows, error: ownerErr } = ownerIds.length
      ? await sb.from('profiles').select('id, username, guild').in('id', ownerIds)
      : { data: [] as Array<{ id: string; username: string | null; guild: string | null }>, error: null as SchemaishError };
    assertNoSupabaseError(ownerErr);

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

    const targetCount = Math.max(1, Number(page.page_size || pageSize));
    const seenMatchIds = new Set<string>();
    const seenPairKeys = new Set<string>();
    const toArenaMatch = (row: MatchRow): Record<string, unknown> | null => {
      const matchId = String(row.id || '');
      if (!matchId || seenMatchIds.has(matchId)) return null;
      const catAId = String(row.cat_a_id || '');
      const catBId = String(row.cat_b_id || '');
      if (!catAId || !catBId || catAId === catBId) return null;
      const pk = pairKey(catAId, catBId);
      if (seenPairKeys.has(pk)) return null;
      const catA = catMap.get(catAId);
      const catB = catMap.get(catBId);
      if (!catA || !catB) return null;
      if (!testerMode && String((catA as any).owner_id || '') && String((catA as any).owner_id || '') === String((catB as any).owner_id || '')) return null;
      const votesA = Number(row.votes_a || 0);
      const votesB = Number(row.votes_b || 0);
      const stats = computeVoteStats(votesA, votesB);
      seenMatchIds.add(matchId);
      seenPairKeys.add(pk);
      return {
        match_id: matchId,
        status: testerMode ? 'active' : String(row.status || 'active'),
        votes_a: votesA,
        votes_b: votesB,
        total_votes: stats.total_votes,
        percent_a: stats.percent_a,
        percent_b: stats.percent_b,
        winner_id: testerMode ? null : (row.winner_id ? String(row.winner_id) : null),
        is_close_match: Math.abs(votesA - votesB) <= 2,
        cat_a: catA,
        cat_b: catB,
      };
    };

    const rowById = new Map(typedMatches.map((m) => [String(m.id), m]));
    const matches: Array<Record<string, unknown>> = [];
    for (const id of matchIds) {
      const row = rowById.get(id);
      if (!row) continue;
      const mapped = toArenaMatch(row);
      if (mapped) matches.push(mapped);
    }

    if (matches.length < targetCount) {
      const dayKey = new Date().toISOString().slice(0, 10);
      const { data: tournamentRows, error: tournamentErr } = await sb
        .from('tournaments')
        .select('id')
        .eq('date', dayKey)
        .eq('tournament_type', arenaType)
        .in('status', ['active', 'in_progress', 'pending']);
      assertNoSupabaseError(tournamentErr);
      const tournamentIds = Array.from(new Set((tournamentRows || []).map((t: any) => String(t.id || '')).filter(Boolean)));

      if (tournamentIds.length > 0) {
        const { data: extraRowsRaw, error: extraErr } = await sb
          .from('tournament_matches')
          .select('id, status, votes_a, votes_b, winner_id, cat_a_id, cat_b_id')
          .in('tournament_id', tournamentIds)
          .in('status', ['active', 'in_progress'])
          .order('created_at', { ascending: false })
          .limit(Math.max(targetCount * 6, 48));
        assertNoSupabaseError(extraErr);
        const extraRows = (extraRowsRaw || []) as MatchRow[];

        const missingCatIds = Array.from(
          new Set(
            extraRows
              .flatMap((m) => [String(m.cat_a_id || ''), String(m.cat_b_id || '')])
              .filter((id) => !!id && !catMap.has(id))
          )
        );
        if (missingCatIds.length > 0) {
          const { data: extraCats, error: extraCatsErr } = await sb
            .from('cats')
            .select('id, user_id, name, image_path, image_url_thumb, image_url_card, image_url_original, image_review_status, status, rarity, cat_level, level, ability, description, origin, wins, losses, attack, defense, speed, charisma, chaos')
            .in('id', missingCatIds);
          assertNoSupabaseError(extraCatsErr);

          const missingOwnerIds = Array.from(
            new Set(
              (extraCats || [])
                .map((c: any) => String(c.user_id || ''))
                .filter((id) => !!id && !ownerMap.has(id))
            )
          );
          if (missingOwnerIds.length > 0) {
            const { data: extraOwners, error: extraOwnersErr } = await sb
              .from('profiles')
              .select('id, username, guild')
              .in('id', missingOwnerIds);
            assertNoSupabaseError(extraOwnersErr);
            for (const row of extraOwners || []) {
              ownerMap.set(String(row.id), {
                username: String(row.username || '').trim() || null,
                guild: row.guild === 'sun' || row.guild === 'moon' ? row.guild : null,
              });
            }
          }

          for (const cat of (extraCats || []) as Array<Record<string, unknown>>) {
            const id = String(cat.id || '').trim();
            if (!id || catMap.has(id)) continue;
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
        }

        for (const row of extraRows) {
          if (matches.length >= targetCount) break;
          const mapped = toArenaMatch(row);
          if (mapped) matches.push(mapped);
        }
      }
    }

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
    logInvalidSupabaseKey(e);
    console.error('[api/arena/page] GET failed', e);
    try {
      console.error('[api/arena/page] GET failed JSON', JSON.stringify(e, null, 2));
    } catch {}
    if (isFailSoftBackendError(e)) {
      return NextResponse.json(buildArenaPageFallback(fallbackArenaType, fallbackPageSize, fallbackTotalSize, false), { status: 200 });
    }
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}
