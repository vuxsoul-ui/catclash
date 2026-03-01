import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../_lib/guest';
import { computeRecruitRank } from '../../_lib/referrals';
import { REFERRAL_CONFIG } from '../../_lib/referralsConfig';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim();
const TRAINER_CUT_PCT = REFERRAL_CONFIG.enableReferralSigilExtras ? 0.05 : 0;
const TRAINER_CUT_DAILY_CAP_PER_RECRUIT = 300;
const MILESTONES = [5, 10, 20] as const;
const MILESTONE_REWARD: Record<number, number> = { 5: 50, 10: 100, 20: 250 };

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function weekStartUtcIso(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay(); // 0=sun
  const diff = day === 0 ? -6 : 1 - day; // monday start
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function GET() {
  try {
    const userId = await getGuestId();
    if (!userId) return NextResponse.json({ ok: false, error: 'No session' }, { status: 401 });

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    await supabase.rpc('bootstrap_user', { p_user_id: userId });

    const [{ data: refProfile }, { data: referralsRaw }] = await Promise.all([
      supabase.from('profiles').select('id, username, guild').eq('id', userId).maybeSingle(),
      supabase
        .from('social_referrals')
      .select('id, recruit_user_id, pitch_slug, guild_at_join, recruit_last_sigils, claimable_sigils, total_sigils_earned, daily_bonus_day, daily_bonus_awarded, created_at, status')
        .eq('referrer_user_id', userId)
        .order('created_at', { ascending: false }),
    ]);

    const referrals = referralsRaw || [];
    const recruitIds = referrals.map((r) => String(r.recruit_user_id || '')).filter(Boolean);
    if (recruitIds.length === 0) {
      return NextResponse.json({
        ok: true,
        stats: {
          total_recruits: 0,
          active_duels: 0,
          sigils_earned: 0,
          claimable_pouch: 0,
          recruits_value_today: 0,
          loyal_recruits: 0,
          traitor_recruits: 0,
        },
        recruits: [],
        pitches: [],
        share_base: {
          ref: userId,
          username: String(refProfile?.username || '').trim() || null,
          guild: refProfile?.guild || null,
        },
        events: [],
        recruit_tree: {
          rank: 'Unranked',
          next_rank: 'Scout',
          points: 0,
          points_to_next: 1,
          direct_qualified: 0,
          network_qualified: 0,
          depth_counts: { d1: 0, d2: 0, d3: 0 },
        },
        weekly_leaderboard: [],
      });
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const day = todayKey();
    const dayStart = `${day}T00:00:00.000Z`;

    const [{ data: recruitProfiles }, { data: recruitProgress }, { data: duels }, { data: votesToday }, { data: events }, { data: allEdges }, { data: weeklyQualified }] = await Promise.all([
      supabase.from('profiles').select('id, username, guild').in('id', recruitIds),
      supabase.from('user_progress').select('user_id, level, sigils, xp').in('user_id', recruitIds),
      supabase
        .from('duel_challenges')
        .select('id, status, challenger_user_id, challenged_user_id')
        .or(`and(challenger_user_id.eq.${userId},challenged_user_id.in.(${recruitIds.join(',')})),and(challenged_user_id.eq.${userId},challenger_user_id.in.(${recruitIds.join(',')}))`)
        .in('status', ['pending', 'voting']),
      supabase.from('votes').select('voter_user_id').in('voter_user_id', recruitIds).gte('created_at', dayStart),
      supabase
        .from('social_feed_events')
        .select('id, kind, message, reward_sigils, created_at, read_at, actor_user_id, meta')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(25),
      supabase
        .from('social_referrals')
        .select('referrer_user_id,recruit_user_id,status'),
      supabase
        .from('social_referrals')
        .select('referrer_user_id,recruit_user_id,qualified_at,status')
        .eq('status', 'qualified')
        .gte('qualified_at', weekStartUtcIso()),
    ]);

    const progressMap = Object.fromEntries((recruitProgress || []).map((p) => [String(p.user_id), p]));
    const profileMap = Object.fromEntries((recruitProfiles || []).map((p) => [String(p.id), p]));

    const activeDuelByRecruit: Record<string, number> = {};
    for (const d of duels || []) {
      const a = String(d.challenger_user_id || '');
      const b = String(d.challenged_user_id || '');
      const recruitId = a === userId ? b : b === userId ? a : '';
      if (!recruitId) continue;
      activeDuelByRecruit[recruitId] = (activeDuelByRecruit[recruitId] || 0) + 1;
    }

    const votesCountByRecruit: Record<string, number> = {};
    for (const v of votesToday || []) {
      const rid = String(v.voter_user_id || '');
      votesCountByRecruit[rid] = (votesCountByRecruit[rid] || 0) + 1;
    }

    // Trainer cut sync (delta from last known sigils).
    let claimablePouch = 0;
    let recruitsValueToday = 0;
    const updatedReferrals = await Promise.all(referrals.map(async (row) => {
      const recruitId = String(row.recruit_user_id || '');
      const prog = progressMap[recruitId];
      const currentSigils = Math.max(0, Number(prog?.sigils || 0));
      const prevSigils = Math.max(0, Number(row.recruit_last_sigils || 0));
      const currentDay = String(row.daily_bonus_day || '');
      let dailyAwarded = Number(row.daily_bonus_awarded || 0);
      let claimable = Math.max(0, Number(row.claimable_sigils || 0));
      let totalEarned = Math.max(0, Number(row.total_sigils_earned || 0));

      if (currentDay !== day) dailyAwarded = 0;

      const delta = currentSigils - prevSigils;
      if (REFERRAL_CONFIG.enableReferralSigilExtras && delta > 0) {
        const rawBonus = Math.floor(delta * TRAINER_CUT_PCT);
        const capRemain = Math.max(0, TRAINER_CUT_DAILY_CAP_PER_RECRUIT - dailyAwarded);
        const award = Math.min(rawBonus, capRemain);
        if (award > 0) {
          claimable += award;
          totalEarned += award;
          dailyAwarded += award;
        }
      }

      claimablePouch += claimable;
      const sameGuild = !!refProfile?.guild && !!profileMap[recruitId]?.guild && String(profileMap[recruitId].guild) === String(refProfile.guild);
      if (sameGuild) recruitsValueToday += (votesCountByRecruit[recruitId] || 0) * 5;

      await supabase
        .from('social_referrals')
        .update({
          recruit_last_sigils: currentSigils,
          recruit_last_checked_at: nowIso,
          claimable_sigils: claimable,
          total_sigils_earned: totalEarned,
          daily_bonus_day: day,
          daily_bonus_awarded: dailyAwarded,
        })
        .eq('id', row.id);

      return {
        ...row,
        claimable_sigils: claimable,
        total_sigils_earned: totalEarned,
        daily_bonus_awarded: dailyAwarded,
      };
    }));

    // Milestone claimability
    const milestoneKeys = recruitIds.flatMap((rid) => MILESTONES.map((m) => `social_milestone:${rid}:lvl${m}`));
    const { data: milestoneClaims } = await supabase
      .from('user_reward_claims')
      .select('reward_key')
      .eq('user_id', userId)
      .in('reward_key', milestoneKeys);
    const claimedSet = new Set((milestoneClaims || []).map((r) => String(r.reward_key || '')));

    const recruits = updatedReferrals.map((row) => {
      const rid = String(row.recruit_user_id || '');
      const profile = profileMap[rid];
      const prog = progressMap[rid];
      const lvl = Math.max(1, Number(prog?.level || 1));
      const unlocked = MILESTONES.filter((m) => lvl >= m);
      const claimableMilestones = unlocked
        .filter((m) => !claimedSet.has(`social_milestone:${rid}:lvl${m}`))
        .map((m) => ({ level: m, reward_sigils: MILESTONE_REWARD[m] || 0 }));
      const nextMilestone = MILESTONES.find((m) => lvl < m) || null;
      const progressToNext = nextMilestone
        ? Math.max(0, Math.min(1, lvl / nextMilestone))
        : 1;

      return {
        recruit_user_id: rid,
        username: String(profile?.username || `Player ${rid.slice(0, 8)}`),
        guild: profile?.guild || null,
        status: String((row as any).status || 'clicked') as 'clicked' | 'signed_up' | 'qualified',
        level: lvl,
        xp: Number(prog?.xp || 0),
        pitch_slug: row.pitch_slug || null,
        active_duels: activeDuelByRecruit[rid] || 0,
        claimable_milestones: claimableMilestones,
        next_milestone: nextMilestone,
        progress_to_next: progressToNext,
        trainer_claimable_sigils: Number(row.claimable_sigils || 0),
      };
    });

    const { data: payoutClaims } = await supabase
      .from('user_reward_claims')
      .select('reward_sigils, reward_key')
      .eq('user_id', userId)
      .or('reward_key.like.social_milestone:%,reward_key.like.social_pouch_claim:%');
    const milestoneAndPouchEarned = (payoutClaims || []).reduce((acc, row) => acc + Math.max(0, Number(row.reward_sigils || 0)), 0);
    const trainerTotal = updatedReferrals.reduce((acc, row) => acc + Math.max(0, Number(row.total_sigils_earned || 0)), 0);

    const pitchCounts: Record<string, number> = {};
    for (const r of updatedReferrals) {
      const key = String(r.pitch_slug || 'unknown');
      pitchCounts[key] = (pitchCounts[key] || 0) + 1;
    }
    const pitches = Object.entries(pitchCounts).map(([slug, recruitsCount]) => ({ slug, recruits_count: recruitsCount }));
    const myGuild = String(refProfile?.guild || '');
    const loyalRecruits = recruits.filter((r) => !!r.guild && !!myGuild && String(r.guild) === myGuild).length;
    const traitorRecruits = recruits.filter((r) => !!r.guild && !!myGuild && String(r.guild) !== myGuild).length;

    const qualifiedRows = updatedReferrals.filter((r) => String((r as any).status || '') === 'qualified');
    const directQualified = qualifiedRows.length;
    const edgeRows = Array.isArray(allEdges) ? allEdges : [];
    const byReferrer = new Map<string, string[]>();
    for (const edge of edgeRows) {
      const refId = String((edge as any).referrer_user_id || '');
      const recruitId = String((edge as any).recruit_user_id || '');
      const st = String((edge as any).status || '');
      if (!refId || !recruitId || st !== 'qualified') continue;
      const list = byReferrer.get(refId) || [];
      list.push(recruitId);
      byReferrer.set(refId, list);
    }
    const d1 = new Set(byReferrer.get(userId) || []);
    const d2 = new Set<string>();
    const d3 = new Set<string>();
    for (const r1 of d1) {
      for (const r2 of byReferrer.get(r1) || []) {
        if (!d1.has(r2) && r2 !== userId) d2.add(r2);
      }
    }
    for (const r2 of d2) {
      for (const r3 of byReferrer.get(r2) || []) {
        if (!d1.has(r3) && !d2.has(r3) && r3 !== userId) d3.add(r3);
      }
    }
    const networkQualified = d2.size + d3.size;
    const recruitPoints = directQualified * 10 + d2.size * 3 + d3.size;
    const rankInfo = computeRecruitRank(directQualified);

    const weeklyRows = Array.isArray(weeklyQualified) ? weeklyQualified : [];
    const weeklyCounts: Record<string, number> = {};
    for (const row of weeklyRows) {
      const refId = String((row as any).referrer_user_id || '');
      if (!refId) continue;
      weeklyCounts[refId] = (weeklyCounts[refId] || 0) + 1;
    }
    const leaderboardIds = Object.keys(weeklyCounts).slice(0, 40);
    const { data: leaderboardProfiles } = leaderboardIds.length
      ? await supabase.from('profiles').select('id,username').in('id', leaderboardIds)
      : { data: [] as any[] };
    const lpMap = Object.fromEntries((leaderboardProfiles || []).map((p) => [String((p as any).id || ''), String((p as any).username || '').trim() || `Player ${String((p as any).id || '').slice(0, 8)}`]));
    const weeklyLeaderboard = Object.entries(weeklyCounts)
      .map(([id, qualified]) => ({ user_id: id, username: lpMap[id] || `Player ${id.slice(0, 8)}`, qualified }))
      .sort((a, b) => b.qualified - a.qualified)
      .slice(0, 10);

    return NextResponse.json({
      ok: true,
      stats: {
        total_recruits: recruitIds.length,
        qualified_recruits: directQualified,
        network_recruits: networkQualified,
        active_duels: (duels || []).length,
        sigils_earned: trainerTotal + milestoneAndPouchEarned,
        claimable_pouch: claimablePouch,
        recruits_value_today: recruitsValueToday,
        loyal_recruits: loyalRecruits,
        traitor_recruits: traitorRecruits,
      },
      recruits,
      pitches,
      share_base: {
        ref: userId,
        username: String(refProfile?.username || '').trim() || null,
        guild: refProfile?.guild || null,
      },
      recruit_tree: {
        rank: rankInfo.rank,
        next_rank: rankInfo.nextRank,
        points: recruitPoints,
        points_to_next: rankInfo.pointsToNext,
        direct_qualified: directQualified,
        network_qualified: networkQualified,
        depth_counts: { d1: d1.size, d2: d2.size, d3: d3.size },
      },
      weekly_leaderboard: weeklyLeaderboard,
      events: (events || []).map((e) => ({
        id: e.id,
        kind: e.kind,
        message: e.message,
        reward_sigils: Number(e.reward_sigils || 0),
        created_at: e.created_at,
        read: !!e.read_at,
        actor_user_id: e.actor_user_id || null,
        meta: e.meta || {},
      })),
    }, { headers: { 'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate' } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
