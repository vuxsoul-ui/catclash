import { NextResponse } from 'next/server';
import { getGuestId } from '../../_lib/guest';
import { duelSb as sb } from '../_lib';
import { resolveCatImageUrl } from '../../_lib/images';

export const dynamic = 'force-dynamic';

type CosmeticRow = {
  user_id: string;
  slot: string;
  cat_id: string | null;
  cosmetic_id: string | null;
  cosmetic?: { slug: string | null; name: string | null; category: string | null; rarity: string | null } | null;
};

function normalizeSlot(slot: string): 'border' | 'title' | 'vote_effect' | 'badge' | null {
  const s = String(slot || '').toLowerCase();
  if (s === 'cat_border' || s === 'border' || s === 'frame') return 'border';
  if (s === 'cat_title' || s === 'title') return 'title';
  if (s === 'vote_effect' || s === 'effect') return 'vote_effect';
  if (s === 'badge' || s === 'voter_badge') return 'badge';
  return null;
}

function pickCosmetics(rows: CosmeticRow[], userId: string, catId: string | null) {
  const mine = rows.filter((r) => String(r.user_id) === String(userId));
  const catScoped = catId ? mine.filter((r) => String(r.cat_id || '') === String(catId)) : [];
  const globalScoped = mine.filter((r) => !r.cat_id);
  const merged = [...catScoped, ...globalScoped];
  const out: {
    border_slug: string | null;
    title_slug: string | null;
    title_name: string | null;
    title_rarity: string | null;
    vote_effect_slug: string | null;
    badge_slug: string | null;
    badge_name: string | null;
  } = {
    border_slug: null,
    title_slug: null,
    title_name: null,
    title_rarity: null,
    vote_effect_slug: null,
    badge_slug: null,
    badge_name: null,
  };

  for (const row of merged) {
    const slot = normalizeSlot(row.slot);
    const cosmetic = row.cosmetic;
    if (!slot || !cosmetic?.slug) continue;
    if (slot === 'border' && !out.border_slug) out.border_slug = cosmetic.slug;
    if (slot === 'title' && !out.title_slug) {
      out.title_slug = cosmetic.slug;
      out.title_name = cosmetic.name || null;
      out.title_rarity = cosmetic.rarity || null;
    }
    if (slot === 'vote_effect' && !out.vote_effect_slug) out.vote_effect_slug = cosmetic.slug;
    if (slot === 'badge' && !out.badge_slug) {
      out.badge_slug = cosmetic.slug;
      out.badge_name = cosmetic.name || null;
    }
  }
  return out;
}

function isMissingTable(message: string): boolean {
  const m = String(message || '').toLowerCase();
  return (m.includes('duel_challenges') || m.includes('duel_votes')) && (m.includes('does not exist') || m.includes('relation'));
}

export async function GET() {
  try {
    const userId = await getGuestId();
    if (!userId) return NextResponse.json({ ok: false, error: 'No session' }, { status: 401 });

    const [incomingRes, outgoingRes, openRes] = await Promise.all([
      sb.from('duel_challenges')
        .select('id, challenger_user_id, challenged_user_id, challenger_cat_id, challenged_cat_id, winner_cat_id, status, created_at, responded_at, resolved_at')
        .eq('challenged_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30),
      sb.from('duel_challenges')
        .select('id, challenger_user_id, challenged_user_id, challenger_cat_id, challenged_cat_id, winner_cat_id, status, created_at, responded_at, resolved_at')
        .eq('challenger_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30),
      sb.from('duel_challenges')
        .select('id, challenger_user_id, challenged_user_id, challenger_cat_id, challenged_cat_id, winner_cat_id, status, created_at, responded_at, resolved_at')
        .eq('status', 'voting')
        .order('responded_at', { ascending: false })
        .limit(30),
    ]);

    const err = incomingRes.error || outgoingRes.error || openRes.error;
    if (err) {
      if (isMissingTable(err.message)) {
        return NextResponse.json({ ok: true, disabled: true, incoming: [], outgoing: [], open: [] });
      }
      return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }

    const rows = [...(incomingRes.data || []), ...(outgoingRes.data || []), ...(openRes.data || [])];
    const userIds = Array.from(new Set(rows.flatMap((r) => [String(r.challenger_user_id || ''), String(r.challenged_user_id || '')]).filter(Boolean)));
    const catIds = Array.from(new Set(rows.flatMap((r) => [String(r.challenger_cat_id || ''), String(r.challenged_cat_id || ''), String(r.winner_cat_id || '')]).filter(Boolean)));
    const duelIds = Array.from(new Set(rows.map((r) => String(r.id || '')).filter(Boolean)));
    const openDuelIds = Array.from(new Set((openRes.data || []).map((r) => String(r.id || '')).filter(Boolean)));

    const [{ data: profiles }, { data: cats }, { data: votes }, { data: equippedRaw }, recentVotes2mRes] = await Promise.all([
      userIds.length ? sb.from('profiles').select('id, username, guild').in('id', userIds) : Promise.resolve({ data: [] as Array<{ id: string; username: string | null; guild: string | null }> }),
      catIds.length
        ? sb
            .from('cats')
            .select('id, name, image_path, ability, special_ability_id, rarity, cat_level, attack, defense, speed, charisma, chaos')
            .in('id', catIds)
        : Promise.resolve({
            data: [] as Array<{
              id: string;
              name: string;
              image_path: string | null;
              ability: string | null;
              special_ability_id: string | null;
              rarity: string | null;
              cat_level: number | null;
              attack: number | null;
              defense: number | null;
              speed: number | null;
              charisma: number | null;
              chaos: number | null;
            }>,
          }),
      duelIds.length ? sb.from('duel_votes').select('duel_id, voter_user_id, voted_cat_id').in('duel_id', duelIds) : Promise.resolve({ data: [] as Array<{ duel_id: string; voter_user_id: string; voted_cat_id: string }> }),
      userIds.length
        ? sb
            .from('equipped_cosmetics')
            .select('user_id, slot, cat_id, cosmetic_id')
            .in('user_id', userIds)
        : Promise.resolve({ data: [] as CosmeticRow[] }),
      openDuelIds.length
        ? sb
            .from('duel_votes')
            .select('id', { count: 'exact', head: true })
            .in('duel_id', openDuelIds)
            .gte('created_at', new Date(Date.now() - 2 * 60 * 1000).toISOString())
        : Promise.resolve({ count: 0 }),
    ]);
    const equipped = (equippedRaw || []) as CosmeticRow[];
    const cosmeticIds = Array.from(new Set(equipped.map((r) => String(r.cosmetic_id || '')).filter(Boolean)));
    const { data: cosmetics } = cosmeticIds.length
      ? await sb.from('cosmetics').select('id, slug, name, category, rarity').in('id', cosmeticIds)
      : ({ data: [] } as { data: Array<{ id: string; slug: string | null; name: string | null; category: string | null; rarity: string | null }> });
    const cosmeticMap = Object.fromEntries((cosmetics || []).map((c) => [String(c.id), c]));
    const equippedWithCosmetic: CosmeticRow[] = equipped.map((row) => ({
      ...row,
      cosmetic: row.cosmetic_id ? (cosmeticMap[String(row.cosmetic_id)] || null) : null,
    }));

    const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
    const catMap = Object.fromEntries(await Promise.all((cats || []).map(async (c) => [c.id, {
      id: c.id,
      name: c.name,
      image_url: await resolveCatImageUrl(sb, c.image_path),
      ability: c.ability || null,
      special_ability_id: c.special_ability_id || null,
      rarity: c.rarity || null,
      level: Number(c.cat_level || 1),
      stats: {
        atk: Number(c.attack || 0),
        def: Number(c.defense || 0),
        spd: Number(c.speed || 0),
        cha: Number(c.charisma || 0),
        chs: Number(c.chaos || 0),
      },
    }])));

    const voteMap = new Map<string, { cat_a: number; cat_b: number; total: number; user_vote_cat_id: string | null }>();
    for (const r of rows) {
      voteMap.set(String(r.id), { cat_a: 0, cat_b: 0, total: 0, user_vote_cat_id: null });
    }
    for (const v of votes || []) {
      const duelId = String(v.duel_id || '');
      const duel = rows.find((r) => String(r.id || '') === duelId);
      if (!duel) continue;
      const agg = voteMap.get(duelId);
      if (!agg) continue;
      if (String(v.voted_cat_id || '') === String(duel.challenger_cat_id || '')) agg.cat_a += 1;
      if (String(v.voted_cat_id || '') === String(duel.challenged_cat_id || '')) agg.cat_b += 1;
      agg.total += 1;
      if (String(v.voter_user_id || '') === userId) agg.user_vote_cat_id = String(v.voted_cat_id || '');
      voteMap.set(duelId, agg);
    }

    const format = (r: {
      id: string;
      challenger_user_id: string;
      challenged_user_id: string;
      challenger_cat_id: string;
      challenged_cat_id: string | null;
      winner_cat_id: string | null;
      status: string;
      created_at: string;
      responded_at: string | null;
      resolved_at: string | null;
    }) => ({
      ...r,
      challenger_username: String(profileMap[r.challenger_user_id]?.username || `Player ${r.challenger_user_id.slice(0, 8)}`),
      challenged_username: String(profileMap[r.challenged_user_id]?.username || `Player ${r.challenged_user_id.slice(0, 8)}`),
      challenger_guild: profileMap[r.challenger_user_id]?.guild || null,
      challenged_guild: profileMap[r.challenged_user_id]?.guild || null,
      challenger_cat: catMap[r.challenger_cat_id] || null,
      challenged_cat: r.challenged_cat_id ? (catMap[r.challenged_cat_id] || null) : null,
      winner_cat: r.winner_cat_id ? (catMap[r.winner_cat_id] || null) : null,
      challenger_cosmetics: pickCosmetics(equippedWithCosmetic as unknown as CosmeticRow[], r.challenger_user_id, r.challenger_cat_id || null),
      challenged_cosmetics: pickCosmetics(equippedWithCosmetic as unknown as CosmeticRow[], r.challenged_user_id, r.challenged_cat_id || null),
      votes: voteMap.get(String(r.id)) || { cat_a: 0, cat_b: 0, total: 0, user_vote_cat_id: null },
    });

    return NextResponse.json({
      ok: true,
      incoming: (incomingRes.data || []).map((r) => format(r as never)),
      outgoing: (outgoingRes.data || []).map((r) => format(r as never)),
      open: (openRes.data || []).map((r) => format(r as never)),
      recent_votes_2m: Number((recentVotes2mRes as { count?: number | null })?.count || 0),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
