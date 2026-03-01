import type { SupabaseClient } from '@supabase/supabase-js';
import { REFERRAL_CONFIG, getQualifiedDailyCapTotal } from './referralsConfig';

type RecruitRankDef = { name: string; minQualified: number };

export const RECRUIT_RANKS: RecruitRankDef[] = [
  { name: 'Scout', minQualified: 1 },
  { name: 'Recruiter', minQualified: 3 },
  { name: 'Captain', minQualified: 7 },
  { name: 'Warlord', minQualified: 15 },
  { name: 'Founder of Vuxsolia', minQualified: 30 },
  { name: 'Vuxsolian Patriarch', minQualified: 75 },
];

export function computeRecruitRank(qualified: number) {
  const count = Math.max(0, Number(qualified || 0));
  let rank = RECRUIT_RANKS[0];
  for (const r of RECRUIT_RANKS) {
    if (count >= r.minQualified) rank = r;
  }
  const next = RECRUIT_RANKS.find((r) => r.minQualified > rank.minQualified && count < r.minQualified) || null;
  return {
    rank: rank.name,
    nextRank: next?.name || null,
    pointsToNext: next ? Math.max(0, next.minQualified - count) : 0,
  };
}

function dayKeyUtc(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export async function logReferralEvent(
  supabase: SupabaseClient,
  userId: string,
  eventType:
    | 'first_visit'
    | 'signup'
    | 'first_vote'
    | 'first_predict'
    | 'first_cat_minted'
    | 'referral_click'
    | 'referral_signup'
    | 'referral_qualified'
    | 'referral_reward_granted'
    | 'referral_reward_blocked',
  metadata: Record<string, unknown> = {}
) {
  try {
    await supabase.from('referral_events').insert({
      user_id: userId,
      event_type: eventType,
      metadata,
    });
  } catch {
    // Non-blocking analytics.
  }
}

export async function markReferralSignedUp(
  supabase: SupabaseClient,
  recruitUserId: string,
  options?: { signupIpHash?: string | null }
) {
  try {
    const nowIso = new Date().toISOString();
    await supabase
      .from('social_referrals')
      .update({
        status: 'signed_up',
        signup_at: nowIso,
        signup_ip_hash: options?.signupIpHash || null,
      })
      .eq('recruit_user_id', recruitUserId)
      .neq('status', 'qualified');
    await logReferralEvent(supabase, recruitUserId, 'signup', { signup_ip_hash: options?.signupIpHash || null });
    await logReferralEvent(supabase, recruitUserId, 'referral_signup', { signup_ip_hash: options?.signupIpHash || null });
  } catch {
    // best-effort only
  }
}

export async function markReferralQualifiedFromVote(supabase: SupabaseClient, recruitUserId: string) {
  try {
    const { data: cred } = await supabase
      .from('auth_credentials')
      .select('user_id')
      .eq('user_id', recruitUserId)
      .maybeSingle();
    if (!cred?.user_id) return { qualified: false, reason: 'not_registered' as const };

    const { data: rel } = await supabase
      .from('social_referrals')
      .select('id, referrer_user_id, status, created_at, signup_at, signup_ip_hash')
      .eq('recruit_user_id', recruitUserId)
      .maybeSingle();
    if (!rel?.id) return { qualified: false, reason: 'no_referral' as const };
    if (String(rel.status || '') === 'qualified') return { qualified: false, reason: 'already_qualified' as const };
    if (String(rel.status || '') !== 'signed_up') {
      return { qualified: false, reason: 'not_signed_up' as const };
    }

    const now = Date.now();
    const createdAt = new Date(String((rel as any).created_at || 0)).getTime();
    const ageHours = Number.isFinite(createdAt) ? (now - createdAt) / (1000 * 60 * 60) : 9e9;
    if (ageHours > Number(REFERRAL_CONFIG.qualifiedWindowHours)) {
      await logReferralEvent(supabase, recruitUserId, 'referral_reward_blocked', {
        reason: 'qualified_window_expired',
        referrer_user_id: String(rel.referrer_user_id),
      });
      return { qualified: false, reason: 'qualified_window_expired' as const };
    }

    const today = dayKeyUtc();
    const dayStart = `${today}T00:00:00.000Z`;
    const dayEnd = `${today}T23:59:59.999Z`;

    const nowIso = new Date().toISOString();
    const { error: upErr } = await supabase
      .from('social_referrals')
      .update({ status: 'qualified', qualified_at: nowIso })
      .eq('id', String(rel.id))
      .neq('status', 'qualified');
    if (upErr) return { qualified: false, reason: 'update_failed' as const };

    await logReferralEvent(supabase, recruitUserId, 'first_vote');
    await logReferralEvent(supabase, recruitUserId, 'referral_qualified', { referrer_user_id: String(rel.referrer_user_id) });

    await supabase.from('social_feed_events').insert({
      user_id: String(rel.referrer_user_id),
      actor_user_id: recruitUserId,
      kind: 'recruit_qualified',
      message: 'Recruit qualified after first arena action.',
      reward_sigils: 0,
      meta: { recruit_user_id: recruitUserId },
    });

    const { data: row } = await supabase
      .from('referral_edges_daily')
      .select('qualified_count,total_count')
      .eq('day_key', today)
      .eq('inviter_user_id', String(rel.referrer_user_id))
      .maybeSingle();
    await supabase.from('referral_edges_daily').upsert(
      {
        day_key: today,
        inviter_user_id: String(rel.referrer_user_id),
        qualified_count: Math.max(0, Number(row?.qualified_count || 0)) + 1,
        total_count: Math.max(0, Number(row?.total_count || 0)),
        updated_at: nowIso,
      },
      { onConflict: 'day_key,inviter_user_id' }
    );

    if (!REFERRAL_CONFIG.enableInviterRewardOnQualified) {
      await logReferralEvent(supabase, recruitUserId, 'referral_reward_blocked', {
        reason: 'inviter_reward_disabled',
        referrer_user_id: String(rel.referrer_user_id),
      });
      return { qualified: true as const, rewarded: false as const, reason: 'inviter_reward_disabled' as const };
    }

    const perInviterCap = Number(REFERRAL_CONFIG.qualifiedDailyCapPerInviter);
    const { count: inviterAwardedToday } = await supabase
      .from('user_reward_claims')
      .select('reward_key', { count: 'exact', head: true })
      .eq('user_id', String(rel.referrer_user_id))
      .ilike('reward_key', `ref_qualified_reward:${today}:%`);
    if (Number(inviterAwardedToday || 0) >= perInviterCap) {
      await logReferralEvent(supabase, recruitUserId, 'referral_reward_blocked', {
        reason: 'per_inviter_daily_cap',
        referrer_user_id: String(rel.referrer_user_id),
        cap: perInviterCap,
      });
      return { qualified: true as const, rewarded: false as const, reason: 'per_inviter_daily_cap' as const };
    }

    const globalCap = await getQualifiedDailyCapTotal(supabase);
    const { count: globalAwardedToday } = await supabase
      .from('user_reward_claims')
      .select('reward_key', { count: 'exact', head: true })
      .ilike('reward_key', `ref_qualified_reward:${today}:%`);
    if (Number(globalAwardedToday || 0) >= Number(globalCap || 0)) {
      await logReferralEvent(supabase, recruitUserId, 'referral_reward_blocked', {
        reason: 'global_daily_cap',
        global_cap: globalCap,
      });
      return { qualified: true as const, rewarded: false as const, reason: 'global_daily_cap' as const };
    }

    const ipHash = String((rel as any).signup_ip_hash || '').trim();
    if (ipHash) {
      const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: ipSignups } = await supabase
        .from('social_referrals')
        .select('id', { count: 'exact', head: true })
        .eq('referrer_user_id', String(rel.referrer_user_id))
        .eq('signup_ip_hash', ipHash)
        .gte('signup_at', sinceIso);
      if (Number(ipSignups || 0) > Number(REFERRAL_CONFIG.ipSignupThrottlePerInviterPer24h)) {
        await logReferralEvent(supabase, recruitUserId, 'referral_reward_blocked', {
          reason: 'ip_signup_throttle',
          ip_signup_count: Number(ipSignups || 0),
          threshold: Number(REFERRAL_CONFIG.ipSignupThrottlePerInviterPer24h),
        });
        return { qualified: true as const, rewarded: false as const, reason: 'ip_signup_throttle' as const };
      }
    }

    const rewardKey = `ref_qualified_reward:${today}:${String(rel.referrer_user_id)}:${String(rel.id)}`;
    const claim = await supabase
      .from('user_reward_claims')
      .insert({
        user_id: String(rel.referrer_user_id),
        reward_key: rewardKey,
        reward_sigils: Number(REFERRAL_CONFIG.inviterRewardSigilsOnQualified),
      });
    if (claim.error) {
      await logReferralEvent(supabase, recruitUserId, 'referral_reward_blocked', {
        reason: String(claim.error.code || '') === '23505' ? 'dedupe' : 'claim_insert_failed',
        detail: claim.error.message,
      });
      return { qualified: true as const, rewarded: false as const, reason: 'dedupe_or_claim_failed' as const };
    }

    const { data: inviterProg } = await supabase
      .from('user_progress')
      .select('sigils')
      .eq('user_id', String(rel.referrer_user_id))
      .maybeSingle();
    const nextSigils = Number(inviterProg?.sigils || 0) + Number(REFERRAL_CONFIG.inviterRewardSigilsOnQualified);
    await supabase.from('user_progress').update({ sigils: nextSigils }).eq('user_id', String(rel.referrer_user_id));
    await logReferralEvent(supabase, recruitUserId, 'referral_reward_granted', {
      reward_target: 'inviter',
      referrer_user_id: String(rel.referrer_user_id),
      amount_sigils: Number(REFERRAL_CONFIG.inviterRewardSigilsOnQualified),
    });

    return { qualified: true as const, rewarded: true as const };
  } catch {
    return { qualified: false as const, reason: 'exception' as const };
  }
}
