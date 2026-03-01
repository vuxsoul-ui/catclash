import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireGuestId } from '../../_lib/guest';
import { grantPendingCatXp } from '../../_lib/cat-progression';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const sb = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

type MissionKey =
  | 'claim_name'
  | 'join_guild'
  | 'submit_cat'
  | 'bookmark_home'
  | 'vote_predict'
  | 'xp_bank'
  | 'play_whisker';

const MISSIONS: Array<{
  key: MissionKey;
  title: string;
  description: string;
  reward_xp: number;
  cta: string;
  cta_href: string;
}> = [
  {
    key: 'claim_name',
    title: 'Mission 1 — Claim Your Fighter Name',
    description: 'Choose your arena name. This is how rivals will remember you.',
    reward_xp: 25,
    cta: 'Set Username',
    cta_href: '/profile/me',
  },
  {
    key: 'join_guild',
    title: 'Mission 2 — Join a Guild',
    description: 'Guilds earn bonuses together. Choose your alliance.',
    reward_xp: 50,
    cta: 'Browse Guilds',
    cta_href: '/social',
  },
  {
    key: 'submit_cat',
    title: 'Mission 3 — Submit Your Cat',
    description: 'Upload your cat. We\'ll assign rarity and mint your fighter card.',
    reward_xp: 100,
    cta: 'Submit Cat',
    cta_href: '/submit',
  },
  {
    key: 'bookmark_home',
    title: 'Mission 4 — Add to Home Screen',
    description: 'Add CatClash to your Home Screen so it feels like a native app.',
    reward_xp: 0,
    cta: 'Add to Home Screen',
    cta_href: '#bookmark-home',
  },
  {
    key: 'vote_predict',
    title: 'Mission 5 — Vote & Predict',
    description: 'Predict battle winners. Earn rewards before you fight.',
    reward_xp: 50,
    cta: 'Start Voting',
    cta_href: '#home-arenas',
  },
  {
    key: 'xp_bank',
    title: 'Mission 6 — Power Up in XP Bank',
    description: 'Visit Gallery → My Cats to strengthen your fighter.',
    reward_xp: 75,
    cta: 'Open My Cats',
    cta_href: '/gallery#my-cats',
  },
  {
    key: 'play_whisker',
    title: 'Mission 7 — Play Whisker',
    description: 'Play Whisker to earn bonus XP and rare boosts.',
    reward_xp: 75,
    cta: 'Play Whisker',
    cta_href: '/arena',
  },
];

const CLAIM_PREFIX = 'starter_mission_v2:';
const COMPLETE_KEY = 'starter_missions_complete_v2';
const COMPLETE_BONUS_XP = 120;
const CAT_XP_STEP_KEY_V2 = 'getting_started_cat_xp_applied_v2';

async function getFlags(userId: string) {
  const [catsRes, voteRes, predictionRes, whiskerRes, profileRes, xpBankStepRes, bookmarkRes] = await Promise.all([
    sb.from('cats').select('id, origin').eq('user_id', userId),
    sb.from('votes').select('id', { count: 'exact', head: true }).eq('voter_user_id', userId),
    sb.from('match_predictions').select('id', { count: 'exact', head: true }).eq('voter_user_id', userId),
    sb.from('arena_matches').select('id', { count: 'exact', head: true }).eq('challenger_user_id', userId),
    sb.from('profiles').select('username, guild').eq('id', userId).maybeSingle(),
    sb.from('user_reward_claims').select('reward_key').eq('user_id', userId).eq('reward_key', CAT_XP_STEP_KEY_V2).maybeSingle(),
    sb.from('user_reward_claims').select('reward_key').eq('user_id', userId).eq('reward_key', 'starter_home_bookmark_v1').maybeSingle(),
  ]);

  const allCats = catsRes.data || [];
  return {
    has_account: !!String(profileRes.data?.username || '').trim(),
    has_guild: ['sun', 'moon'].includes(String(profileRes.data?.guild || '').toLowerCase()),
    has_submitted_cat: allCats.length > 0,
    has_home_bookmark: !!bookmarkRes.data,
    has_vote_prediction: Number(voteRes.count || 0) > 0 && Number(predictionRes.count || 0) > 0,
    has_cat_xp_bank: !!xpBankStepRes.data,
    has_whisker_battle: Number(whiskerRes.count || 0) > 0,
  };
}

function missionCondition(key: MissionKey, flags: Awaited<ReturnType<typeof getFlags>>): boolean {
  if (key === 'claim_name') return flags.has_account;
  if (key === 'join_guild') return flags.has_guild;
  if (key === 'submit_cat') return flags.has_submitted_cat;
  if (key === 'bookmark_home') return flags.has_home_bookmark;
  if (key === 'vote_predict') return flags.has_vote_prediction;
  if (key === 'xp_bank') return flags.has_cat_xp_bank;
  return flags.has_whisker_battle;
}

async function applyMissionRewards(userId: string, flags: Awaited<ReturnType<typeof getFlags>>) {
  await sb.rpc('bootstrap_user', { p_user_id: userId });

  let xpAwardedNow = 0;
  let catXpBankedNow = 0;
  const newlyCompletedKeys: MissionKey[] = [];

  let priorUnlocked = true;
  const missions = [] as Array<{
    key: MissionKey;
    title: string;
    description: string;
    reward_xp: number;
    cta: string;
    cta_href: string;
    status: 'locked' | 'active' | 'complete';
  }>;

  for (const m of MISSIONS) {
    const conditionMet = missionCondition(m.key, flags);
    const isComplete = priorUnlocked && conditionMet;

    let status: 'locked' | 'active' | 'complete' = 'locked';
    if (isComplete) status = 'complete';
    else if (priorUnlocked) status = 'active';

    missions.push({ ...m, status });

    if (isComplete) {
      const claimKey = `${CLAIM_PREFIX}${m.key}`;
      const ins = await sb.from('user_reward_claims').insert({ user_id: userId, reward_key: claimKey, reward_sigils: 0 });
      if (!ins.error) {
        xpAwardedNow += m.reward_xp;
        catXpBankedNow += await grantPendingCatXp(sb, userId, m.reward_xp);
        newlyCompletedKeys.push(m.key);
      }
    }

    priorUnlocked = priorUnlocked && conditionMet;
  }

  const complete = missions.every((m) => m.status === 'complete');
  let completionBonusAwarded = false;

  if (complete) {
    const ins = await sb.from('user_reward_claims').insert({ user_id: userId, reward_key: COMPLETE_KEY, reward_sigils: 0 });
    if (!ins.error) {
      xpAwardedNow += COMPLETE_BONUS_XP;
      catXpBankedNow += await grantPendingCatXp(sb, userId, COMPLETE_BONUS_XP);
      completionBonusAwarded = true;
    }
  }

  if (xpAwardedNow > 0) {
    const { data: progress } = await sb.from('user_progress').select('xp').eq('user_id', userId).maybeSingle();
    const nextXp = Number(progress?.xp || 0) + xpAwardedNow;
    await sb.from('user_progress').update({ xp: nextXp }).eq('user_id', userId);
    await sb.rpc('check_level_up', { p_user_id: userId });
  }

  const { data: completeClaim } = await sb
    .from('user_reward_claims')
    .select('reward_key')
    .eq('user_id', userId)
    .eq('reward_key', COMPLETE_KEY)
    .maybeSingle();

  const completedCount = missions.filter((m) => m.status === 'complete').length;
  const currentMission = missions.find((m) => m.status === 'active') || null;

  return {
    missions,
    progress: {
      completed: completedCount,
      total: MISSIONS.length,
      pct: Math.round((completedCount / MISSIONS.length) * 100),
    },
    current_mission_key: currentMission?.key || null,
    completion: {
      complete,
      badge_unlocked: !!completeClaim,
      bonus_xp: COMPLETE_BONUS_XP,
    },
    runtime_rewards: {
      xp_awarded_now: xpAwardedNow,
      cat_xp_banked_now: catXpBankedNow,
      newly_completed_keys: newlyCompletedKeys,
      completion_bonus_awarded: completionBonusAwarded,
    },
  };
}

async function buildResponse(userId: string) {
  const flags = await getFlags(userId);
  const missionState = await applyMissionRewards(userId, flags);
  return {
    ok: true,
    title: '🐾 Enter the Arena',
    rank_label: 'Arena Rank 1',
    subtitle: 'Starter Arena Missions',
    ...missionState,
  };
}

export async function GET() {
  try {
    let userId = '';
    try {
      userId = await requireGuestId();
    } catch {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(await buildResponse(userId));
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST() {
  try {
    let userId = '';
    try {
      userId = await requireGuestId();
    } catch {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(await buildResponse(userId));
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
