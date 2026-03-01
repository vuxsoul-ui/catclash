import type { SupabaseClient } from "@supabase/supabase-js";

export type CrateCatDropSource = "daily" | "paid";
export type CrateCatDropBlockedReason = "DAILY_CAP" | "PAID_CAP" | "GLOBAL_CAP";

type CrateCatDropRow = {
  source: CrateCatDropSource;
};

type AnySupabase = SupabaseClient<any, any, any>;

export function utcDayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export async function getCrateCatDropCountsForDay(
  sb: AnySupabase,
  userId: string,
  dayKey: string
): Promise<{ total: number; daily: number; paid: number }> {
  const { data } = await sb
    .from("crate_cat_drops")
    .select("source")
    .eq("user_id", userId)
    .eq("day_key", dayKey);

  const rows = (data || []) as CrateCatDropRow[];
  const daily = rows.filter((r) => r.source === "daily").length;
  const paid = rows.filter((r) => r.source === "paid").length;
  return {
    total: rows.length,
    daily,
    paid,
  };
}

export async function getCrateCatDropCapStatus(
  sb: AnySupabase,
  userId: string,
  source: CrateCatDropSource,
  now: Date = new Date()
): Promise<{
  allowed: boolean;
  reason: CrateCatDropBlockedReason | null;
  dayKey: string;
  counts: { total: number; daily: number; paid: number };
}> {
  const dayKey = utcDayKey(now);
  const counts = await getCrateCatDropCountsForDay(sb, userId, dayKey);

  if (source === "daily" && counts.daily >= 1) {
    return { allowed: false, reason: "DAILY_CAP", dayKey, counts };
  }
  if (source === "paid" && counts.paid >= 3) {
    return { allowed: false, reason: "PAID_CAP", dayKey, counts };
  }
  if (counts.total >= 3) {
    return { allowed: false, reason: "GLOBAL_CAP", dayKey, counts };
  }

  return {
    allowed: true,
    reason: null,
    dayKey,
    counts,
  };
}

export async function recordCrateCatDrop(
  sb: AnySupabase,
  input: {
    userId: string;
    source: CrateCatDropSource;
    dayKey?: string;
    catId: string;
    specialAbilityId: string | null;
  }
): Promise<void> {
  await sb.from("crate_cat_drops").insert({
    user_id: input.userId,
    source: input.source,
    day_key: input.dayKey || utcDayKey(),
    cat_id: input.catId,
    special_ability_id: input.specialAbilityId,
  });
}

