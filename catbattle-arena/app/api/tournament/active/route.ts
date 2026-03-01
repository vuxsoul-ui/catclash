import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGuestId } from "../../_lib/guest";
import { runTournamentTick } from '../../_lib/tournament-engine';
import { isThumbUrl, normalizeCatImageUrl } from '../../_lib/images';
import { predictionStreakBonusPct } from '../../_lib/tactical';
import { LAUNCH_CONFIG } from '../../_lib/launchConfig';
import { fixtureActiveArenas, isFixtureModeRequest } from "../../_lib/fixtureArena";
import { ensureActiveArenasUtc, ACTIVE_STATUS_ALIASES, CANONICAL_ACTIVE_STATUS } from "../../_lib/arena-active";
import { loadArenaPage } from "../../_lib/arena-pages";
import { pickFairMatches } from "../../_lib/pickFairMatches";
import { isAdminAuthorized } from "../../_lib/adminAuth";
import { isFeatureTesterId } from "../../_lib/tester";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const VOTABLE_MATCH_STATUSES = ["active", "in_progress"] as const;
const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" } as const;
const NPC_USER_ID = "00000000-0000-0000-0000-000000000000";

function isSameOwnerPair(aOwnerId?: string | null, bOwnerId?: string | null): boolean {
  const a = String(aOwnerId || "").trim();
  const b = String(bOwnerId || "").trim();
  return !!a && !!b && a === b;
}

export async function GET(request: NextRequest) {
  try {
    if (isFixtureModeRequest(request)) {
      return NextResponse.json(fixtureActiveArenas(), { headers: NO_STORE_HEADERS });
    }
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === '1';
    const debugArenaEnabled = process.env.DEBUG_ARENA === '1';
    const debugMode = url.searchParams.get('debug') === '1' && debugArenaEnabled && isAdminAuthorized(request);
    const guestId = await getGuestId();
    const testerMode = isFeatureTesterId(guestId);

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const now = new Date();
    const healedArenaState = await ensureActiveArenasUtc(supabase, now);
    const today = healedArenaState.computedDayKey;

    const includeCompleted = false;

    // Get tournaments for today
    const statusList = includeCompleted
      ? [...ACTIVE_STATUS_ALIASES, 'complete', 'completed']
      : [...ACTIVE_STATUS_ALIASES];

    async function loadTodayTournaments() {
      const { data, error } = await supabase
        .from('tournaments')
        .select('id, date, round, status, tournament_type, champion_id, created_at')
        .eq('date', today)
        .eq('tournament_type', 'main')
        .in('status', statusList)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []).filter((t) => t.tournament_type !== 'grind');
    }

    if (forceRefresh && LAUNCH_CONFIG.seedMatchupAutoFill) {
      // Force-advance/resolve rounds so the client can refill voting stacks
      // when all currently active matches are exhausted by the user.
      await runTournamentTick({ includeOldActive: false, resolveRounds: true });
    }

    await Promise.all([
      loadArenaPage({ arena: 'main', tab: 'voting', pageIndex: 0, dayKey: today, targetCount: 4 }),
    ]);

    let todayTournaments = await loadTodayTournaments();
    if (todayTournaments.length === 0 && LAUNCH_CONFIG.seedMatchupAutoFill) {
      await runTournamentTick({ includeOldActive: false, resolveRounds: false });
      todayTournaments = await loadTodayTournaments();
    }

    if (todayTournaments.length === 0) {
      const payload: Record<string, unknown> = { ok: true, arenas: [], voted_matches: {}, prediction_meta: null };
      if (debugMode) {
        payload.debug = {
          ...healedArenaState,
          reason: healedArenaState.reason === 'OK' ? 'NO_TOURNAMENT' : healedArenaState.reason,
        };
      }
      return NextResponse.json(payload, { headers: NO_STORE_HEADERS });
    }

    const tournamentIds = todayTournaments.map((t) => t.id);

    const { data: activeMatchProbe } = await supabase
      .from('tournament_matches')
      .select('id')
      .in('tournament_id', tournamentIds)
      .in('status', [...VOTABLE_MATCH_STATUSES] as any)
      .limit(1);

    if ((!activeMatchProbe || activeMatchProbe.length === 0) && LAUNCH_CONFIG.seedMatchupAutoFill) {
      await runTournamentTick({ includeOldActive: false, resolveRounds: true });
      await Promise.all([
        loadArenaPage({ arena: 'main', tab: 'voting', pageIndex: 0, dayKey: today, targetCount: 4 }),
      ]);
      todayTournaments = await loadTodayTournaments();
      if (todayTournaments.length === 0) {
        const payload: Record<string, unknown> = { ok: true, arenas: [], voted_matches: {}, prediction_meta: null };
        if (debugMode) {
          payload.debug = {
            ...healedArenaState,
            reason: 'NO_ACTIVE_ROUND',
          };
        }
        return NextResponse.json(payload, { headers: NO_STORE_HEADERS });
      }
    }

    const refreshedTournamentIds = todayTournaments.map((t) => t.id);

    const { data: entries } = await supabase
      .from("tournament_entries")
      .select("tournament_id, cat_id")
      .in("tournament_id", refreshedTournamentIds);
    const entryCatsByTournament: Record<string, Set<string>> = {};
    for (const e of entries || []) {
      if (!entryCatsByTournament[e.tournament_id]) entryCatsByTournament[e.tournament_id] = new Set<string>();
      entryCatsByTournament[e.tournament_id].add(e.cat_id);
    }

    // Pull a larger candidate pool per arena, then apply fairness at selection time.
    const matchBatches = await Promise.all(
      refreshedTournamentIds.map(async (tournamentId) => {
        const { data, error } = await supabase
          .from("tournament_matches")
          .select("id, tournament_id, round, cat_a_id, cat_b_id, winner_id, status, votes_a, votes_b, created_at")
          .eq("tournament_id", tournamentId)
          .in("status", [...VOTABLE_MATCH_STATUSES, "pending", "complete", "completed"] as any)
          .order("created_at", { ascending: false })
          .limit(50);
        return { data: data || [], error };
      })
    );
    const firstMatchErr = matchBatches.find((b) => !!b.error)?.error;
    if (firstMatchErr) {
      return NextResponse.json({ ok: false, error: firstMatchErr.message }, { status: 500, headers: NO_STORE_HEADERS });
    }

    const fetchedMatches = matchBatches.flatMap((b) => b.data);
    const allMatches = fetchedMatches
      .sort((a: any, b: any) => {
        const roundDelta = Number(a?.round || 0) - Number(b?.round || 0);
        if (roundDelta !== 0) return roundDelta;
        const aTs = Date.parse(String((a as any)?.created_at || "")) || 0;
        const bTs = Date.parse(String((b as any)?.created_at || "")) || 0;
        return aTs - bTs;
      })
      .filter((m) => {
      if (m.status === 'archived') return false;
      const allowed = entryCatsByTournament[m.tournament_id];
      if (!allowed || allowed.size === 0) return true;
      return allowed.has(m.cat_a_id) && allowed.has(m.cat_b_id);
    });

    // Get all cat IDs we need
    const catIds = new Set<string>();
    for (const m of allMatches || []) {
      catIds.add(m.cat_a_id);
      catIds.add(m.cat_b_id);
    }

    // Fetch cat details
    let cats: Array<Record<string, unknown>> = [];
    const primaryCats = await supabase
      .from("cats")
      .select("id, user_id, name, image_path, image_url_thumb, image_url_card, image_url_original, image_review_status, status, rarity, cat_level, level, ability, ability_description, description, origin, wins, losses, attack, defense, speed, charisma, chaos")
      .in("id", Array.from(catIds));
    cats = (primaryCats.data as Array<Record<string, unknown>> | null) || [];
    if (!primaryCats.data) {
      const { data: legacyCats } = await supabase
        .from("cats")
        .select("id, user_id, name, image_path, rarity, ability, attack, defense, speed, charisma, chaos")
        .in("id", Array.from(catIds));
      cats = (legacyCats as Array<Record<string, unknown>> | null) || [];
    }

    const userIds = Array.from(
      new Set(
        (cats as Array<{ user_id?: string | null }>).map((c) => c.user_id).filter(Boolean) as string[]
      )
    );
    const { data: profileRows } = userIds.length > 0
      ? await supabase.from('profiles').select('id, username, guild').in('id', userIds)
      : { data: [] as Array<{ id: string; username: string | null; guild: string | null }> };
    const profileMap: Record<string, { username: string | null; guild: string | null }> = {};
    for (const p of profileRows || []) {
      if (p.id) profileMap[p.id] = {
        username: String(p.username || '').trim() || null,
        guild: (p.guild === 'sun' || p.guild === 'moon') ? p.guild : null,
      };
    }

    const catMap: Record<string, { id: string; name: string; image_url: string | null; rarity: string; level: number; ability: string | null; ability_description: string | null; description: string | null; origin: string | null; wins: number; losses: number; owner_id: string | null; owner_username: string | null; owner_guild: string | null; stats: { attack: number; defense: number; speed: number; charisma: number; chaos: number } }> = {};
    const ineligibleCatIds = new Set<string>();
    for (const cat of cats as Array<{
      id: string;
      user_id?: string | null;
      name: string;
      image_path: string | null;
      image_url_thumb?: string | null;
      image_url_card?: string | null;
      image_url_original?: string | null;
      image_review_status?: string | null;
      rarity?: string | null;
      cat_level?: number | null;
      level?: number | null;
      ability?: string | null;
      ability_description?: string | null;
      description?: string | null;
      origin?: string | null;
      wins?: number | null;
      losses?: number | null;
      attack?: number | null;
      defense?: number | null;
      speed?: number | null;
      charisma?: number | null;
      chaos?: number | null;
    }>) {
      const status = String((cat as any).status || 'approved').toLowerCase();
      const review = String(cat.image_review_status || '').toLowerCase();
      const origin = String((cat as any).origin || 'submitted').toLowerCase();
      const ownerId = String(cat.user_id || '');
      const sourcePath = String(cat.image_url_thumb || cat.image_url_card || cat.image_url_original || cat.image_path || '').trim();
      const starterLike = /\/starter\//i.test(sourcePath);
      const eligible = status === 'approved'
        && origin === 'submitted'
        && ownerId !== NPC_USER_ID
        && (review === '' || review === 'approved')
        && !starterLike;
      if (!eligible) {
        ineligibleCatIds.add(String(cat.id || ''));
        continue;
      }
      const normalizedThumb = normalizeCatImageUrl({ id: String(cat.id) });
      const normalizedName = String(cat.name || '').trim() || 'Unknown';
      catMap[cat.id] = {
        id: cat.id,
        name: normalizedName,
        image_url: normalizedThumb,
        rarity: cat.rarity || "Common",
        level: Math.max(1, Number((cat as any).cat_level || (cat as any).level || 1)),
        ability: cat.ability || null,
        ability_description: (cat as any).ability_description ? String((cat as any).ability_description) : null,
        description: (cat as any).description ? String((cat as any).description) : null,
        origin: (cat as any).origin ? String((cat as any).origin) : null,
        wins: Number((cat as any).wins || 0),
        losses: Number((cat as any).losses || 0),
        owner_id: cat.user_id ? String(cat.user_id) : null,
        owner_username: cat.user_id ? (profileMap[cat.user_id]?.username || null) : null,
        owner_guild: cat.user_id ? (profileMap[cat.user_id]?.guild || null) : null,
        stats: {
          attack: cat.attack || 0,
          defense: cat.defense || 0,
          speed: cat.speed || 0,
          charisma: cat.charisma || 0,
          chaos: cat.chaos || 0,
        },
      };
    }

    if (ineligibleCatIds.size > 0) {
      const ids = Array.from(ineligibleCatIds).filter(Boolean);
      if (ids.length > 0) {
        await supabase
          .from('tournament_matches')
          .update({ status: 'complete' })
          .in('tournament_id', refreshedTournamentIds)
          .in('status', ['active', 'in_progress', 'pending'] as any)
          .in('cat_a_id', ids);
        await supabase
          .from('tournament_matches')
          .update({ status: 'complete' })
          .in('tournament_id', refreshedTournamentIds)
          .in('status', ['active', 'in_progress', 'pending'] as any)
          .in('cat_b_id', ids);
      }
    }

    // Only mark votes for currently active matches so old rounds don't look "stuck".
    const activeMatchIds = (allMatches || [])
      .filter((m) => {
        const t = todayTournaments.find((tt) => tt.id === m.tournament_id);
        if (!t) return false;
        return m.round === (t.round || 1) && m.status === 'active';
      })
      .map((m) => m.id);
    const votedMatches: Record<string, string> = {};
    const userPredictions: Record<string, { predicted_cat_id: string; bet_sigils: number }> = {};

    let predictionMeta: { current_streak: number; best_streak: number; bonus_rolls: number; streak_bonus_pct: number } | null = null;
    if (guestId) {
      await supabase.rpc('ensure_user_prediction_stats', { p_user_id: guestId });
      const { data: stats } = await supabase
        .from('user_prediction_stats')
        .select('current_streak, best_streak, bonus_rolls')
        .eq('user_id', guestId)
        .maybeSingle();
      const current = stats?.current_streak || 0;
      predictionMeta = {
        current_streak: current,
        best_streak: stats?.best_streak || 0,
        bonus_rolls: stats?.bonus_rolls || 0,
        streak_bonus_pct: predictionStreakBonusPct(current),
      };
    }

    if (guestId && activeMatchIds.length > 0 && !testerMode) {
      const { data: votes } = await supabase
        .from("votes")
        .select("battle_id, voted_for")
        .eq("voter_user_id", guestId)
        .in("battle_id", activeMatchIds);

      for (const v of votes || []) {
        votedMatches[v.battle_id] = v.voted_for;
      }

      const { data: predictions } = await supabase
        .from('match_predictions')
        .select('match_id, predicted_cat_id, bet_sigils')
        .eq('voter_user_id', guestId)
        .in('match_id', activeMatchIds);
      for (const p of predictions || []) {
        userPredictions[p.match_id] = { predicted_cat_id: p.predicted_cat_id, bet_sigils: p.bet_sigils || 0 };
      }
    }

    const typeByTournamentId: Record<string, 'main' | 'rookie'> = {};
    for (const t of todayTournaments as Array<any>) {
      typeByTournamentId[String(t?.id || '')] = 'main';
    }

    const canonicalTournamentId =
      String(
        (todayTournaments as Array<any>)
          .sort((a: any, b: any) => (Date.parse(String(b?.created_at || '')) || 0) - (Date.parse(String(a?.created_at || '')) || 0))[0]?.id ||
        ''
      ) || String((todayTournaments as Array<any>)[0]?.id || '');

    function mapMatch(m: any) {
      const a = catMap[m.cat_a_id];
      const b = catMap[m.cat_b_id];
      if (!a || !b) return null;
      if (!testerMode && isSameOwnerPair(a.owner_id || null, b.owner_id || null)) return null;
      return {
        match_id: m.id,
        status: testerMode ? 'active' : m.status,
        created_at: m.created_at || null,
        votes_a: m.votes_a || 0,
        votes_b: m.votes_b || 0,
        winner_id: testerMode ? null : m.winner_id,
        is_close_match: Math.abs((m.votes_a || 0) - (m.votes_b || 0)) <= 2,
        user_prediction: userPredictions[m.id] || null,
        cat_a: a,
        cat_b: b,
      };
    }

    // Build arena objects from today's tournament rows.
    const arenasRaw = todayTournaments.map((t) => {
      const tMatches = (allMatches || []).filter((m) => m.tournament_id === t.id);

      // Group by round
      const rounds: Record<number, typeof tMatches> = {};
      for (const m of tMatches) {
        if (!rounds[m.round]) rounds[m.round] = [];
        rounds[m.round].push(m);
      }

      const formattedRounds = Object.entries(rounds)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([roundNum, matches]) => {
          const round = Number(roundNum);
          const mapped = matches.map(mapMatch).filter(Boolean) as Array<any>;
          const isCurrentRound = round === Number(t.round || 1);
          const fairMatches = isCurrentRound
            ? pickFairMatches(mapped, Math.min(mapped.length, 16), {
              maxPerOwner: 2,
              avoidSameOwnerMatch: true,
            })
            : mapped;
          return {
            round,
            matches: fairMatches,
          };
        });

      // Get champion info
      const champion = t.champion_id && catMap[t.champion_id] ? catMap[t.champion_id] : null;

      return {
        tournament_id: canonicalTournamentId || t.id,
        type: t.tournament_type || "main",
        date: t.date,
        current_round: t.round || 1,
        status: t.status === 'completed' ? 'complete' : t.status,
        champion,
        rounds: formattedRounds,
      };
    });

    const normalizedArenasRaw = arenasRaw.map((a) => ({ ...a, status: a.status || CANONICAL_ACTIVE_STATUS }));
    const poolFor = (type: 'main' | 'rookie') => {
      const active = (allMatches || [])
        .filter((m: any) => typeByTournamentId[String(m?.tournament_id || '')] === type)
        .filter((m: any) => testerMode || VOTABLE_MATCH_STATUSES.includes(String(m?.status || '').toLowerCase() as any))
        .map(mapMatch)
        .filter(Boolean)
        .sort((a: any, b: any) => {
          const ta = Date.parse(String((a as any)?.created_at || "")) || 0;
          const tb = Date.parse(String((b as any)?.created_at || "")) || 0;
          return tb - ta;
        }) as Array<any>;
      return pickFairMatches(active, Math.min(16, active.length), {
        maxPerOwner: 2,
        avoidSameOwnerMatch: true,
      });
    };
    const mainPool = poolFor('main');
    const rookiePool: Array<any> = [];

    function pickArenaForType(type: 'main' | 'rookie') {
      const pool = type === 'main' ? mainPool : rookiePool;
      const candidate = normalizedArenasRaw.find((a) => String(a.type) === type) || null;
      if (candidate) {
        return {
          ...candidate,
          tournament_id: canonicalTournamentId || candidate.tournament_id,
          rounds: Array.isArray(candidate.rounds) && candidate.rounds.length > 0
            ? candidate.rounds
            : [{ round: Number(candidate.current_round || 1), matches: pool }],
        };
      }
      if (pool.length > 0) {
        return {
          tournament_id: canonicalTournamentId || `today-${today}`,
          type,
          date: today,
          current_round: 1,
          status: CANONICAL_ACTIVE_STATUS,
          champion: null,
          rounds: [{ round: 1, matches: pool }],
        };
      }
      return null;
    }
    const normalizedArenas = (['main'] as const)
      .map((type) => pickArenaForType(type))
      .filter(Boolean) as Array<any>;
    const debugImageViolations = [...mainPool, ...rookiePool]
      .flatMap((m: any) => [String(m?.cat_a?.image_url || ''), String(m?.cat_b?.image_url || '')])
      .filter((src) => !!src && !src.includes('/cat-placeholder') && !isThumbUrl(src));

    const payload: Record<string, unknown> = {
      ok: true,
      arenas: normalizedArenas,
      mainPool,
      rookiePool,
      voted_matches: votedMatches,
      prediction_meta: predictionMeta,
      tester_mode: testerMode,
    };
    if (debugMode) {
      const tTypeById = Object.fromEntries(todayTournaments.map((t: any) => [String(t.id), String(t.tournament_type || "")]));
      const allVotable = (allMatches || []).filter((m: any) => VOTABLE_MATCH_STATUSES.includes(String(m?.status || '').toLowerCase() as any));
      const mainCandidates = allVotable.filter((m: any) => tTypeById[String(m?.tournament_id || "")] === 'main');
      const rookieCandidates: Array<any> = [];
      const completedStatuses = new Set(['complete', 'completed']);
      const allCompleted = (allMatches || []).filter((m: any) => completedStatuses.has(String(m?.status || '').toLowerCase()));
      const mainCompleted = allCompleted.filter((m: any) => tTypeById[String(m?.tournament_id || "")] === 'main');
      const rookieCompleted: Array<any> = [];
      const newestBy = (rows: Array<any>) => {
        const sorted = [...rows].sort((a, b) => (Date.parse(String(b?.created_at || '')) || 0) - (Date.parse(String(a?.created_at || '')) || 0));
        return sorted[0]?.created_at ? String(sorted[0].created_at) : '';
      };
      payload.debug = {
        ...healedArenaState,
        mainCandidateCount: mainCandidates.length,
        rookieCandidateCount: rookieCandidates.length,
        mainVotableCount: mainCandidates.length,
        rookieVotableCount: rookieCandidates.length,
        mainCompletedCount: mainCompleted.length,
        rookieCompletedCount: rookieCompleted.length,
        mainTournamentId: String(todayTournaments.find((t: any) => String(t.tournament_type) === 'main')?.id || ''),
        rookieTournamentId: '',
        mainNewestVotableCreatedAt: newestBy(mainCandidates),
        rookieNewestVotableCreatedAt: newestBy(rookieCandidates),
        mainNewestMatchCreatedAt: String(mainPool?.[0]?.created_at || ''),
        rookieNewestMatchCreatedAt: '',
        includedMatchStatuses: [...VOTABLE_MATCH_STATUSES],
        debugImageViolations,
      };
    }
    return NextResponse.json(payload, { headers: NO_STORE_HEADERS });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
