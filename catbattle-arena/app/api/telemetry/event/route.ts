import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../_lib/guest';
import { checkRateLimitMany, getClientIp, hashValue } from '../../_lib/rateLimit';
import { trackAppEvent } from '../../_lib/telemetry';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const ALLOWED = new Set([
  'landing_view',
  'guest_vote_cast',
  'vote_cast',
  'signup_started',
  'signup_complete',
  'vote_streak_hit',
  'prediction_placed',
  'pulse_recap_shown',
  'launch_spotlight_shown',
  'recruit_push_seen',
  'clutch_share_prompt_shown',
  'clutch_share_prompt_clicked',
  'referral_link_copied',
  'recruit_share_opened',
  'recruit_shared',
  'recruit_qualified',
  'battle_receipt_shared',
  'battle_receipt_copied',
  'shop_item_preview_opened',
  'shop_item_preview_interacted',
  'shop_item_purchased',
  'cosmetic_equipped',
  'cosmetic_effect_triggered',
  'arena_fetch_start',
  'arena_fetch_empty',
  'arena_fetch_success',
]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const event = String(body?.event || '').trim();
    if (!ALLOWED.has(event)) {
      return NextResponse.json({ ok: false, error: 'Invalid event' }, { status: 400 });
    }
    const ipHash = hashValue(getClientIp(req));
    const limiter = checkRateLimitMany([
      { key: `rl:telemetry:ip:${ipHash || 'unknown'}`, limit: 240, windowMs: 60_000 },
    ]);
    if (!limiter.allowed) {
      return NextResponse.json({ ok: false, error: 'Rate limited' }, { status: 429, headers: { 'Retry-After': String(limiter.retryAfterSec) } });
    }

    const guestId = await getGuestId().catch(() => null);
    await trackAppEvent(supabase, event as any, {
      ...(body?.payload && typeof body.payload === 'object' ? body.payload : {}),
      ua: req.headers.get('user-agent') || null,
    }, guestId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
