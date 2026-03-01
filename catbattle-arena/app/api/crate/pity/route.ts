import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGuestId } from "../../_lib/guest";
import { parseCrateType } from "../../_lib/crate-engine";

export const dynamic = "force-dynamic";

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

export async function GET(request: NextRequest) {
  try {
    const userId = await getGuestId();
    const crateType = parseCrateType(new URL(request.url).searchParams.get("crate_type"));
    const sb = createClient(
      (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\\n/g, "").replace(/\s/g, "").trim(),
      (process.env.SUPABASE_SERVICE_ROLE_KEY || "").replace(/\\n/g, "").trim(),
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

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
    return NextResponse.json({
      ok: true,
      crate_type: crateType,
      opens: keys.length,
      streak_without_epic_plus: streakWithoutEpic,
      streak_without_legendary_plus: streakWithoutLegendary,
      streak_without_god: streakWithoutGod,
      legendary_boost_in: Math.max(0, legendaryPityThreshold - streakWithoutLegendary),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

