export function isFeatureEnabled(name: string): boolean {
  const raw = process.env[name];
  if (!raw) return false;
  const v = String(raw).trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

export const FEATURES = {
  SOCIAL_LOOP_V2: isFeatureEnabled('FEATURE_SOCIAL_LOOP_V2'),
  DAILY_BOSS_V2: isFeatureEnabled('FEATURE_DAILY_BOSS_V2'),
  CROSS_MODE_V2: isFeatureEnabled('FEATURE_CROSS_MODE_V2'),
  SPOTLIGHTS_V2: isFeatureEnabled('FEATURE_SPOTLIGHTS_V2'),
};

