import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resolveCatImageUrl, stableNpcImageUrl, isPlaceholderLikeImage } from "./images";

export type ArenaType = "main" | "rookie";
export type ArenaTab = "voting" | "results";

export type ArenaPageCat = {
  id: string;
  name: string;
  image_url: string | null;
  rarity: string;
  ability: string | null;
  owner_username: string | null;
  owner_guild: "sun" | "moon" | null;
  stats: { attack: number; defense: number; speed: number; charisma: number; chaos: number };
};

export type ArenaPageMatch = {
  match_id: string;
  status: string;
  votes_a: number;
  votes_b: number;
  winner_id: string | null;
  is_close_match: boolean;
  user_prediction?: { predicted_cat_id: string; bet_sigils: number } | null;
  cat_a: ArenaPageCat;
  cat_b: ArenaPageCat;
};

const PAGE_SIZE = 16;

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

export async function loadArenaPage(params: {
  arena: ArenaType;
  tab: ArenaTab;
  pageIndex: number;
  userId?: string | null;
  dayKey?: string;
}) {
  const arena = params.arena;
  const tab = params.tab;
  const pageIndex = Math.max(0, Number(params.pageIndex || 0));
  const dayKey = params.dayKey || getUtcDayKey();
  const userId = params.userId || null;
  const supabase = supabaseAdmin();

  const statuses = ["active", "in_progress", "complete", "completed"];
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
    };
  }

  const tMap: Record<string, { round: number }> = {};
  const tIds: string[] = [];
  for (const t of tRows) {
    tMap[String(t.id)] = { round: Number(t.round || 1) };
    tIds.push(String(t.id));
  }

  const matchSelectPreferred = "id, tournament_id, round, cat_a_id, cat_b_id, winner_id, status, votes_a, votes_b, updated_at, created_at";
  const matchSelectFallback = "id, tournament_id, round, cat_a_id, cat_b_id, winner_id, status, votes_a, votes_b, created_at";
  const baseQuery = (selectClause: string) => {
    let q = supabase.from("tournament_matches").select(selectClause).in("tournament_id", tIds);
    if (tab === "voting") q = q.eq("status", "active");
    if (tab === "results") q = q.eq("status", "complete");
    return q;
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
    };
  }

  const catIds = Array.from(new Set(filtered.flatMap((m) => [String(m.cat_a_id), String(m.cat_b_id)])));
  const { data: catsRaw } = await supabase
    .from("cats")
    .select("id, user_id, name, image_path, image_review_status, status, rarity, ability, attack, defense, speed, charisma, chaos")
    .in("id", catIds);
  const cats = catsRaw || [];

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
    const eligible = status === "approved" && (review === "" || review === "approved");
    if (!eligible) continue;
    const resolved = await resolveCatImageUrl(supabase, c.image_path, c.image_review_status || null);
    const fallbackStable = String(c.user_id || "") === "00000000-0000-0000-0000-000000000000" ? stableNpcImageUrl(c.id) : resolved;
    catMap[String(c.id)] = {
      id: String(c.id),
      name: String(c.name || "Unknown"),
      image_url: !resolved || isPlaceholderLikeImage(resolved) ? fallbackStable : resolved,
      rarity: String(c.rarity || "Common"),
      ability: c.ability || null,
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
    .filter((m) => !!catMap[String(m.cat_a_id)] && !!catMap[String(m.cat_b_id)])
    .map((m) => ({
      match_id: String(m.id),
      status: String(m.status || "active"),
      votes_a: Number(m.votes_a || 0),
      votes_b: Number(m.votes_b || 0),
      winner_id: m.winner_id ? String(m.winner_id) : null,
      is_close_match: Math.abs(Number(m.votes_a || 0) - Number(m.votes_b || 0)) <= 2,
      cat_a: catMap[String(m.cat_a_id)],
      cat_b: catMap[String(m.cat_b_id)],
    }));

  const seed = `${dayKey}:${arena}:${tab}`;
  const globallyOrdered = arrangeWithCatSpacing(
    [...enriched].sort((a, b) => seededOrderKey(seed, a.match_id) - seededOrderKey(seed, b.match_id))
  );
  const totalMatches = globallyOrdered.length;
  const totalPages = Math.max(1, Math.ceil(totalMatches / PAGE_SIZE));
  const safePage = Math.min(pageIndex, Math.max(0, totalPages - 1));
  const start = safePage * PAGE_SIZE;
  const pageMatches = globallyOrdered.slice(start, start + PAGE_SIZE);
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
  };
}
