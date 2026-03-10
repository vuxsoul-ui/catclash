import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireGuestId } from "../../_lib/guest";
import { parseCrateType, type CrateType } from "../../_lib/crate-engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DAILY_DROP_TABLE = [
  { rarity: "xp_sigils", chance: 62 },
  { rarity: "Common", chance: 20 },
  { rarity: "Rare", chance: 10 },
  { rarity: "Epic", chance: 5 },
  { rarity: "Legendary", chance: 2 },
  { rarity: "Mythic", chance: 0.8 },
  { rarity: "God-Tier", chance: 0.2 },
] as const;

const PAID_DROP_TABLE = [
  { rarity: "xp_sigils", chance: 45 },
  { rarity: "Common", chance: 24 },
  { rarity: "Rare", chance: 16 },
  { rarity: "Epic", chance: 9 },
  { rarity: "Legendary", chance: 4.5 },
  { rarity: "Mythic", chance: 1.2 },
  { rarity: "God-Tier", chance: 0.3 },
] as const;

const EPIC_DROP_TABLE = [
  { rarity: "Common", chance: 30 },
  { rarity: "Rare", chance: 28 },
  { rarity: "Epic", chance: 20 },
  { rarity: "Legendary", chance: 12 },
  { rarity: "Mythic", chance: 7 },
  { rarity: "God-Tier", chance: 3 },
] as const;

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

  return {
    opens: keys.length,
    streak_without_epic_plus: streakWithoutEpic,
    streak_without_legendary_plus: streakWithoutLegendary,
    streak_without_god: streakWithoutGod,
  };
}

function nextUtcMidnightIso() {
  const next = new Date();
  next.setUTCHours(24, 0, 0, 0);
  return next.toISOString();
}

function oddsRowsFor(crateType: CrateType) {
  const table =
    crateType === "epic" ? EPIC_DROP_TABLE :
    crateType === "premium" ? PAID_DROP_TABLE :
    DAILY_DROP_TABLE;

  return table.map((row) => {
    const rarity = String(row.rarity);
    if (rarity === "xp_sigils") {
      return { tier: "xp_sigils", label: "XP / Sigils", rate: Number(row.chance || 0) };
    }
    if (rarity === "God-Tier") {
      return { tier: "god_tier", label: "Guaranteed (G)", rate: Number(row.chance || 0) };
    }
    return {
      tier: rarity.toLowerCase(),
      label: `${rarity} Cosmetic`,
      rate: Number(row.chance || 0),
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireGuestId();
    const crateType = parseCrateType(new URL(request.url).searchParams.get("crate_type"));
    const sb = getServiceClient();
    const pity = await getPityStatus(sb, userId, crateType);
    const pityThreshold = crateType === "epic" ? 6 : 10;

    return NextResponse.json(
      {
        ok: true,
        crate_type: crateType,
        rows: oddsRowsFor(crateType),
        pity_status: pity,
        pity_threshold: pityThreshold,
        next_reset_at: nextUtcMidnightIso(),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
