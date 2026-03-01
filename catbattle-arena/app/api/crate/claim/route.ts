import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { requireGuestId } from "../../_lib/guest";
import { grantPendingCatXp } from "../../_lib/cat-progression";
import { checkRateLimitMany, getClientIp, hashValue } from "../../_lib/rateLimit";
import {
  applySoftPity,
  CRATE_CONFIGS,
  parseCrateType,
  pickNearMiss,
  weightedTierRoll,
  type CrateType,
  type RarityTier,
} from "../../_lib/crate-engine";
import { pickRandomCatUsername } from "../../_lib/cat-usernames";
import { validateCatName } from "../../_lib/name-filter";
import { trackAppEvent } from "../../_lib/telemetry";
import {
  getCrateCatDropCapStatus,
  recordCrateCatDrop,
  type CrateCatDropBlockedReason,
} from "../../_lib/crateCatCaps";
import { uploadCatImageDerivatives } from "../../_lib/cat-image-storage";

export const dynamic = "force-dynamic";

const sb = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\\n/g, "").replace(/\s/g, "").trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "").replace(/\\n/g, "").trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

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

const PAID_CRATE_COST = 90;
const EPIC_CRATE_BASE_COST = 280;
const EPIC_DAILY_CAP = 8;

type AbilityTier = "common" | "rare" | "legendary";
type CatAbility = {
  id: string;
  name: string;
  description: string;
};

const CAT_ABILITY_POOL: Record<AbilityTier, CatAbility[]> = {
  common: [
    { id: "steady-crowd", name: "Steady Crowd", description: "+2% vote confidence in close rounds." },
    { id: "pocket-luck", name: "Pocket Luck", description: "Small sigil drip after a completed match." },
    { id: "quick-pose", name: "Quick Pose", description: "Slight speed edge in clutch tie logic." },
  ],
  rare: [
    { id: "chaos-jam", name: "Chaos Jam", description: "5% chance to dampen opponent chaos swings." },
    { id: "underdog-fuel", name: "Underdog Fuel", description: "Bonus XP when voted as underdog winner." },
    { id: "tempo-steal", name: "Tempo Steal", description: "Small chance to reduce rival momentum." },
  ],
  legendary: [
    { id: "sigil-rip", name: "Sigil Rip", description: "10% chance to trigger bonus sigils on win." },
    { id: "chaos-shield", name: "Chaos Shield", description: "Ignores one micro-chaos event per pulse." },
    { id: "final-roar", name: "Final Roar", description: "Extra clutch impact when matches are razor-close." },
  ],
};

type PityStatus = {
  opens: number;
  streak_without_epic_plus: number;
  streak_without_legendary_plus: number;
  streak_without_god: number;
};

function toTitleCaseName(raw: string): string {
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .slice(0, 24);
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function mapRarityToAbilityTier(rarity: string): AbilityTier {
  const r = String(rarity || "").toLowerCase();
  if (r === "legendary" || r === "mythic" || r === "god-tier" || r === "god tier") return "legendary";
  if (r === "rare" || r === "epic") return "rare";
  return "common";
}

function shouldDropCatForRarity(rarity: string): boolean {
  const chances: Record<string, number> = {
    Common: 0.05,
    Rare: 0.12,
    Epic: 0.2,
    Legendary: 0.35,
    Mythic: 0.5,
    "God-Tier": 0.75,
    "God Tier": 0.75,
  };
  const chance = chances[String(rarity || "")] ?? 0;
  return Math.random() < chance;
}

function abilityForRarity(rarity: string): CatAbility {
  const tier = mapRarityToAbilityTier(rarity);
  return randomFrom(CAT_ABILITY_POOL[tier]);
}

function statRangeForRarity(rarity: string): [number, number] {
  const r = String(rarity || "");
  if (r === "God-Tier" || r === "God Tier") return [88, 99];
  if (r === "Mythic") return [78, 96];
  if (r === "Legendary") return [68, 92];
  if (r === "Epic") return [55, 82];
  if (r === "Rare") return [45, 70];
  return [30, 55];
}

function roll(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function guildAffinity(): "sun" | "moon" {
  return Math.random() < 0.5 ? "sun" : "moon";
}

async function fetchCatApiImageUrl(seed: string): Promise<string | null> {
  const apiKey = String(process.env.CAT_API_KEY || process.env.THECATAPI_API_KEY || "").trim();
  const endpoint = `https://api.thecatapi.com/v1/images/search?limit=1&mime_types=jpg,png,webp&size=med${apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : ""}`;
  try {
    const res = await fetch(endpoint, {
      cache: "no-store",
      headers: apiKey ? { "x-api-key": apiKey } : undefined,
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      const url = Array.isArray(data) ? String(data[0]?.url || "").trim() : "";
      if (/^https?:\/\//i.test(url)) return url;
    }
  } catch {
    // continue fallback
  }
  const fallback = [
    "https://cdn2.thecatapi.com/images/MTY3ODIyMQ.jpg",
    "https://cdn2.thecatapi.com/images/bpc.jpg",
    "https://cdn2.thecatapi.com/images/9j5.jpg",
  ];
  const idx = Math.abs((seed.length * 2654435761) % fallback.length);
  return fallback[idx];
}

async function ingestCrateImage(seed: string, catId: string): Promise<{
  imagePath: string;
  imageUrlOriginal: string;
  imageUrlCard: string;
  imageUrlThumb: string;
}> {
  const sourceUrl = (await fetchCatApiImageUrl(seed)) || "/cat-placeholder.svg";
  if (!/^https?:\/\//i.test(sourceUrl)) {
    return {
      imagePath: sourceUrl,
      imageUrlOriginal: sourceUrl,
      imageUrlCard: sourceUrl,
      imageUrlThumb: sourceUrl,
    };
  }
  try {
    const res = await fetch(sourceUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`crate_image_fetch_failed_${res.status}`);
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buf = new Uint8Array(await res.arrayBuffer());
    if (!contentType.startsWith("image/") || buf.byteLength < 1024) throw new Error("crate_image_invalid_source");
    const imageSet = await uploadCatImageDerivatives({
      supabase: sb,
      catId,
      source: buf,
      contentType,
      originalCacheControl: "public, max-age=604800",
    });
    return {
      imagePath: imageSet.original.path,
      imageUrlOriginal: imageSet.original.url,
      imageUrlCard: imageSet.card.url,
      imageUrlThumb: imageSet.thumb.url,
    };
  } catch {
    return {
      imagePath: sourceUrl,
      imageUrlOriginal: sourceUrl,
      imageUrlCard: sourceUrl,
      imageUrlThumb: sourceUrl,
    };
  }
}

async function maybeAttachCatDrop(
  guestId: string,
  payload: Record<string, unknown>,
  source: "daily" | "paid"
): Promise<Record<string, unknown>> {
  const rarity = String(payload.rarity || "Common");
  if (rarity === "xp_sigils" || rarity === "duplicate") return payload;
  if (!shouldDropCatForRarity(rarity)) return payload;

  const capStatus = await getCrateCatDropCapStatus(sb, guestId, source, new Date());
  if (!capStatus.allowed) {
    return {
      ...payload,
      cat_drop: null,
      cat_drop_blocked_reason: capStatus.reason as CrateCatDropBlockedReason,
    };
  }

  const [min, max] = statRangeForRarity(rarity);
  const seed = `${guestId}:${Date.now()}:${source}:${rarity}`;
  const catId = randomUUID();
  const rawName = pickRandomCatUsername(seed);
  const styled = toTitleCaseName(rawName);
  const validated = validateCatName(styled);
  const name = validated.ok ? validated.value : `Arena ${roll(1000, 9999)}`;
  const ability = abilityForRarity(rarity);
  const imageAsset = await ingestCrateImage(seed, catId);
  const guild = guildAffinity();
  const atk = roll(min, max);
  const def = roll(min, max);
  const spd = roll(min, max);
  const cha = roll(min, max);
  const chs = roll(min, max);

  const { data: dupAbility } = await sb
    .from("cats")
    .select("id")
    .eq("user_id", guestId)
    .eq("special_ability_id", ability.id)
    .limit(1)
    .maybeSingle();

  if (dupAbility?.id) {
    const { data: predStats } = await sb
      .from("user_prediction_stats")
      .select("bonus_rolls")
      .eq("user_id", guestId)
      .maybeSingle();
    const nextBonusRolls = Math.max(0, Number(predStats?.bonus_rolls || 0)) + 1;
    await sb.from("user_prediction_stats").update({ bonus_rolls: nextBonusRolls }).eq("user_id", guestId);
    return {
      ...payload,
      cat_drop: null,
      cat_drop_converted: true,
      duplicate_special_ability_id: ability.id,
      cat_drop_conversion_reward: {
        type: "bonus_roll",
        amount: 1,
      },
    };
  }

  const insertPayload: Record<string, unknown> = {
    id: catId,
    user_id: guestId,
    name,
    image_path: imageAsset.imagePath,
    image_url_original: imageAsset.imageUrlOriginal,
    image_url_card: imageAsset.imageUrlCard,
    image_url_thumb: imageAsset.imageUrlThumb,
    rarity,
    attack: atk,
    defense: def,
    speed: spd,
    charisma: cha,
    chaos: chs,
    ability: ability.name,
    special_ability_id: ability.id,
    power: ability.name,
    evolution: "Crate Recruit",
    description: ability.description,
    status: "approved",
    image_review_status: "approved",
    image_review_reason: "crate_drop_source",
    image_reviewed_at: new Date().toISOString(),
    xp: 0,
    level: 1,
    cat_level: 1,
    wins: 0,
    losses: 0,
    battles_fought: 0,
    origin: "crate",
    prestige_weight: 1.0,
  };
  const insert = await sb
    .from("cats")
    .insert(insertPayload)
    .select("id")
    .single();

  let inserted = insert.data;
  if (insert.error || !insert.data?.id) {
    if (String(insert.error?.message || "").toLowerCase().includes("column")) {
      const legacy = await sb
        .from("cats")
        .insert({
          ...insertPayload,
          image_url_original: undefined,
          image_url_card: undefined,
          image_url_thumb: undefined,
        })
        .select("id")
        .single();
      if (legacy.error || !legacy.data?.id) return payload;
      inserted = legacy.data;
    } else {
      return payload;
    }
  }
  if (!inserted?.id) return payload;

  try {
    await recordCrateCatDrop(sb, {
      userId: guestId,
      source,
      dayKey: capStatus.dayKey,
      catId: inserted.id,
      specialAbilityId: ability.id,
    });
  } catch {
    // Keep crate reward path resilient if logging fails.
  }

  return {
      ...payload,
      cat_drop: {
      id: inserted.id,
      name,
      image_url: imageAsset.imageUrlThumb,
      image_url_card: imageAsset.imageUrlCard,
      image_url_original: imageAsset.imageUrlOriginal,
      rarity,
      guild_affinity: guild,
      stats: { power: atk + def + spd + cha + chs, speed: spd, chaos: chs },
      special_ability_id: ability.id,
      special_ability_name: ability.name,
      special_ability_description: ability.description,
      is_new: true,
    },
  };
}

function weightedRarityRoll(table: ReadonlyArray<{ rarity: string; chance: number }>): string {
  const roll = Math.random() * 100;
  let acc = 0;
  for (const entry of table) {
    acc += entry.chance;
    if (roll <= acc) return entry.rarity;
  }
  return "Common";
}

function toTierSlug(tier: RarityTier): string {
  return tier.toLowerCase().replace(/\s+/g, "_");
}

function tierFromSlug(slug: string): RarityTier | null {
  const s = String(slug || "").trim().toLowerCase();
  if (s === "common") return "Common";
  if (s === "rare") return "Rare";
  if (s === "epic") return "Epic";
  if (s === "legendary") return "Legendary";
  if (s === "mythic") return "Mythic";
  if (s === "god_tier") return "God Tier";
  return null;
}

function tierMeets(tier: RarityTier, target: RarityTier): boolean {
  const order: RarityTier[] = ["Common", "Rare", "Epic", "Legendary", "Mythic", "God Tier"];
  return order.indexOf(tier) >= order.indexOf(target);
}

async function getPityStatus(userId: string, crateType: CrateType): Promise<PityStatus> {
  const prefix = `crate_open_v2:${crateType}:`;
  const { data } = await sb
    .from("user_reward_claims")
    .select("reward_key, created_at")
    .eq("user_id", userId)
    .like("reward_key", `${prefix}%`)
    .order("created_at", { ascending: false })
    .limit(120);

  const keys = (data || []).map((r) => String(r.reward_key || ""));
  let withoutEpic = 0;
  let withoutLegendary = 0;
  let withoutGod = 0;

  for (const key of keys) {
    const tierSlug = key.split(":")[4] || "";
    const tier = tierFromSlug(tierSlug);
    if (!tier) continue;

    if (!tierMeets(tier, "Epic")) withoutEpic += 1;
    else if (withoutEpic >= 0) {
      // Stop counting at the latest matching hit.
      break;
    }
  }

  for (const key of keys) {
    const tierSlug = key.split(":")[4] || "";
    const tier = tierFromSlug(tierSlug);
    if (!tier) continue;

    if (!tierMeets(tier, "Legendary")) withoutLegendary += 1;
    else break;
  }

  for (const key of keys) {
    const tierSlug = key.split(":")[4] || "";
    const tier = tierFromSlug(tierSlug);
    if (!tier) continue;

    if (!tierMeets(tier, "God Tier")) withoutGod += 1;
    else break;
  }

  return {
    opens: keys.length,
    streak_without_epic_plus: withoutEpic,
    streak_without_legendary_plus: withoutLegendary,
    streak_without_god: withoutGod,
  };
}

async function recordCrateOpen(userId: string, crateType: CrateType, tier: RarityTier) {
  const key = `crate_open_v2:${crateType}:${Date.now()}:${toTierSlug(tier)}`;
  await sb
    .from("user_reward_claims")
    .insert({ user_id: userId, reward_key: key, reward_sigils: 0 });
}

async function grantCosmeticRollIfEligible(
  guestId: string,
  payload: Record<string, unknown>,
  table: ReadonlyArray<{ rarity: string; chance: number }>,
  options?: {
    minRarity?: "Common" | "Rare" | "Epic" | "Legendary" | "Mythic" | "God-Tier";
    duplicateSigils?: number;
    duplicateXp?: number;
  }
) {
  const minRarity = options?.minRarity || "Common";
  const duplicateSigils = Number(options?.duplicateSigils ?? 20);
  const duplicateXp = Number(options?.duplicateXp ?? 25);
  const hasCosmetic = !!payload.cosmetic;
  const rarity = weightedRarityRoll(table);
  if (hasCosmetic) return payload;

  const rarityOrder: Record<string, number> = {
    Common: 1,
    Rare: 2,
    Epic: 3,
    Legendary: 4,
    Mythic: 5,
    "God-Tier": 6,
    "God Tier": 6,
  };
  const minRank = rarityOrder[minRarity] || 1;
  const selectedRank = rarityOrder[rarity] || 1;
  const targetRarity = selectedRank >= minRank ? rarity : minRarity;

  const { data: ownedRows } = await sb
    .from("user_inventory")
    .select("cosmetic_id")
    .eq("user_id", guestId);
  const ownedIds = new Set((ownedRows || []).map((r) => r.cosmetic_id));

  const { data: cosmetics } = await sb
    .from("cosmetics")
    .select("id, slug, name, category, rarity, description")
    .eq("rarity", targetRarity)
    .in("category", [
      "cat_title", "cat_border", "cat_color", "vote_effect",
      "title", "border", "color", "voter_badge", "effect",
    ]);

  const sorted = (cosmetics || []).sort(() => Math.random() - 0.5);
  const unowned = sorted.find((c) => !ownedIds.has(c.id)) || null;
  const selected = unowned || sorted[0] || null;
  if (!selected) return payload;

  const { error: invErr } = await sb
    .from("user_inventory")
    .insert({ user_id: guestId, cosmetic_id: selected.id, source: "crate" });

  if (!invErr) {
    return {
      ...payload,
      rarity,
      reward_type: "cosmetic",
      cosmetic: {
        id: selected.id,
        name: selected.name,
        slug: selected.slug,
        category: selected.category,
        rarity: selected.rarity,
        description: selected.description || "",
      },
    };
  }

  if (!String(invErr.message || "").toLowerCase().includes("duplicate")) {
    return payload;
  }

  const { data: progress } = await sb
    .from("user_progress")
    .select("xp, sigils")
    .eq("user_id", guestId)
    .maybeSingle();

  const nextXp = (progress?.xp || 0) + duplicateXp;
  const nextSigils = (progress?.sigils || 0) + Math.max(0, duplicateSigils);
  await sb.from("user_progress").update({ xp: nextXp, sigils: nextSigils }).eq("user_id", guestId);
  await sb.rpc("check_level_up", { p_user_id: guestId });

  return {
    ...payload,
    rarity: "duplicate",
    reward_type: "duplicate_bonus",
    xp_gained: Number(payload.xp_gained || 0) + duplicateXp,
    sigils_gained: Number(payload.sigils_gained || 0) + Math.max(0, duplicateSigils),
  };
}

async function applySecondaryReward(
  guestId: string,
  payload: Record<string, unknown>,
  crateType: CrateType,
  tier: RarityTier,
  shouldApply: boolean
): Promise<Record<string, unknown>> {
  if (!shouldApply) return payload;

  const bonusByTier: Record<RarityTier, { xp: number; sigils: number }> = {
    "Common": { xp: 6, sigils: 4 },
    "Rare": { xp: 10, sigils: 7 },
    "Epic": { xp: 14, sigils: 12 },
    "Legendary": { xp: 18, sigils: 20 },
    "Mythic": { xp: 24, sigils: 32 },
    "God Tier": { xp: 35, sigils: 50 },
  };

  const bonus = bonusByTier[tier] || bonusByTier.Common;
  const safeBonus = crateType === "epic" ? { ...bonus, sigils: 0 } : bonus;
  const { data: progress } = await sb
    .from("user_progress")
    .select("xp, sigils")
    .eq("user_id", guestId)
    .maybeSingle();
  await sb
    .from("user_progress")
    .update({
      xp: Number(progress?.xp || 0) + safeBonus.xp,
      sigils: Number(progress?.sigils || 0) + safeBonus.sigils,
    })
    .eq("user_id", guestId);
  await sb.rpc("check_level_up", { p_user_id: guestId });

  return {
    ...payload,
    xp_gained: Number(payload.xp_gained || 0) + safeBonus.xp,
    sigils_gained: Number(payload.sigils_gained || 0) + safeBonus.sigils,
    secondary_reward: {
      type: "bonus_bundle",
      source: `${crateType}_secondary`,
      xp: safeBonus.xp,
      sigils: safeBonus.sigils,
    },
  };
}

async function attachCatXpPool(guestId: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const xpGain = Math.max(0, Number(payload.xp_gained || 0));
  if (!xpGain) return payload;
  const banked = await grantPendingCatXp(sb, guestId, xpGain);
  return { ...payload, cat_xp_banked: banked };
}

async function ensureEpicValueFloor(guestId: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (payload.cosmetic || payload.cat_drop) return payload;
  const { data: rareCosmetics } = await sb
    .from("cosmetics")
    .select("id, slug, name, category, rarity, description")
    .in("rarity", ["Rare", "Epic", "Legendary", "Mythic", "God-Tier"])
    .in("category", ["cat_title", "cat_border", "cat_color", "vote_effect", "title", "border", "color", "voter_badge", "effect"])
    .limit(20);

  const pick = (rareCosmetics || [])[0];
  if (pick?.id) {
    await sb
      .from("user_inventory")
      .insert({ user_id: guestId, cosmetic_id: pick.id, source: "crate" });

    return {
      ...payload,
      rarity: pick.rarity || "Rare",
      reward_type: "cosmetic",
      cosmetic: {
        id: pick.id,
        name: pick.name,
        slug: pick.slug,
        category: pick.category,
        rarity: pick.rarity,
        description: pick.description || "",
      },
      xp_gained: Number(payload.xp_gained || 0) + 30,
      value_floor_applied: true,
    };
  }

  return {
    ...payload,
    rarity: "Rare",
    reward_type: "xp_bundle",
    xp_gained: Number(payload.xp_gained || 0) + 90,
    value_floor_applied: true,
  };
}

async function getPaidOpenCountToday(userId: string, crateType: CrateType, dayKey: string): Promise<number> {
  const prefix = `crate_paid_open:${crateType}:${dayKey}:`;
  const { count } = await sb
    .from("user_reward_claims")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .like("reward_key", `${prefix}%`);
  return Math.max(0, Number(count || 0));
}

async function recordPaidOpen(userId: string, crateType: CrateType, dayKey: string) {
  await sb.from("user_reward_claims").insert({
    user_id: userId,
    reward_key: `crate_paid_open:${crateType}:${dayKey}:${Date.now()}`,
    reward_sigils: 0,
  });
}

function epicPaidCostForOpenCount(opensToday: number): number {
  const extraOpens = Math.max(0, opensToday - 4);
  if (extraOpens <= 0) return EPIC_CRATE_BASE_COST;
  return Math.round(EPIC_CRATE_BASE_COST * (1 + (extraOpens * 0.05)));
}

function buildCrateMeta(
  crateType: CrateType,
  tier: RarityTier,
  nearMissTier: RarityTier,
  pity: PityStatus,
  adjusted: Array<{ tier: RarityTier; weight: number }>,
  secondaryApplied: boolean
) {
  const config = CRATE_CONFIGS[crateType];
  return {
    crate_type: crateType,
    crate_label: config.label,
    crate_theme: config.theme,
    rarity_tier: tier,
    near_miss_tier: nearMissTier,
    secondary_reward_applied: secondaryApplied,
    base_probabilities: config.tiers,
    effective_probabilities: adjusted,
    pity_status: pity,
  };
}

async function openDailyCrate(guestId: string, bonusRolls: number) {
  let usedBonusRoll = false;
  let remainingBonusRolls = bonusRolls;

  const { data, error } = await sb.rpc("open_crate", {
    p_user_id: guestId,
    p_crate_type: "daily",
  });

  const payload = Array.isArray(data) ? data[0] : data;
  const openSucceeded =
    !!payload &&
    (payload.ok === true ||
      payload.success === true ||
      (payload.error == null &&
        (payload.rarity != null ||
          payload.reward_type != null ||
          payload.cosmetic != null ||
          payload.xp_gained != null ||
          payload.sigils_gained != null)));

  if (!error && openSucceeded) {
    return {
      ok: true,
      payload: {
        success: true,
        ok: true,
        rarity: payload.rarity || "Common",
        reward_type: payload.reward_type || "cosmetic",
        xp_gained: payload.xp_gained || 0,
        sigils_gained: payload.sigils_gained || 0,
        cosmetic: payload.cosmetic || null,
        drop_table: DAILY_DROP_TABLE,
        used_bonus_roll: usedBonusRoll,
        remaining_bonus_rolls: remainingBonusRolls,
      } as Record<string, unknown>,
      usedBonusRoll,
      remainingBonusRolls,
    };
  }

  const { data: fallbackData, error: fallbackErr } = await sb.rpc("claim_daily_crate", {
    p_user_id: guestId,
  });
  const fallbackPayload = Array.isArray(fallbackData) ? fallbackData[0] : fallbackData;
  const fallbackSucceeded =
    !!fallbackPayload &&
    (fallbackPayload.success === true || fallbackPayload.ok === true || fallbackPayload.xp_awarded != null);

  if (fallbackErr) {
    const details = error ? `open_crate: ${error.message}; claim_daily_crate: ${fallbackErr.message}` : fallbackErr.message;
    return { ok: false, status: 500, error: details };
  }

  if (!fallbackSucceeded) {
    if ((fallbackPayload?.error === "already_claimed" || String(fallbackPayload?.error || "").includes("already")) && remainingBonusRolls > 0) {
      usedBonusRoll = true;
      remainingBonusRolls = Math.max(0, remainingBonusRolls - 1);
      await sb.from("user_prediction_stats").update({ bonus_rolls: remainingBonusRolls }).eq("user_id", guestId);

      const { data: progress } = await sb
        .from("user_progress")
        .select("xp, sigils")
        .eq("user_id", guestId)
        .maybeSingle();

      const extraXp = 30;
      const extraSigils = 15;
      await sb
        .from("user_progress")
        .update({ xp: (progress?.xp || 0) + extraXp, sigils: (progress?.sigils || 0) + extraSigils })
        .eq("user_id", guestId);
      await sb.rpc("check_level_up", { p_user_id: guestId });

      return {
        ok: true,
        payload: {
          success: true,
          ok: true,
          rarity: "xp_sigils",
          reward_type: "bonus_roll",
          xp_gained: extraXp,
          sigils_gained: extraSigils,
          cosmetic: null,
          drop_table: DAILY_DROP_TABLE,
          used_bonus_roll: true,
          remaining_bonus_rolls: remainingBonusRolls,
        } as Record<string, unknown>,
        usedBonusRoll,
        remainingBonusRolls,
      };
    }

    const mapped = fallbackPayload?.error === "already_claimed" ? "Already opened today" : fallbackPayload?.error || "Failed";
    return { ok: false, status: 400, error: mapped, remainingBonusRolls };
  }

  return {
    ok: true,
    payload: {
      success: true,
      ok: true,
      rarity: "xp_sigils",
      reward_type: "xp_only",
      xp_gained: fallbackPayload.xp_awarded || 0,
      sigils_gained: 0,
      used_bonus_roll: false,
      remaining_bonus_rolls: remainingBonusRolls,
      drop_table: DAILY_DROP_TABLE,
    } as Record<string, unknown>,
    usedBonusRoll,
    remainingBonusRolls,
  };
}

export async function POST(request: NextRequest) {
  try {
    let guestId = "";
    try {
      guestId = await requireGuestId();
    } catch {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const ipHash = hashValue(getClientIp(request));
    const limitResult = checkRateLimitMany([
      { key: `rl:crate:user:${guestId}`, limit: 20, windowMs: 60_000 },
      { key: `rl:crate:ip:${ipHash || "unknown"}`, limit: 80, windowMs: 60_000 },
    ]);
    if (!limitResult.allowed) {
      return NextResponse.json(
        { ok: false, error: "Rate limit exceeded. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(limitResult.retryAfterSec) } }
      );
    }
    const body = await request.json().catch(() => ({} as Record<string, unknown>));

    const crateType = parseCrateType((body as { crate_type?: unknown })?.crate_type);
    const modeRaw = String((body as { mode?: string })?.mode || "").toLowerCase();
    const mode = modeRaw === "paid" || modeRaw === "epic" || crateType === "premium" || crateType === "epic" ? "paid" : "daily";

    await sb.rpc("bootstrap_user", { p_user_id: guestId });
    await sb.rpc("ensure_user_prediction_stats", { p_user_id: guestId });

    const pity = await getPityStatus(guestId, crateType);
    const config = CRATE_CONFIGS[crateType];
    const adjusted = applySoftPity(
      config,
      pity.streak_without_epic_plus,
      pity.streak_without_legendary_plus,
      pity.streak_without_god
    );
    const rolledTier = weightedTierRoll(adjusted);
    const nearMissTier = pickNearMiss(rolledTier);
    const secondaryApplied = Math.random() < config.secondaryRewardChance;

    if (mode === "paid") {
      const { data: progress } = await sb.from("user_progress").select("xp, sigils").eq("user_id", guestId).maybeSingle();
      const currentSigils = Number(progress?.sigils || 0);
      const todayKey = new Date().toISOString().slice(0, 10);
      const paidOpensToday = await getPaidOpenCountToday(guestId, crateType, todayKey);
      const paidCost = crateType === "epic" ? epicPaidCostForOpenCount(paidOpensToday) : PAID_CRATE_COST;

      if (crateType === "epic" && paidOpensToday >= EPIC_DAILY_CAP) {
        return NextResponse.json(
          {
            ok: false,
            error: `Epic crate daily cap reached (${EPIC_DAILY_CAP}/day).`,
            paid_crate_cost: paidCost,
            daily_cap: EPIC_DAILY_CAP,
            opens_today: paidOpensToday,
            ...buildCrateMeta(crateType, rolledTier, nearMissTier, pity, adjusted, false),
          },
          { status: 400 }
        );
      }

      if (currentSigils < paidCost) {
        return NextResponse.json(
          {
            ok: false,
            error: `Need ${paidCost} sigils for a paid crate.`,
            paid_crate_cost: paidCost,
            ...buildCrateMeta(crateType, rolledTier, nearMissTier, pity, adjusted, false),
          },
          { status: 400 }
        );
      }

      const nextSigils = currentSigils - paidCost;
      const { error: deductErr } = await sb.from("user_progress").update({ sigils: nextSigils }).eq("user_id", guestId);
      if (deductErr) return NextResponse.json({ ok: false, error: deductErr.message }, { status: 500 });

      let paidPayload: Record<string, unknown> = {
        ok: true,
        success: true,
        rarity: crateType === "epic" ? "Rare" : "xp_sigils",
        reward_type: "paid_crate",
        xp_gained: crateType === "epic" ? 70 : 35,
        sigils_gained: 0,
        cosmetic: null,
        paid_crate_cost: paidCost,
        sigils_after: nextSigils,
        drop_table: crateType === "epic" ? EPIC_DROP_TABLE : PAID_DROP_TABLE,
        high_voltage_odds: crateType === "epic",
        opens_today: paidOpensToday,
        daily_cap: crateType === "epic" ? EPIC_DAILY_CAP : null,
      };

      paidPayload = await grantCosmeticRollIfEligible(
        guestId,
        paidPayload,
        crateType === "epic" ? EPIC_DROP_TABLE : PAID_DROP_TABLE,
        crateType === "epic"
          ? { minRarity: "Rare", duplicateSigils: 0, duplicateXp: 40 }
          : undefined
      );
      paidPayload = await applySecondaryReward(
        guestId,
        paidPayload,
        crateType,
        rolledTier,
        crateType === "epic" ? Math.random() < 0.14 : secondaryApplied
      );
      paidPayload = await maybeAttachCatDrop(guestId, paidPayload, "paid");
      if (crateType === "epic") {
        paidPayload = await ensureEpicValueFloor(guestId, paidPayload);
      }
      paidPayload = await attachCatXpPool(guestId, paidPayload);
      await recordCrateOpen(guestId, crateType, rolledTier);
      await recordPaidOpen(guestId, crateType, todayKey);

      if (crateType === "epic") {
        await trackAppEvent(sb, "epic_crate_opened", {
          tier: String(rolledTier),
          cost: paidCost,
          opens_today: paidOpensToday + 1,
          margin: paidCost - Number(paidPayload.sigils_gained || 0),
        }, guestId);
        if (rolledTier === "Legendary") await trackAppEvent(sb, "epic_crate_legendary", { cost: paidCost }, guestId);
        if (rolledTier === "Mythic") await trackAppEvent(sb, "epic_crate_mythic", { cost: paidCost }, guestId);
        if (rolledTier === "God Tier") await trackAppEvent(sb, "epic_crate_god", { cost: paidCost }, guestId);
        await trackAppEvent(sb, "epic_crate_profit_margin", {
          cost: paidCost,
          sigils_out: Number(paidPayload.sigils_gained || 0),
          margin: paidCost - Number(paidPayload.sigils_gained || 0),
        }, guestId);
      }

      return NextResponse.json({
        ...paidPayload,
        ...buildCrateMeta(crateType, rolledTier, nearMissTier, pity, adjusted, secondaryApplied),
      });
    }

    const { data: predStats } = await sb
      .from("user_prediction_stats")
      .select("bonus_rolls")
      .eq("user_id", guestId)
      .maybeSingle();
    const bonusRolls = predStats?.bonus_rolls || 0;

    const daily = await openDailyCrate(guestId, bonusRolls);
    if (!daily.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: daily.error || "Failed",
          remaining_bonus_rolls: daily.remainingBonusRolls,
          ...buildCrateMeta(crateType, rolledTier, nearMissTier, pity, adjusted, false),
        },
        { status: daily.status || 400 }
      );
    }

    let payload = daily.payload as Record<string, unknown>;
    payload = await grantCosmeticRollIfEligible(guestId, payload, DAILY_DROP_TABLE);
    payload = await applySecondaryReward(guestId, payload, crateType, rolledTier, secondaryApplied);
    payload = await maybeAttachCatDrop(guestId, payload, "daily");
    payload = await attachCatXpPool(guestId, payload);
    await recordCrateOpen(guestId, crateType, rolledTier);

    return NextResponse.json({
      ...payload,
      ...buildCrateMeta(crateType, rolledTier, nearMissTier, pity, adjusted, secondaryApplied),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
