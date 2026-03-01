import type { SupabaseClient } from "@supabase/supabase-js";

export const FEATURE_TESTER_USER_ID = "11111111-1111-4111-8111-111111111111";
export const FEATURE_TESTER_USERNAME = "qa_feature_tester";

export function isFeatureTesterId(userId: string | null | undefined): boolean {
  return String(userId || "").trim() === FEATURE_TESTER_USER_ID;
}

export async function applyFeatureTesterBoost(supabase: SupabaseClient, userId: string): Promise<void> {
  if (!isFeatureTesterId(userId)) return;
  const nowIso = new Date().toISOString();
  try {
    await supabase.rpc("bootstrap_user", { p_user_id: userId });
  } catch {}

  try {
    await supabase
      .from("user_progress")
      .upsert(
        {
          user_id: userId,
          xp: 999999,
          level: 99,
          sigils: 999999,
          whisker_tokens: 9999,
          updated_at: nowIso,
        } as any,
        { onConflict: "user_id" }
      );
  } catch {}

  try {
    await supabase
      .from("cat_xp_pools")
      .upsert(
        {
          user_id: userId,
          pending_xp: 999999,
          updated_at: nowIso,
        } as any,
        { onConflict: "user_id" }
      );
  } catch {}

  try {
    await supabase.rpc("ensure_user_prediction_stats", { p_user_id: userId });
  } catch {}
  try {
    await supabase
      .from("user_prediction_stats")
      .upsert(
        {
          user_id: userId,
          current_streak: 50,
          best_streak: 50,
          bonus_rolls: 999,
        } as any,
        { onConflict: "user_id" }
      );
  } catch {}
}
