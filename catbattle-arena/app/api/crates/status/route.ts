import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGuestId } from "../../_lib/guest";
import { parseCrateType, type CrateType } from "../../_lib/crate-engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAID_CRATE_COST = 90;
const EPIC_CRATE_BASE_COST = 280;
const EPIC_DAILY_CAP = 8;

function getServiceClient() {
  return createClient(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\\n/g, "").replace(/\s/g, "").trim(),
    (process.env.SUPABASE_SERVICE_ROLE_KEY || "").replace(/\\n/g, "").trim(),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function tierFromSlug(slug: string): "Common" | "Rare" | "Epic" | "Legendary" | "Mythic" | "God Tier" | null {
  const s = String(slug || "").trim().toLowerCase();
  if (s === "common") return "Common";
  if (s === "rare") return "Rare";
  if (s === "epic") return "Epic";
  if (s === "legendary") return "Legendary";
  if (s === "mythic") return "Mythic";
  if (s === "god_tier") return "God Tier";
  return null;
}

function tierMeets(tier: string, target: "Epic" | "Legendary" | "God Tier"): boolean {
  const order = ["Common", "Rare", "Epic", "Legendary", "Mythic", "God Tier"];
  return order.indexOf(tier) >= order.indexOf(target);
}

function epicPaidCostForOpenCount(opensToday: number): number {
  const extraOpens = Math.max(0, opensToday - 4);
  if (extraOpens <= 0) return EPIC_CRATE_BASE_COST;
  return Math.round(EPIC_CRATE_BASE_COST * (1 + (extraOpens * 0.05)));
}

function nextUtcMidnightIso() {
  const next = new Date();
  next.setUTCHours(24, 0, 0, 0);
  return next.toISOString();
}

async function getPaidOpenCountToday(sb: ReturnType<typeof getServiceClient>, userId: string, crateType: CrateType, dayKey: string) {
  const prefix = `crate_paid_open:${crateType}:${dayKey}:`;
  const { count } = await sb
    .from("user_reward_claims")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .like("reward_key", `${prefix}%`);
  return Math.max(0, Number(count || 0));
}

async function getPityStatus(sb: ReturnType<typeof getServiceClient>, userId: string, crateType: CrateType) {
  const prefix = `crate_open_v2:${crateType}:`;
  const { data } = await sb
    .from("user_reward_claims")
    .select("reward_key, created_at")
    .eq("user_id", userId)
    .like("reward_key", `${prefix}%`)
    .order("created_at", { ascending: false })
    .limit(120);

  const keys = (data || []).map((r) => String(r.reward_key || ""));
  let streakWithoutLegendary = 0;
  let streakWithoutEpic = 0;
  let streakWithoutGod = 0;
  for (const key of keys) {
    const tier = tierFromSlug(key.split(":")[4] || "");
    if (!tier) continue;
    if (!tierMeets(tier, "Legendary")) streakWithoutLegendary += 1;
    else break;
  }
  for (const key of keys) {
    const tier = tierFromSlug(key.split(":")[4] || "");
    if (!tier) continue;
    if (!tierMeets(tier, "Epic")) streakWithoutEpic += 1;
    else break;
  }
  for (const key of keys) {
    const tier = tierFromSlug(key.split(":")[4] || "");
    if (!tier) continue;
    if (!tierMeets(tier, "God Tier")) streakWithoutGod += 1;
    else break;
  }

  const legendaryPityThreshold = crateType === "epic" ? 6 : 20;
  return {
    opens: keys.length,
    streak_without_epic_plus: streakWithoutEpic,
    streak_without_legendary_plus: streakWithoutLegendary,
    streak_without_god: streakWithoutGod,
    legendary_boost_in: Math.max(0, legendaryPityThreshold - streakWithoutLegendary),
  };
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getGuestId();
    const crateType = parseCrateType(new URL(request.url).searchParams.get("crate_type"));
    const sb = getServiceClient();

    const { data: progress } = await sb.from("user_progress").select("sigils").eq("user_id", userId).maybeSingle();
    const todayKey = new Date().toISOString().slice(0, 10);
    const opensToday = crateType === "epic" || crateType === "premium"
      ? await getPaidOpenCountToday(sb, userId, crateType, todayKey)
      : 0;
    const pity = await getPityStatus(sb, userId, crateType);

    return NextResponse.json({
      ok: true,
      crate_type: crateType,
      sigils: Number(progress?.sigils || 0),
      paid_crate_cost: crateType === "epic" ? epicPaidCostForOpenCount(opensToday) : crateType === "premium" ? PAID_CRATE_COST : 0,
      opens_today: opensToday,
      daily_cap: crateType === "epic" ? EPIC_DAILY_CAP : null,
      next_reset_at: nextUtcMidnightIso(),
      pity_status: pity,
      legendary_boost_in: pity.legendary_boost_in,
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
