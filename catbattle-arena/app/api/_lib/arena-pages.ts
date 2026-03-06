import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeCatImageUrl } from "./images";
import { ensureActiveArenasUtc, CANONICAL_ACTIVE_STATUS } from "./arena-active";
import { computeVoteStats } from "./vote-stats";
import { pickFairMatches } from "./pickFairMatches";

export type ArenaType = "main" | "rookie";
export type ArenaTab = "voting" | "results";

export type ArenaPageCat = {
  id: string;
  name: string;
  image_url: string | null;
  rarity: string;
  level?: number;
  ability: string | null;
  ability_description?: string | null;
  description?: string | null;
  origin?: string | null;
  wins?: number;
  losses?: number;
  owner_id?: string | null;
  owner_username: string | null;
  owner_guild: "sun" | "moon" | null;
  stats: { attack: number; defense: number; speed: number; charisma: number; chaos: number };
};

export type ArenaPageMatch = {
  match_id: string;
  status: string;
  votes_a: number;
  votes_b: number;
  total_votes: number;
  percent_a: number;
  percent_b: number;
  winner_id: string | null;
  is_close_match: boolean;
  user_prediction?: { predicted_cat_id: string; bet_sigils: number } | null;
  cat_a: ArenaPageCat;
  cat_b: ArenaPageCat;
};

const PAGE_SIZE = 4;
const MAX_ENSURE_ATTEMPTS = 40;
const MIN_IMPRESSIONS = 20;
const STATUS_ACTIVE = ["active", "in_progress"] as const;
const STATUS_ANY = ["active", "in_progress", "complete", "completed"] as const;
const NPC_USER_ID = "00000000-0000-0000-0000-000000000000";

export type ArenaPageDebug = {
  requestedCount: number;
  returnedCount: number;
  arena: ArenaType;
  pageIndex: number;
  roundId: number;
  eligibleCatsCount: number;
  openMatchesCount: number;
  existingCount: number;
  generatedCount: number;
  attempts: number;
  timeWindow: string;
  whyNotFilled: string[];
  votingClosedUntilNextPulse?: boolean;
  fairness: {
    exposureCounts: {
      min: number;
      median: number;
      max: number;
    };
    newCatsIncluded: number;
    duplicatesAvoided: number;
  };
};

export function getUtcDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function hashString(input: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function seededOrderKey(seed: string, id: string): number {
  return hashString(`${seed}:${id}`);
}

function arrangeWithCatSpacing(matches: ArenaPageMatch[], minGap = 4): ArenaPageMatch[] {
  if (matches.length <= 2) return matches;
  const out: ArenaPageMatch[] = [];
  const remaining = [...matches];
  const recentCats: string[] = [];
  while (remaining.length > 0) {
    let idx = remaining.findIndex((m) => {
      const a = String(m.cat_a?.id || "");
      const b = String(m.cat_b?.id || "");
      return !recentCats.includes(a) && !recentCats.includes(b);
    });
    if (idx < 0) idx = 0;
    const [picked] = remaining.splice(idx, 1);
    out.push(picked);
    recentCats.push(String(picked.cat_a?.id || ""), String(picked.cat_b?.id || ""));
    while (recentCats.length > minGap * 2) recentCats.shift();
  }
  return out;
}

function supabaseAdmin(): SupabaseClient {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\\n/g, "").replace(/\s/g, "").trim();
  const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").replace(/\\n/g, "").trim();
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function getPageSize(): number {
  return PAGE_SIZE;
}

function toPairSignature(catAId: string, catBId: string): string {
  return [String(catAId || ""), String(catBId || "")].sort().join("::");
}

function isSameOwnerPair(catAOwnerId?: string | null, catBOwnerId?: string | null): boolean {
  const a = String(catAOwnerId || "").trim();
  const b = String(catBOwnerId || "").trim();
  return !!a && !!b && a === b;
}

function seededShuffle<T>(items: T[], seed: string, idOf: (value: T, index: number) => string): T[] {
  return [...items]
    .map((value, index) => ({ value, index }))
    .sort((a, b) => {
      const ak = seededOrderKey(seed, idOf(a.value, a.index));
      const bk = seededOrderKey(seed, idOf(b.value, b.index));
      return ak - bk;
    })
    .map((row) => row.value);
}

function weightedPickWithoutReplacement(
  ids: string[],
  weightById: Map<string, number>,
  count: number,
  seedKey: string
): string[] {
  const selected: string[] = [];
  const pool = [...ids];
  let step = 0;
  while (pool.length > 0 && selected.length < count) {
    const totalWeight = pool.reduce((sum, id) => sum + Math.max(0.0001, Number(weightById.get(id) || 1)), 0);
    let r = (seededOrderKey(seedKey, `pick:${step}:${pool.length}`) / 0xffffffff) * totalWeight;
    step += 1;
    let pickedIndex = 0;
    for (let i = 0; i < pool.length; i += 1) {
      const w = Math.max(0.0001, Number(weightById.get(pool[i]) || 1));
      r -= w;
      if (r <= 0) {
        pickedIndex = i;
        break;
      }
    }
    const [picked] = pool.splice(pickedIndex, 1);
    if (!picked) continue;
    selected.push(picked);
  }
  return selected;
}

async function ensureArenaMatches(params: {
  supabase: SupabaseClient;
  arena: ArenaType;
  dayKey: string;
  roundId: number;
  pageIndex: number;
  targetCount?: number;
}): Promise<ArenaPageDebug> {
  const { supabase, arena, dayKey, roundId, pageIndex } = params;
  const targetCount = Math.max(1, Number(params.targetCount || PAGE_SIZE));
  const requestedCount = Math.max(targetCount, (Math.max(0, pageIndex) + 1) * targetCount);
  const debug: ArenaPageDebug = {
    requestedCount,
    returnedCount: 0,
    arena,
    pageIndex,
    roundId,
    eligibleCatsCount: 0,
    openMatchesCount: 0,
    existingCount: 0,
    generatedCount: 0,
    attempts: 0,
    timeWindow: dayKey,
    whyNotFilled: [],
    fairness: {
      exposureCounts: { min: 0, median: 0, max: 0 },
      newCatsIncluded: 0,
      duplicatesAvoided: 0,
    },
  };

  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id, status")
    .eq("date", dayKey)
    .eq("tournament_type", arena)
    .in("status", [...STATUS_ANY]);
  const pickedTournament =
    (tournaments || []).find((t: any) => String(t?.status || "").toLowerCase() === CANONICAL_ACTIVE_STATUS)
    || tournaments?.[0]
    || null;
  const tournamentId = String(pickedTournament?.id || "");
  const tournamentStatus = String(pickedTournament?.status || "").toLowerCase();

  if (!tournamentId) {
    debug.whyNotFilled.push("no_tournament_for_day");
    debug.votingClosedUntilNextPulse = true;
    return debug;
  }

  if (tournamentStatus === "complete" || tournamentStatus === "completed") {
    debug.whyNotFilled.push("votingClosedUntilNextPulse");
    debug.votingClosedUntilNextPulse = true;
    return debug;
  }

  const { data: allRoundMatches } = await supabase
    .from("tournament_matches")
    .select("id, cat_a_id, cat_b_id, round, status")
    .eq("tournament_id", tournamentId)
    .eq("round", roundId)
    .in("status", [...STATUS_ANY])
    .order("created_at", { ascending: true });
  const allMatches = allRoundMatches || [];
  const openMatches = allMatches.filter((m) => String(m.status || "").toLowerCase() === "active");
  debug.openMatchesCount = openMatches.length;
  debug.existingCount = openMatches.length;
  if (openMatches.length >= requestedCount) {
    debug.returnedCount = openMatches.length;
    return debug;
  }

  const { data: entryRows } = await supabase
    .from("tournament_entries")
    .select("cat_id")
    .eq("tournament_id", tournamentId);
  const entryCatIds = Array.from(new Set((entryRows || []).map((e: any) => String(e.cat_id || "")).filter(Boolean)));
  if (entryCatIds.length === 0) {
    debug.whyNotFilled.push("no_tournament_entries");
    debug.returnedCount = openMatches.length;
    return debug;
  }

  const { data: eligibleCatsRaw } = await supabase
    .from("cats")
    .select("id, status, image_review_status, origin, user_id, image_path, image_url_thumb, created_at")
    .in("id", entryCatIds);
  const ownerByCatId = new Map<string, string>();
  for (const c of eligibleCatsRaw || []) {
    const catId = String((c as any).id || "");
    const ownerId = String((c as any).user_id || "");
    if (catId && ownerId) ownerByCatId.set(catId, ownerId);
  }
  const eligibleCatIds = (eligibleCatsRaw || [])
    .filter((c: any) => {
      const status = String(c.status || "").toLowerCase();
      const review = String(c.image_review_status || "").toLowerCase();
      const origin = String(c.origin || "submitted").toLowerCase();
      const ownerId = String(c.user_id || "");
      const imageHint = String(c.image_url_thumb || c.image_path || "");
      return status === "approved"
        && origin === "submitted"
        && ownerId !== NPC_USER_ID
        && (review === "" || review === "approved" || review === "null")
        && !/\/starter\//i.test(imageHint);
    })
    .map((c: any) => String(c.id))
    .filter(Boolean);
  debug.eligibleCatsCount = eligibleCatIds.length;
  if (eligibleCatIds.length < 2) {
    debug.whyNotFilled.push("insufficient_eligible_cats");
    debug.returnedCount = openMatches.length;
    return debug;
  }

  const recentWindow = Math.max(12, targetCount * 6);
  const recentMatches = allMatches.slice(-recentWindow);
  const existingSig = new Set<string>();
  const usedCatsOnOpenPage = new Set<string>();
  for (const m of recentMatches) {
    const a = String((m as any).cat_a_id || "");
    const b = String((m as any).cat_b_id || "");
    if (!a || !b || a === b) continue;
    existingSig.add(toPairSignature(a, b));
  }
  for (const m of openMatches) {
    const a = String((m as any).cat_a_id || "");
    const b = String((m as any).cat_b_id || "");
    if (a) usedCatsOnOpenPage.add(a);
    if (b) usedCatsOnOpenPage.add(b);
  }

  const seed = `${dayKey}:${arena}:${roundId}:${pageIndex}`;
  const createdAtByCat = new Map<string, number>();
  for (const c of eligibleCatsRaw || []) {
    const id = String((c as any).id || "");
    if (!id) continue;
    const ts = Date.parse(String((c as any).created_at || "")) || 0;
    createdAtByCat.set(id, ts);
  }
  const exposureByCat = new Map<string, number>();
  for (const id of eligibleCatIds) exposureByCat.set(id, 0);
  for (const m of allMatches) {
    const a = String((m as any).cat_a_id || "");
    const b = String((m as any).cat_b_id || "");
    if (exposureByCat.has(a)) exposureByCat.set(a, Number(exposureByCat.get(a) || 0) + 1);
    if (exposureByCat.has(b)) exposureByCat.set(b, Number(exposureByCat.get(b) || 0) + 1);
  }
  const nowMs = Date.now();
  const fortyEightHoursMs = 48 * 60 * 60 * 1000;
  const newCats = eligibleCatIds.filter((id) => {
    const created = Number(createdAtByCat.get(id) || 0);
    return created > 0 && nowMs - created <= fortyEightHoursMs;
  });
  const weightByCat = new Map<string, number>();
  for (const id of eligibleCatIds) {
    const exposure = Number(exposureByCat.get(id) || 0);
    let weight = 1 / (1 + exposure);
    if (exposure < MIN_IMPRESSIONS) weight *= 3;
    if (newCats.includes(id)) weight *= 2;
    weightByCat.set(id, Math.max(0.05, weight));
  }
  const missing = Math.max(0, requestedCount - openMatches.length);
  const neededCats = Math.max(2, Math.min(eligibleCatIds.length, missing * 2 + 6));
  const minNewCats = Math.min(newCats.length, Math.max(0, Math.min(4, neededCats)));
  const pickedNew = weightedPickWithoutReplacement(newCats, weightByCat, minNewCats, `${seed}:new`);
  const remainingCandidates = eligibleCatIds.filter((id) => !pickedNew.includes(id));
  const pickedRest = weightedPickWithoutReplacement(
    remainingCandidates,
    weightByCat,
    Math.max(0, neededCats - pickedNew.length),
    `${seed}:rest`
  );
  const ordered = seededShuffle([...pickedNew, ...pickedRest], seed, (value, idx) => `${value}:${idx}`);
  const pendingRows: Array<Record<string, unknown>> = [];
  const reasons = new Map<string, number>();
  const exposureValues = eligibleCatIds
    .map((id) => Number(exposureByCat.get(id) || 0))
    .sort((a, b) => a - b);
  const medianExposure = exposureValues.length
    ? exposureValues[Math.floor(exposureValues.length / 2)]
    : 0;
  const duplicatesAvoidedCounter = () =>
    Number(reasons.get("duplicate_pair_same_round") || 0)
    + Number(reasons.get("cat_repeated_on_page") || 0)
    + Number(reasons.get("same_owner_pair") || 0)
    + Number(reasons.get("same_cat_pair") || 0);

  let attempts = 0;
  let cursor = 0;
  while (pendingRows.length < missing && attempts < MAX_ENSURE_ATTEMPTS) {
    attempts += 1;
    const catA = ordered[cursor % ordered.length];
    cursor += 1;
    if (!catA) {
      reasons.set("candidate_exhausted", (reasons.get("candidate_exhausted") || 0) + 1);
      continue;
    }
    let pickedCatB: string | null = null;
    for (let i = 0; i < ordered.length; i += 1) {
      const catB = ordered[(cursor + i) % ordered.length];
      if (!catB || catB === catA) {
        reasons.set("same_cat_pair", (reasons.get("same_cat_pair") || 0) + 1);
        continue;
      }
      const sig = toPairSignature(catA, catB);
      if (existingSig.has(sig)) {
        reasons.set("duplicate_pair_same_round", (reasons.get("duplicate_pair_same_round") || 0) + 1);
        continue;
      }
      if (isSameOwnerPair(ownerByCatId.get(catA) || null, ownerByCatId.get(catB) || null)) {
        reasons.set("same_owner_pair", (reasons.get("same_owner_pair") || 0) + 1);
        continue;
      }
      if (usedCatsOnOpenPage.has(catA) || usedCatsOnOpenPage.has(catB)) {
        reasons.set("cat_repeated_on_page", (reasons.get("cat_repeated_on_page") || 0) + 1);
        continue;
      }
      pickedCatB = catB;
      existingSig.add(sig);
      usedCatsOnOpenPage.add(catA);
      usedCatsOnOpenPage.add(catB);
      break;
    }
    if (!pickedCatB) continue;
    pendingRows.push({
      tournament_id: tournamentId,
      round: roundId,
      cat_a_id: catA,
      cat_b_id: pickedCatB,
      status: "active",
      votes_a: 0,
      votes_b: 0,
    });
  }
  debug.attempts = attempts;

  if (pendingRows.length > 0) {
    const { error: insertErr } = await supabase.from("tournament_matches").insert(pendingRows);
    if (insertErr) {
      reasons.set(`insert_error:${insertErr.message}`, (reasons.get(`insert_error:${insertErr.message}`) || 0) + 1);
    }
  }

  const { data: refreshedOpen } = await supabase
    .from("tournament_matches")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("round", roundId)
    .eq("status", "active");
  const openCount = Number(refreshedOpen?.length || 0);
  debug.generatedCount = Math.max(0, openCount - debug.existingCount);
  debug.returnedCount = openCount;
  if (openCount < requestedCount && debug.eligibleCatsCount < requestedCount * 2) {
    reasons.set("insufficient_eligible_cats", (reasons.get("insufficient_eligible_cats") || 0) + 1);
  }
  debug.whyNotFilled = Array.from(reasons.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason]) => reason);
  debug.fairness = {
    exposureCounts: {
      min: exposureValues[0] ?? 0,
      median: medianExposure,
      max: exposureValues[exposureValues.length - 1] ?? 0,
    },
    newCatsIncluded: pickedNew.length,
    duplicatesAvoided: duplicatesAvoidedCounter(),
  };
  return debug;
}

export async function loadArenaPage(params: {
  arena: ArenaType;
  tab: ArenaTab;
  pageIndex: number;
  userId?: string | null;
  dayKey?: string;
  targetCount?: number;
  debug?: boolean;
}) {
  const arena = params.arena;
  const tab = params.tab;
  const pageIndex = Math.max(0, Number(params.pageIndex || 0));
  const dayKey = params.dayKey || getUtcDayKey();
  const userId = params.userId || null;
  const targetCount = Math.max(1, Number(params.targetCount || PAGE_SIZE));
  const debugEnabled = !!params.debug;
  const supabase = supabaseAdmin();
  let debugInfo: ArenaPageDebug | undefined;

  // Self-heal active tournament/round state before reading matches.
  await ensureActiveArenasUtc(supabase, new Date());

  const statuses = [...STATUS_ANY];
  const { data: tournaments, error: tErr } = await supabase
    .from("tournaments")
    .select("id, round, status, tournament_type")
    .eq("date", dayKey)
    .eq("tournament_type", arena)
    .in("status", statuses);
  if (tErr) throw new Error(tErr.message);
  const tRows = tournaments || [];
  if (tRows.length === 0) {
    return {
      dayKey,
      arena,
      tab,
      pageIndex,
      pageSize: PAGE_SIZE,
      totalMatches: 0,
      totalPages: 1,
      matches: [] as ArenaPageMatch[],
      matchIds: [] as string[],
      activeVoters10m: 0,
      debug: debugEnabled
        ? ({
          requestedCount: Math.max(targetCount, (pageIndex + 1) * targetCount),
          returnedCount: 0,
          arena,
          pageIndex,
          roundId: 1,
          eligibleCatsCount: 0,
          openMatchesCount: 0,
          existingCount: 0,
          generatedCount: 0,
          attempts: 0,
          timeWindow: dayKey,
          whyNotFilled: ["no_tournament_for_day"],
          fairness: {
            exposureCounts: { min: 0, median: 0, max: 0 },
            newCatsIncluded: 0,
            duplicatesAvoided: 0,
          },
        } satisfies ArenaPageDebug)
        : undefined,
    };
  }

  const tMap: Record<string, { round: number }> = {};
  const tIds: string[] = [];
  for (const t of tRows) {
    tMap[String(t.id)] = { round: Number(t.round || 1) };
    tIds.push(String(t.id));
  }
  const activeTournament =
    tRows.find((t: any) => String(t?.status || "").toLowerCase() === CANONICAL_ACTIVE_STATUS)
    || tRows[0];
  const activeRound = Math.max(1, Number(activeTournament?.round || 1));

  if (tab === "voting") {
    debugInfo = await ensureArenaMatches({
      supabase,
      arena,
      dayKey,
      roundId: activeRound,
      pageIndex,
      targetCount,
    });
    if (debugEnabled && process.env.NODE_ENV !== "production") {
      console.info("[arena.ensure]", JSON.stringify(debugInfo));
    }
  }

  const matchSelectPreferred = "id, tournament_id, round, cat_a_id, cat_b_id, winner_id, status, votes_a, votes_b, updated_at, created_at";
  const matchSelectFallback = "id, tournament_id, round, cat_a_id, cat_b_id, winner_id, status, votes_a, votes_b, created_at";
  const baseQuery = (selectClause: string) => {
    let q = supabase.from("tournament_matches").select(selectClause).in("tournament_id", tIds);
    if (tab === "voting") q = q.eq("status", "active");
    if (tab === "results") q = q.eq("status", "complete");
    return q.order("created_at", { ascending: false }).limit(50);
  };

  let allMatches: Array<any> = [];
  let mErr: any = null;

  const primary = await baseQuery(matchSelectPreferred);
  allMatches = (primary.data as Array<any> | null) || [];
  mErr = primary.error;
  if (mErr && String(mErr.message || "").toLowerCase().includes("updated_at")) {
    const retry = await baseQuery(matchSelectFallback);
    allMatches = (retry.data as Array<any> | null) || [];
    mErr = retry.error;
  }
  if (mErr) throw new Error(mErr.message);

  const filtered = (allMatches || []).filter((m) => {
    if (!m?.cat_a_id || !m?.cat_b_id) return false;
    if (m.cat_a_id === m.cat_b_id) return false;
    if (tab === "voting") {
      const currentRound = tMap[String(m.tournament_id)]?.round || 1;
      if (Number(m.round || 1) !== currentRound) return false;
    }
    return true;
  });
  if (filtered.length === 0) {
    return {
      dayKey,
      arena,
      tab,
      pageIndex,
      pageSize: PAGE_SIZE,
      totalMatches: 0,
      totalPages: 1,
      matches: [] as ArenaPageMatch[],
      matchIds: [] as string[],
      activeVoters10m: 0,
      debug: debugEnabled ? debugInfo : undefined,
    };
  }

  const catIds = Array.from(new Set(filtered.flatMap((m) => [String(m.cat_a_id), String(m.cat_b_id)])));
  let cats: Array<any> = [];
  const catsPreferred = await supabase
    .from("cats")
    .select("id, user_id, name, image_path, image_url_thumb, image_url_card, image_url_original, image_review_status, status, rarity, cat_level, level, ability, description, origin, wins, losses, attack, defense, speed, charisma, chaos")
    .in("id", catIds);
  if (!catsPreferred.error) {
    cats = (catsPreferred.data as Array<any>) || [];
  } else {
    const catsFallback = await supabase
      .from("cats")
      .select("id, user_id, name, image_path, image_review_status, status, rarity, ability, attack, defense, speed, charisma, chaos")
      .in("id", catIds);
    cats = (catsFallback.data as Array<any>) || [];
  }

  const profileIds = Array.from(new Set(cats.map((c) => String(c.user_id || "")).filter(Boolean)));
  const { data: profileRows } = profileIds.length
    ? await supabase.from("profiles").select("id, username, guild").in("id", profileIds)
    : { data: [] as Array<{ id: string; username: string | null; guild: string | null }> };
  const profileMap: Record<string, { username: string | null; guild: "sun" | "moon" | null }> = {};
  for (const p of profileRows || []) {
    profileMap[String(p.id)] = {
      username: String(p.username || "").trim() || null,
      guild: p.guild === "sun" || p.guild === "moon" ? p.guild : null,
    };
  }

  const catMap: Record<string, ArenaPageCat> = {};
  for (const c of cats as Array<any>) {
    const status = String(c.status || "approved").toLowerCase();
    const review = String(c.image_review_status || "").toLowerCase();
    const origin = String(c.origin || "submitted").toLowerCase();
    const ownerId = String(c.user_id || "");
    const eligible = status === "approved" && origin === "submitted" && ownerId !== NPC_USER_ID && (review === "" || review === "approved");
    if (!eligible) continue;
    const sourcePath = String(c.image_url_thumb || c.image_url_card || c.image_url_original || c.image_path || "").trim();
    if (/\/starter\//i.test(sourcePath)) continue;
    const resolved = normalizeCatImageUrl({ id: String(c.id), image_url: sourcePath });
    catMap[String(c.id)] = {
      id: String(c.id),
      name: String(c.name || "Unknown"),
      image_url: resolved || null,
      rarity: String(c.rarity || "Common"),
      level: Math.max(1, Number(c.cat_level || c.level || 1)),
      ability: c.ability || null,
      ability_description: null,
      description: c.description ? String(c.description) : null,
      origin: c.origin ? String(c.origin) : null,
      wins: Number(c.wins || 0),
      losses: Number(c.losses || 0),
      owner_id: c.user_id ? String(c.user_id) : null,
      owner_username: c.user_id ? (profileMap[String(c.user_id)]?.username || null) : null,
      owner_guild: c.user_id ? (profileMap[String(c.user_id)]?.guild || null) : null,
      stats: {
        attack: Number(c.attack || 0),
        defense: Number(c.defense || 0),
        speed: Number(c.speed || 0),
        charisma: Number(c.charisma || 0),
        chaos: Number(c.chaos || 0),
      },
    };
  }

  const enriched = filtered
    .filter((m) => {
      const a = catMap[String(m.cat_a_id)];
      const b = catMap[String(m.cat_b_id)];
      if (!a || !b) return false;
      return !isSameOwnerPair(a.owner_id || null, b.owner_id || null);
    })
    .map((m) => {
      const votesA = Number(m.votes_a || 0);
      const votesB = Number(m.votes_b || 0);
      const stats = computeVoteStats(votesA, votesB);
      return {
        match_id: String(m.id),
        status: String(m.status || "active"),
        votes_a: votesA,
        votes_b: votesB,
        total_votes: stats.total_votes,
        percent_a: stats.percent_a,
        percent_b: stats.percent_b,
        winner_id: m.winner_id ? String(m.winner_id) : null,
        is_close_match: Math.abs(votesA - votesB) <= 2,
        cat_a: catMap[String(m.cat_a_id)],
        cat_b: catMap[String(m.cat_b_id)],
      };
    });

  const seed = `${dayKey}:${arena}:${tab}:${activeRound}`;
  const globallyOrdered = arrangeWithCatSpacing(
    [...enriched].sort((a, b) => {
      const sigA = toPairSignature(a.cat_a.id, a.cat_b.id);
      const sigB = toPairSignature(b.cat_a.id, b.cat_b.id);
      const rank = seededOrderKey(seed, sigA) - seededOrderKey(seed, sigB);
      if (rank !== 0) return rank;
      return seededOrderKey(seed, a.match_id) - seededOrderKey(seed, b.match_id);
    })
  );
  const fairOrdered = pickFairMatches(globallyOrdered, Math.min(50, globallyOrdered.length));
  const totalMatches = fairOrdered.length;
  const totalPages = Math.max(1, Math.ceil(totalMatches / PAGE_SIZE));
  const safePage = Math.min(pageIndex, Math.max(0, totalPages - 1));
  const start = safePage * PAGE_SIZE;
  const pageMatches = fairOrdered.slice(start, start + PAGE_SIZE);
  const pageMatchIds = pageMatches.map((m) => m.match_id);

  const predictionMap: Record<string, { predicted_cat_id: string; bet_sigils: number }> = {};
  if (userId && pageMatchIds.length > 0) {
    const { data: preds } = await supabase
      .from("match_predictions")
      .select("match_id, predicted_cat_id, bet_sigils")
      .eq("voter_user_id", userId)
      .in("match_id", pageMatchIds);
    for (const p of preds || []) {
      predictionMap[String(p.match_id)] = {
        predicted_cat_id: String(p.predicted_cat_id),
        bet_sigils: Number(p.bet_sigils || 0),
      };
    }
  }

  const withPredictions = pageMatches.map((m) => ({
    ...m,
    user_prediction: predictionMap[m.match_id] || null,
  }));

  const exposureSummaryForReturned = (() => {
    if (!debugEnabled || !debugInfo) return null;
    if (!(debugInfo.generatedCount === 0 && debugInfo.existingCount > 0)) return null;
    const returnedCatIds = Array.from(
      new Set(
        withPredictions
          .flatMap((m) => [String(m?.cat_a?.id || ""), String(m?.cat_b?.id || "")])
          .filter(Boolean)
      )
    );
    if (returnedCatIds.length === 0) {
      return { min: 0, median: 0, max: 0 };
    }
    const exposureByCat = new Map<string, number>();
    for (const id of returnedCatIds) exposureByCat.set(id, 0);
    for (const row of filtered) {
      const a = String((row as any)?.cat_a_id || "");
      const b = String((row as any)?.cat_b_id || "");
      if (exposureByCat.has(a)) exposureByCat.set(a, Number(exposureByCat.get(a) || 0) + 1);
      if (exposureByCat.has(b)) exposureByCat.set(b, Number(exposureByCat.get(b) || 0) + 1);
    }
    const values = Array.from(exposureByCat.values()).sort((x, y) => x - y);
    return {
      min: values[0] ?? 0,
      median: values[Math.floor(values.length / 2)] ?? 0,
      max: values[values.length - 1] ?? 0,
    };
  })();

  let activeVoters10m = 0;
  if (pageMatchIds.length > 0) {
    const sinceIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: recentVotes } = await supabase
      .from("votes")
      .select("voter_user_id")
      .in("battle_id", pageMatchIds)
      .gte("created_at", sinceIso);
    activeVoters10m = new Set((recentVotes || []).map((v: any) => String(v.voter_user_id || "")).filter(Boolean)).size;
  }

  return {
    dayKey,
    arena,
    tab,
    pageIndex: safePage,
    pageSize: PAGE_SIZE,
    totalMatches,
    totalPages,
    matches: withPredictions,
    matchIds: pageMatchIds,
    activeVoters10m,
    debug: debugEnabled
      ? (() => {
        const base = {
          ...(debugInfo || {
          requestedCount: Math.max(targetCount, (pageIndex + 1) * targetCount),
          returnedCount: 0,
          arena,
          pageIndex,
          roundId: activeRound,
          eligibleCatsCount: 0,
          openMatchesCount: 0,
          existingCount: 0,
          generatedCount: 0,
          attempts: 0,
          timeWindow: dayKey,
          whyNotFilled: [],
          fairness: {
            exposureCounts: { min: 0, median: 0, max: 0 },
            newCatsIncluded: 0,
            duplicatesAvoided: 0,
          },
        } satisfies ArenaPageDebug),
          returnedCount: withPredictions.length,
        };
        if (exposureSummaryForReturned) {
          const reasons = new Set(base.whyNotFilled || []);
          reasons.add("served_existing_open_matches");
          base.whyNotFilled = Array.from(reasons);
          base.fairness = {
            exposureCounts: exposureSummaryForReturned,
            newCatsIncluded: 0,
            duplicatesAvoided: 0,
          };
        }
        return base;
      })()
      : undefined,
  };
}
