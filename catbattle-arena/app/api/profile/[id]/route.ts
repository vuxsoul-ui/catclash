import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../_lib/guest';
import { resolveCatImageUrl } from '../../_lib/images';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim();

type ProfileCatRow = {
  id: string;
  name: string;
  image_path: string | null;
  rarity: string | null;
  status: string | null;
  image_review_status?: string | null;
  wins: number | null;
  losses: number | null;
  battles_fought: number | null;
  level: number | null;
  cat_level: number | null;
  created_at: string;
  attack?: number | null;
  defense?: number | null;
  speed?: number | null;
  charisma?: number | null;
  chaos?: number | null;
  origin?: string | null;
  prestige_weight?: number | null;
};

type ShareReceiptRow = {
  public_slug: string;
  name: string | null;
  rarity: string | null;
  power_rating: number | null;
  image_card_png_url: string | null;
  minted_at: string;
};

function normalizeEquipSlot(slot: string): 'title' | 'border' | 'color' {
  const s = String(slot || '').toLowerCase();
  if (s === 'title' || s === 'cat_title' || s === 'badge') return 'title';
  if (s === 'border' || s === 'cat_border' || s === 'frame') return 'border';
  return 'color';
}

function isUuidLike(input: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input);
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { id: rawId } = await context.params;
    const viewerId = await getGuestId();
    if (!rawId) {
      return NextResponse.json({ ok: false, error: 'Missing user id' }, { status: 400 });
    }

    let userId = rawId;
    if (!isUuidLike(rawId)) {
      const { data: profileByName } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', rawId)
        .maybeSingle();
      if (!profileByName?.id) {
        return NextResponse.json({ ok: false, error: 'Profile not found' }, { status: 404 });
      }
      userId = profileByName.id;
    }
    const isOwner = !!viewerId && viewerId === userId;

    const [{ data: profile }, { data: progress }, { data: streak }, { data: votes }, { data: predictionStats }, { data: referrals }, { data: recentShareCards }] =
      await Promise.all([
        supabase.from('profiles').select('id, username, created_at, tactical_rating, signature_cat_id, guild').eq('id', userId).maybeSingle(),
        supabase.from('user_progress').select('xp, level, sigils').eq('user_id', userId).maybeSingle(),
        supabase.from('streaks').select('current_streak, last_claim_date').eq('user_id', userId).maybeSingle(),
        supabase
          .from('votes')
          .select('battle_id, voted_for, created_at')
          .eq('voter_user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('user_prediction_stats').select('current_streak, best_streak, bonus_rolls').eq('user_id', userId).maybeSingle(),
        supabase.from('social_referrals').select('recruit_user_id, claimable_sigils, total_sigils_earned, status').eq('referrer_user_id', userId),
        supabase
          .from('share_cards')
          .select('public_slug, name, rarity, power_rating, image_card_png_url, minted_at')
          .eq('owner_user_id', userId)
          .eq('is_public', true)
          .order('minted_at', { ascending: false })
          .limit(6),
      ]);

    let cats: ProfileCatRow[] = [];
    const richCats = await supabase
      .from('cats')
      .select('id, name, image_path, rarity, status, image_review_status, wins, losses, battles_fought, level, cat_level, created_at, attack, defense, speed, charisma, chaos, origin, prestige_weight')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (richCats.error) {
      const legacyCats = await supabase
        .from('cats')
        .select('id, name, image_path, rarity, status, wins, losses, battles_fought, level, cat_level, created_at, attack, defense, speed, charisma, chaos')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (legacyCats.error) {
        return NextResponse.json({ ok: false, error: legacyCats.error.message }, { status: 500 });
      }
      cats = (legacyCats.data || []) as ProfileCatRow[];
    } else {
      cats = (richCats.data || []) as ProfileCatRow[];
    }

    const catIds = (cats || []).map((c) => c.id);
    const votedCatIds = Array.from(new Set((votes || []).map((v) => v.voted_for).filter(Boolean)));
    const battleIds = Array.from(new Set((votes || []).map((v) => v.battle_id).filter(Boolean)));

    const [{ data: votedCats }, { data: matches }] = await Promise.all([
      votedCatIds.length
        ? supabase.from('cats').select('id, name').in('id', votedCatIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
      battleIds.length
        ? supabase.from('tournament_matches').select('id, cat_a_id, cat_b_id').in('id', battleIds)
        : Promise.resolve({ data: [] as Array<{ id: string; cat_a_id: string; cat_b_id: string }> }),
    ]);

    const allOpponentIds = Array.from(
      new Set(
        (matches || []).flatMap((m) => [m.cat_a_id, m.cat_b_id]).filter((id) => !!id && !catIds.includes(id))
      )
    );

    const { data: opponentCats } = allOpponentIds.length
      ? await supabase.from('cats').select('id, name').in('id', allOpponentIds)
      : { data: [] as Array<{ id: string; name: string }> };

    const votedCatMap = Object.fromEntries((votedCats || []).map((c) => [c.id, c.name]));
    const matchMap = Object.fromEntries((matches || []).map((m) => [m.id, m]));
    const catNameMap = Object.fromEntries((opponentCats || []).map((c) => [c.id, c.name]));

    const [{ data: catStances }, { data: fanVotes }, { data: cheers }, { data: rivalMatches }, { data: tacticalRows }, { data: predictionRows }, { data: signatureCat }] = await Promise.all([
      catIds.length ? supabase.from('cat_stances').select('cat_id, stance').in('cat_id', catIds) : Promise.resolve({ data: [] as Array<{ cat_id: string; stance: string }> }),
      catIds.length ? supabase.from('votes').select('voted_for').in('voted_for', catIds) : Promise.resolve({ data: [] as Array<{ voted_for: string }> }),
      catIds.length ? supabase.from('match_tactics').select('cat_id, action_type').in('cat_id', catIds).in('action_type', ['cheer', 'guard_break']) : Promise.resolve({ data: [] as Array<{ cat_id: string; action_type: string }> }),
      catIds.length ? supabase.from('tournament_matches').select('cat_a_id, cat_b_id').or(`cat_a_id.in.(${catIds.join(',')}),cat_b_id.in.(${catIds.join(',')})`).eq('status', 'complete').limit(300) : Promise.resolve({ data: [] as Array<{ cat_a_id: string; cat_b_id: string }> }),
      supabase.from('match_tactics').select('id').eq('voter_user_id', userId),
      supabase.from('match_predictions').select('won, resolved').eq('voter_user_id', userId),
      profile?.signature_cat_id ? supabase.from('cats').select('id, name, image_path').eq('id', profile.signature_cat_id).maybeSingle() : Promise.resolve({ data: null as { id: string; name: string; image_path: string | null } | null }),
    ]);

    const stanceMap = Object.fromEntries((catStances || []).map((s) => [s.cat_id, s.stance]));
    const voteFanMap: Record<string, number> = {};
    const cheerMap: Record<string, number> = {};
    for (const v of fanVotes || []) voteFanMap[v.voted_for] = (voteFanMap[v.voted_for] || 0) + 1;
    for (const c of cheers || []) cheerMap[c.cat_id] = (cheerMap[c.cat_id] || 0) + 1;

    const rivalryCounter: Record<string, number> = {};
    const oppIds = new Set<string>();
    for (const m of rivalMatches || []) {
      const aOwned = catIds.includes(m.cat_a_id);
      const bOwned = catIds.includes(m.cat_b_id);
      if (aOwned === bOwned) continue;
      const oppId = aOwned ? m.cat_b_id : m.cat_a_id;
      oppIds.add(oppId);
      rivalryCounter[oppId] = (rivalryCounter[oppId] || 0) + 1;
    }
    const { data: oppNames } = oppIds.size ? await supabase.from('cats').select('id, name').in('id', Array.from(oppIds)) : { data: [] as Array<{ id: string; name: string }> };
    const oppNameMap = Object.fromEntries((oppNames || []).map((o) => [o.id, o.name]));
    const rivalries = Object.entries(rivalryCounter)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([catId, battles]) => ({ cat_id: catId, cat_name: oppNameMap[catId] || 'Unknown', battles }));

    const resolvedPredictions = (predictionRows || []).filter((p) => p.resolved);
    const wonPredictions = resolvedPredictions.filter((p) => p.won).length;
    const tacticalActions = (tacticalRows || []).length;
    const tacticalRating = resolvedPredictions.length > 0
      ? Math.min(100, Math.round((wonPredictions / resolvedPredictions.length) * 70 + Math.min(tacticalActions, 50) * 0.6))
      : Math.min(100, Math.round(Math.min(tacticalActions, 50) * 0.8));

    const directQualified = (referrals || []).filter((r) => String((r as { status?: string | null }).status || '') === 'qualified').length;
    const activeRecruits = (referrals || []).filter((r) => !!String((r as { recruit_user_id?: string | null }).recruit_user_id || '')).length;
    const claimableRecruitSigils = (referrals || []).reduce((sum, row) => sum + Math.max(0, Number((row as { claimable_sigils?: number | null }).claimable_sigils || 0)), 0);
    const totalRecruitSigils = (referrals || []).reduce((sum, row) => sum + Math.max(0, Number((row as { total_sigils_earned?: number | null }).total_sigils_earned || 0)), 0);
    const shareReceipts = ((recentShareCards || []) as ShareReceiptRow[]).map((row) => ({
      slug: row.public_slug,
      name: String(row.name || 'Unnamed Cat'),
      rarity: String(row.rarity || 'Common'),
      power_rating: Math.max(0, Number(row.power_rating || 0)),
      image_url: String(row.image_card_png_url || `/api/cards/image/${encodeURIComponent(String(row.public_slug || ''))}`),
      minted_at: row.minted_at,
    }));

    let mostSupportedCat: { id: string; name: string; fan_count: number } | null = null;

    // Optional cosmetics data (works if tables exist, silently skips if not)
    let equipped: Array<{ slot: string; cosmetic: { id: string; slug: string; name: string; category: string; rarity: string } | null }> = [];
    const { data: equippedRows, error: equippedErr } = await supabase
      .from('equipped_cosmetics')
      .select('slot, cosmetic_id')
      .eq('user_id', userId);

    if (!equippedErr && equippedRows && equippedRows.length > 0) {
      const cosmeticIds = equippedRows.map((r) => r.cosmetic_id).filter(Boolean);
      const { data: cosmeticRows } = cosmeticIds.length
        ? await supabase.from('cosmetics').select('id, slug, name, category, rarity').in('id', cosmeticIds)
        : { data: [] as Array<{ id: string; slug: string; name: string; category: string; rarity: string }> };
      const cosmeticMap = Object.fromEntries((cosmeticRows || []).map((c) => [c.id, c]));
      equipped = equippedRows.map((r) => ({ slot: normalizeEquipSlot(r.slot), cosmetic: cosmeticMap[r.cosmetic_id] || null }));
    }

    const formattedCats = await Promise.all((cats || []).map(async (cat) => {
      const safeBattles = Math.max(0, Number(cat.battles_fought || 0));
      const safeWins = Math.max(0, Math.min(Number(cat.wins || 0), safeBattles));
      const safeLosses = Math.max(0, Math.min(Number(cat.losses || 0), Math.max(0, safeBattles - safeWins)));
      const fanCount = (voteFanMap[cat.id] || 0) + (cheerMap[cat.id] || 0);
      if (!mostSupportedCat || fanCount > mostSupportedCat.fan_count) {
        mostSupportedCat = { id: cat.id, name: cat.name, fan_count: fanCount };
      }
      return {
      id: cat.id,
      name: cat.name,
      rarity: cat.rarity || 'Common',
      status: cat.status || 'pending',
      wins: safeWins,
      losses: safeLosses,
      battles_fought: safeBattles,
      level: cat.cat_level || cat.level || 1,
      created_at: cat.created_at,
      image_url: await resolveCatImageUrl(supabase, cat.image_path, cat.image_review_status || null),
      image_review_status: cat.image_review_status || 'pending_review',
      stance: stanceMap[cat.id] || null,
      fan_count: fanCount,
      cheer_count: cheerMap[cat.id] || 0,
      stats: {
        attack: Number(cat.attack || 0),
        defense: Number(cat.defense || 0),
        speed: Number(cat.speed || 0),
        charisma: Number(cat.charisma || 0),
        chaos: Number(cat.chaos || 0),
      },
      origin: cat.origin || 'submitted',
      prestige_weight: Number(cat.prestige_weight || 1),
    };
    }));

    const voteHistory = (votes || []).map((v) => {
      const match = matchMap[v.battle_id];
      const oppId = match ? (match.cat_a_id === v.voted_for ? match.cat_b_id : match.cat_a_id) : null;
      return {
        battle_id: v.battle_id,
        voted_for_id: v.voted_for,
        voted_for_name: votedCatMap[v.voted_for] || 'Unknown',
        against_name: (oppId && catNameMap[oppId]) || null,
        created_at: v.created_at,
      };
    });

    return NextResponse.json({
      ok: true,
      is_owner: isOwner,
      profile: {
        id: userId,
        username: profile?.username || null,
        created_at: profile?.created_at || null,
        guild: profile?.guild || null,
        tactical_rating: tacticalRating || profile?.tactical_rating || 0,
      },
      progress: {
        xp: progress?.xp || 0,
        level: progress?.level || 1,
        sigils: progress?.sigils || 0,
      },
      streak: {
        current_streak: streak?.current_streak || 0,
        last_claim_date: streak?.last_claim_date || null,
      },
      prediction_stats: {
        current_streak: predictionStats?.current_streak || 0,
        best_streak: predictionStats?.best_streak || 0,
        bonus_rolls: predictionStats?.bonus_rolls || 0,
      },
      starter_cat_eligible: false,
      adopted_cat_count: 0,
      adopted_cat_limit: 0,
      submitted_cats: formattedCats,
      vote_history: voteHistory,
      equipped_cosmetics: equipped,
      recruit_stats: {
        active_recruits: activeRecruits,
        direct_qualified: directQualified,
        claimable_sigils: claimableRecruitSigils,
        total_sigils_earned: totalRecruitSigils,
      },
      recent_receipts: shareReceipts,
      rivalries,
      most_supported_cat: mostSupportedCat,
      signature_cat: signatureCat
        ? {
            id: signatureCat.id,
            name: signatureCat.name,
            image_url: await resolveCatImageUrl(supabase, signatureCat.image_path),
          }
        : null,
    }, { headers: { 'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate' } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
