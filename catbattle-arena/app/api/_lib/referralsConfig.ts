import type { SupabaseClient } from '@supabase/supabase-js';
import { LAUNCH_CONFIG } from './launchConfig';

export const REFERRAL_CONFIG = {
  inviteeRewardSigils: 100,
  inviterRewardSigilsOnQualified: 100,
  enableInviterRewardOnQualified: true,
  qualifiedWindowHours: 72,
  qualifiedDailyCapPerInviter: Number(LAUNCH_CONFIG.qualifiedDailyCapPerInviter),
  qualifiedDailyCapTotalDefault: Number(LAUNCH_CONFIG.globalQualifiedCap),
  ipSignupThrottlePerInviterPer24h: 5,
  enableReferralSigilExtras: false,
} as const;

export async function getQualifiedDailyCapTotal(
  supabase: SupabaseClient
): Promise<number> {
  const fallback = Number(REFERRAL_CONFIG.qualifiedDailyCapTotalDefault);
  const envOverride = Number(process.env.REFERRAL_QUALIFIED_DAILY_CAP_TOTAL || 0);
  const base = Number.isFinite(envOverride) && envOverride > 0 ? envOverride : fallback;
  try {
    const { data } = await supabase
      .from('rate_limits')
      .select('count')
      .eq('key', 'cfg:referral:qualified_daily_cap_total')
      .maybeSingle();
    const dbCap = Number(data?.count || 0);
    if (Number.isFinite(dbCap) && dbCap > 0) return dbCap;
  } catch {
    // fallback to base
  }
  return base;
}
