import { NextResponse } from 'next/server';
import { LAUNCH_CONFIG } from '../../_lib/launchConfig';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
  return NextResponse.json({
    ok: true,
    config: {
      enableSpikeStacking: LAUNCH_CONFIG.enableSpikeStacking,
      hotMatchBiasEnabled: LAUNCH_CONFIG.hotMatchBiasEnabled,
      spotlightRotationEnabled: LAUNCH_CONFIG.spotlightRotationEnabled,
      spotlightRotationHours: LAUNCH_CONFIG.spotlightRotationHours,
      recruitPushEnabled: LAUNCH_CONFIG.recruitPushEnabled,
      clutchSharePromptEnabled: LAUNCH_CONFIG.clutchSharePromptEnabled,
      seedMatchupAutoFill: LAUNCH_CONFIG.seedMatchupAutoFill,
      limitGuestVotesPerMinute: LAUNCH_CONFIG.limitGuestVotesPerMinute,
      limitGuestVotesPerIpPerMinute: LAUNCH_CONFIG.limitGuestVotesPerIpPerMinute,
      rateLimitSignupPerIPPerHour: LAUNCH_CONFIG.rateLimitSignupPerIPPerHour,
      qualifiedDailyCapPerInviter: LAUNCH_CONFIG.qualifiedDailyCapPerInviter,
      globalQualifiedCap: LAUNCH_CONFIG.globalQualifiedCap,
    },
  });
}
