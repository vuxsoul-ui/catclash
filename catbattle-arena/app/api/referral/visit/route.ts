import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../_lib/guest';
import { getClientIp, hashValue } from '../../_lib/rateLimit';
import { logReferralEvent } from '../../_lib/referrals';
import { REFERRAL_CONFIG } from '../../_lib/referralsConfig';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim();

const VALID_GUILDS = new Set(['sun', 'moon']);

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function POST(request: NextRequest) {
  try {
    const guestId = await getGuestId();
    const body = await request.json().catch(() => ({}));
    const ref = String(body?.ref || '').trim();
    const pitch = String(body?.pitch || '').trim().slice(0, 48) || null;
    const campaignTag = String(body?.campaign_tag || '').trim().slice(0, 64) || null;
    const referralCode = String(body?.referral_code || '').trim().slice(0, 64) || null;
    const guild = String(body?.guild || '').trim().toLowerCase();
    const guildAtJoin = VALID_GUILDS.has(guild) ? guild : null;
    const ipHash = hashValue(getClientIp(request));

    if (!isUuid(ref)) return NextResponse.json({ ok: false, error: 'Invalid ref code' }, { status: 400 });
    if (ref === guestId) return NextResponse.json({ ok: false, error: 'Cannot refer yourself' }, { status: 400 });

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    await supabase.rpc('bootstrap_user', { p_user_id: guestId });
    await supabase.rpc('bootstrap_user', { p_user_id: ref });

    const visitorKey = `ref_seen:${guestId}`;
    const ipKey = `ref_ip:${ipHash || 'unknown'}:${new Date().toISOString().slice(0, 10)}`;
    const { data: existing } = await supabase.from('rate_limits').select('key').eq('key', visitorKey).maybeSingle();
    if (existing?.key) {
      await logReferralEvent(supabase, guestId, 'referral_reward_blocked', { reason: 'visit_dedupe' });
      return NextResponse.json({ ok: true, already_tracked: true });
    }

    const inviterCountKey = `ref_count:${ref}`;
    const nowIso = new Date().toISOString();
    await supabase.from('rate_limits').insert({ key: visitorKey, count: 1, window_start: nowIso });
    const { data: ipRow } = await supabase.from('rate_limits').select('count').eq('key', ipKey).maybeSingle();
    const ipCount = Math.max(0, Number(ipRow?.count || 0)) + 1;
    await supabase.from('rate_limits').upsert({ key: ipKey, count: ipCount, window_start: nowIso }, { onConflict: 'key' });
    if (ipCount > 60) {
      await logReferralEvent(supabase, guestId, 'referral_reward_blocked', { reason: 'ip_referral_visit_limit' });
      return NextResponse.json({ ok: false, error: 'Referral rate limit reached' }, { status: 429 });
    }

    const { data: inviterCount } = await supabase.from('rate_limits').select('count').eq('key', inviterCountKey).maybeSingle();
    await supabase.from('rate_limits').upsert({
      key: inviterCountKey,
      count: Number(inviterCount?.count || 0) + 1,
      window_start: nowIso,
    }, { onConflict: 'key' });

    const [{ data: visitorProg }, { data: visitorProfile }] = await Promise.all([
      supabase.from('user_progress').select('sigils').eq('user_id', guestId).maybeSingle(),
      supabase.from('profiles').select('guild').eq('id', guestId).maybeSingle(),
    ]);

    await supabase
      .from('user_progress')
      .update({ sigils: Number(visitorProg?.sigils || 0) + Number(REFERRAL_CONFIG.inviteeRewardSigils) })
      .eq('user_id', guestId);

    const visitorSigilsAfter = Number(visitorProg?.sigils || 0) + Number(REFERRAL_CONFIG.inviteeRewardSigils);
    await supabase
      .from('social_referrals')
      .upsert({
        referrer_user_id: ref,
        recruit_user_id: guestId,
        source: 'ref_link',
        pitch_slug: pitch,
        guild_at_join: guildAtJoin,
        status: 'clicked',
        campaign_tag: campaignTag,
        referral_code: referralCode,
        referral_ip_hash: ipHash || null,
        recruit_last_sigils: visitorSigilsAfter,
        recruit_last_checked_at: nowIso,
      }, { onConflict: 'recruit_user_id' });

    if (guildAtJoin && !visitorProfile?.guild) {
      await supabase.from('profiles').update({ guild: guildAtJoin }).eq('id', guestId);
    }

    await supabase.from('social_feed_events').insert({
      user_id: ref,
      actor_user_id: guestId,
      kind: 'recruit_joined',
      message: `A new recruit joined your ${guildAtJoin === 'sun' ? 'Solar Claw' : guildAtJoin === 'moon' ? 'Lunar Paw' : 'arena'} campaign.`,
      reward_sigils: 0,
      meta: { recruit_user_id: guestId, pitch_slug: pitch, guild: guildAtJoin },
    });

    await logReferralEvent(supabase, guestId, 'referral_click', {
      referrer_user_id: ref,
      pitch_slug: pitch,
      guild: guildAtJoin,
      campaign_tag: campaignTag,
      referral_code: referralCode,
    });
    await logReferralEvent(supabase, guestId, 'first_visit', {
      referrer_user_id: ref,
      pitch_slug: pitch,
      guild: guildAtJoin,
      campaign_tag: campaignTag,
      referral_code: referralCode,
    });
    await logReferralEvent(supabase, guestId, 'referral_reward_granted', {
      reward_target: 'invitee',
      amount_sigils: Number(REFERRAL_CONFIG.inviteeRewardSigils),
      trigger: 'first_visit',
    });

    return NextResponse.json({
      ok: true,
      already_tracked: false,
      inviter_bonus: 0,
      visitor_bonus: Number(REFERRAL_CONFIG.inviteeRewardSigils),
      inviter_reward_pending: true,
      prepledged_guild: guildAtJoin,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
