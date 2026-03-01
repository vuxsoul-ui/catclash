import type { SupabaseClient } from '@supabase/supabase-js';

type TelemetryEvent =
  | 'landing_view'
  | 'guest_vote_cast'
  | 'vote_cast'
  | 'signup_started'
  | 'signup_complete'
  | 'vote_streak_hit'
  | 'prediction_placed'
  | 'pulse_recap_shown'
  | 'launch_spotlight_shown'
  | 'recruit_push_seen'
  | 'clutch_share_prompt_shown'
  | 'clutch_share_prompt_clicked'
  | 'referral_link_copied'
  | 'recruit_share_opened'
  | 'recruit_shared'
  | 'recruit_qualified'
  | 'shop_item_preview_opened'
  | 'shop_item_preview_interacted'
  | 'shop_item_purchased'
  | 'cosmetic_equipped'
  | 'cosmetic_effect_triggered'
  | 'epic_crate_opened'
  | 'epic_crate_legendary'
  | 'epic_crate_mythic'
  | 'epic_crate_god'
  | 'epic_crate_profit_margin';

export async function trackAppEvent(
  supabase: SupabaseClient,
  eventName: TelemetryEvent,
  payload: Record<string, unknown> = {},
  userId?: string | null
) {
  try {
    await supabase.from('app_telemetry').insert({
      user_id: userId || null,
      event_name: eventName,
      payload,
    });
  } catch {
    // best-effort only
  }
}
