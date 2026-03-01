import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireGuestId } from '../../_lib/guest';
import { REFERRAL_CONFIG } from '../../_lib/referralsConfig';
import { requireUsername } from '../../_lib/require-username';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim();
const MILESTONE_REWARD: Record<number, number> = { 5: 50, 10: 100, 20: 250 };
const MILESTONE_BONUS_ROLL: Record<number, number> = { 5: 1, 10: 1, 20: 2 };

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function POST(request: NextRequest) {
  try {
    let userId = '';
    try {
      userId = await requireGuestId();
    } catch {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await supabase.rpc('bootstrap_user', { p_user_id: userId });
    const usernameCheck = await requireUsername(supabase, userId, 'claim social rewards');
    if (!usernameCheck.ok) return usernameCheck.response;

    const body = await request.json().catch(() => ({}));
    const kind = String(body?.kind || '').trim();

    if (kind === 'pouch') {
      if (!REFERRAL_CONFIG.enableReferralSigilExtras) {
        return NextResponse.json({ ok: true, claimed: false, awarded: 0, disabled: true, message: 'Referral sigil pouch disabled for launch safety.' });
      }
      const { data: refs } = await supabase
        .from('social_referrals')
        .select('id, claimable_sigils')
        .eq('referrer_user_id', userId);
      const totalClaimable = (refs || []).reduce((acc, r) => acc + Math.max(0, Number(r.claimable_sigils || 0)), 0);
      if (totalClaimable <= 0) {
        return NextResponse.json({ ok: true, awarded: 0, claimed: false });
      }

      await Promise.all((refs || []).map((r) =>
        supabase.from('social_referrals').update({ claimable_sigils: 0 }).eq('id', r.id)
      ));
      const key = `social_pouch_claim:${new Date().toISOString()}`;
      await supabase.from('user_reward_claims').insert({ user_id: userId, reward_key: key, reward_sigils: totalClaimable });
      const { data: progress } = await supabase.from('user_progress').select('sigils').eq('user_id', userId).maybeSingle();
      const nextSigils = Number(progress?.sigils || 0) + totalClaimable;
      await supabase.from('user_progress').update({ sigils: nextSigils }).eq('user_id', userId);

      return NextResponse.json({ ok: true, claimed: true, awarded: totalClaimable, sigils_after: nextSigils });
    }

    if (kind === 'milestone') {
      const recruitUserId = String(body?.recruit_user_id || '').trim();
      const milestone = Number(body?.milestone || 0);
      if (!isUuid(recruitUserId) || !MILESTONE_REWARD[milestone]) {
        return NextResponse.json({ ok: false, error: 'Invalid recruit or milestone' }, { status: 400 });
      }

      const { data: relation } = await supabase
        .from('social_referrals')
        .select('id')
        .eq('referrer_user_id', userId)
        .eq('recruit_user_id', recruitUserId)
        .maybeSingle();
      if (!relation?.id) return NextResponse.json({ ok: false, error: 'Recruit not linked to you' }, { status: 403 });

      const { data: prog } = await supabase
        .from('user_progress')
        .select('level')
        .eq('user_id', recruitUserId)
        .maybeSingle();
      const level = Number(prog?.level || 1);
      if (level < milestone) return NextResponse.json({ ok: false, error: `Recruit has not reached level ${milestone}` }, { status: 400 });

      const rewardKey = `social_milestone:${recruitUserId}:lvl${milestone}`;
      const { data: existing } = await supabase
        .from('user_reward_claims')
        .select('reward_key')
        .eq('user_id', userId)
        .eq('reward_key', rewardKey)
        .maybeSingle();
      if (existing?.reward_key) {
        return NextResponse.json({ ok: true, claimed: false, awarded: 0, already_claimed: true });
      }

      const amount = MILESTONE_REWARD[milestone];
      const bonusRolls = MILESTONE_BONUS_ROLL[milestone] || 0;
      await supabase.from('user_reward_claims').insert({ user_id: userId, reward_key: rewardKey, reward_sigils: REFERRAL_CONFIG.enableReferralSigilExtras ? amount : 0 });
      let nextSigils = 0;
      if (REFERRAL_CONFIG.enableReferralSigilExtras) {
        const { data: myProg } = await supabase.from('user_progress').select('sigils').eq('user_id', userId).maybeSingle();
        nextSigils = Number(myProg?.sigils || 0) + amount;
        await supabase.from('user_progress').update({ sigils: nextSigils }).eq('user_id', userId);
      } else {
        await supabase.rpc('ensure_user_prediction_stats', { p_user_id: userId });
        const { data: stats } = await supabase
          .from('user_prediction_stats')
          .select('bonus_rolls')
          .eq('user_id', userId)
          .maybeSingle();
        await supabase
          .from('user_prediction_stats')
          .update({ bonus_rolls: Number(stats?.bonus_rolls || 0) + bonusRolls })
          .eq('user_id', userId);
      }

      await supabase.from('social_feed_events').insert({
        user_id: userId,
        actor_user_id: recruitUserId,
        kind: 'milestone_claim',
        message: `Milestone claimed: recruit reached Lv ${milestone}.`,
        reward_sigils: REFERRAL_CONFIG.enableReferralSigilExtras ? amount : 0,
        meta: {
          recruit_user_id: recruitUserId,
          milestone,
          reward_type: REFERRAL_CONFIG.enableReferralSigilExtras ? 'sigils' : 'bonus_roll',
          reward_amount: REFERRAL_CONFIG.enableReferralSigilExtras ? amount : bonusRolls,
        },
      });

      return NextResponse.json({
        ok: true,
        claimed: true,
        awarded: REFERRAL_CONFIG.enableReferralSigilExtras ? amount : 0,
        reward_type: REFERRAL_CONFIG.enableReferralSigilExtras ? 'sigils' : 'bonus_roll',
        bonus_rolls_awarded: REFERRAL_CONFIG.enableReferralSigilExtras ? 0 : bonusRolls,
        sigils_after: REFERRAL_CONFIG.enableReferralSigilExtras ? nextSigils : undefined,
      });
    }

    return NextResponse.json({ ok: false, error: 'Invalid claim kind' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
