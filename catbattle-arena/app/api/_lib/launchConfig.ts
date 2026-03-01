function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (!raw) return fallback;
  const v = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return fallback;
}

function parseIntSafe(raw: string | undefined, fallback: number): number {
  const n = Number(raw || '');
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export const LAUNCH_CONFIG = {
  enableSpikeStacking: parseBool(process.env.FEATURE_LAUNCH_SPIKE_STACKING, true),
  hotMatchBiasEnabled: parseBool(process.env.FEATURE_HOT_MATCH_BIAS, true),
  spotlightRotationEnabled: parseBool(process.env.FEATURE_SPOTLIGHT_ROTATION, true),
  spotlightRotationHours: parseIntSafe(process.env.LAUNCH_SPOTLIGHT_ROTATION_HOURS, 8),
  recruitPushEnabled: parseBool(process.env.FEATURE_RECRUIT_PUSH, true),
  clutchSharePromptEnabled: parseBool(process.env.FEATURE_CLUTCH_SHARE_PROMPT, true),
  seedMatchupAutoFill: parseBool(process.env.FEATURE_SEED_MATCHUP_AUTOFILL, true),

  limitGuestVotesPerMinute: parseIntSafe(process.env.LAUNCH_LIMIT_GUEST_VOTES_PER_MINUTE, 12),
  limitGuestVotesPerIpPerMinute: parseIntSafe(process.env.LAUNCH_LIMIT_GUEST_VOTES_PER_IP_PER_MINUTE, 60),
  rateLimitSignupPerIPPerHour: parseIntSafe(process.env.LAUNCH_RATE_LIMIT_SIGNUP_PER_IP_PER_HOUR, 20),

  qualifiedDailyCapPerInviter: parseIntSafe(process.env.LAUNCH_QUALIFIED_DAILY_CAP_PER_INVITER, 50),
  globalQualifiedCap: parseIntSafe(process.env.LAUNCH_GLOBAL_QUALIFIED_CAP, 1000),
} as const;

export function launchPulseBucket(now = new Date()): string {
  const hours = Math.max(1, LAUNCH_CONFIG.spotlightRotationHours);
  const utcHour = now.getUTCHours();
  const bucket = Math.floor(utcHour / hours);
  return `${now.toISOString().slice(0, 10)}:${bucket}`;
}
