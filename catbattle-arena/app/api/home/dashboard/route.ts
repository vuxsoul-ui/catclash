import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../_lib/guest';
import { LAUNCH_CONFIG, launchPulseBucket } from '../../_lib/launchConfig';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim();

function startOfDayIso(date = new Date()) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function daysAgoIso(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function matchEnergy(votesA: number, votesB: number): number {
  const total = Math.max(0, Number(votesA || 0) + Number(votesB || 0));
  const margin = Math.abs(Number(votesA || 0) - Number(votesB || 0));
  const closeScore = Math.max(0, 45 - margin * 7);
  const volume = Math.min(45, total * 1.8);
  return Math.max(0, Math.min(100, Math.round(closeScore + volume)));
}

export async function GET() {
  try {
    const guestId = await getGuestId();
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await supabase.rpc('bootstrap_user', { p_user_id: guestId });

    const dayStart = startOfDayIso();
    const weekStart = daysAgoIso(7);
    const [
      { count: votesToday },
      { count: predictionsToday },
      { count: votesWeek },
      { count: predictionsWeek },
      recentMainRes,
      activeMainRes,
    ] = await Promise.all([
      supabase.from('votes').select('id', { count: 'exact', head: true }).eq('voter_user_id', guestId).gte('created_at', dayStart),
      supabase.from('match_predictions').select('id', { count: 'exact', head: true }).eq('voter_user_id', guestId).gte('created_at', dayStart),
      supabase.from('votes').select('id', { count: 'exact', head: true }).eq('voter_user_id', guestId).gte('created_at', weekStart),
      supabase.from('match_predictions').select('id', { count: 'exact', head: true }).eq('voter_user_id', guestId).gte('created_at', weekStart),
      supabase
        .from('tournament_matches')
        .select('id, cat_a_id, cat_b_id, winner_id, votes_a, votes_b, created_at')
        .eq('status', 'complete')
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('tournament_matches')
        .select('id, cat_a_id, cat_b_id, votes_a, votes_b, created_at')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(16),
    ]);
    let joinedTodayCount = 0;
    try {
      const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', dayStart);
      joinedTodayCount = Number(count || 0);
    } catch {
      joinedTodayCount = 0;
    }

    let whiskerToday = 0;
    let whiskerWeek = 0;
    try {
      const [{ count: wToday }, { count: wWeek }] = await Promise.all([
        supabase
          .from('arena_matches')
          .select('id', { count: 'exact', head: true })
          .eq('challenger_user_id', guestId)
          .gte('created_at', dayStart),
        supabase
          .from('arena_matches')
          .select('id', { count: 'exact', head: true })
          .eq('challenger_user_id', guestId)
          .gte('created_at', weekStart),
      ]);
      whiskerToday = wToday || 0;
      whiskerWeek = wWeek || 0;
    } catch {
      whiskerToday = 0;
      whiskerWeek = 0;
    }

    const daily = {
      votes: votesToday || 0,
      predictions: predictionsToday || 0,
      whisker: whiskerToday,
    };
    const weekly = {
      votes: votesWeek || 0,
      predictions: predictionsWeek || 0,
      whisker: whiskerWeek,
    };

    const quests = {
      daily: [
        { id: 'daily_vote_3', label: 'Vote in 3 main matches', progress: daily.votes, target: 3, reward: 20, done: daily.votes >= 3 },
        { id: 'daily_predict_1', label: 'Lock 1 prediction', progress: daily.predictions, target: 1, reward: 15, done: daily.predictions >= 1 },
        { id: 'daily_whisker_1', label: 'Play 1 Whisker battle', progress: daily.whisker, target: 1, reward: 25, done: daily.whisker >= 1 },
      ],
      weekly: [
        { id: 'week_vote_20', label: 'Vote in 20 main matches', progress: weekly.votes, target: 20, reward: 90, done: weekly.votes >= 20 },
        { id: 'week_predict_8', label: 'Lock 8 predictions', progress: weekly.predictions, target: 8, reward: 80, done: weekly.predictions >= 8 },
        { id: 'week_whisker_5', label: 'Play 5 Whisker battles', progress: weekly.whisker, target: 5, reward: 120, done: weekly.whisker >= 5 },
      ],
    };

    const highlights: Array<{ id: string; title: string; subtitle: string; created_at: string }> = [];
    const recentMain = recentMainRes.data || [];
    const activeMain = activeMainRes.data || [];
    if (recentMain.length > 0 || activeMain.length > 0) {
      const catIds = Array.from(new Set([
        ...recentMain.flatMap((m) => [m.cat_a_id, m.cat_b_id]),
        ...activeMain.flatMap((m) => [m.cat_a_id, m.cat_b_id]),
      ]));
      const { data: cats } = await supabase.from('cats').select('id, name').in('id', catIds);
      const catName = Object.fromEntries((cats || []).map((c) => [c.id, c.name]));
      for (const m of recentMain) {
        const a = catName[m.cat_a_id] || 'Unknown';
        const b = catName[m.cat_b_id] || 'Unknown';
        const delta = Math.abs(Number(m.votes_a || 0) - Number(m.votes_b || 0));
        const label = delta <= 1 ? 'Photo-finish match' : 'Arena result';
        highlights.push({
          id: m.id,
          title: `${a} vs ${b}`,
          subtitle: `${label} · ${Number(m.votes_a || 0)}-${Number(m.votes_b || 0)} votes`,
          created_at: m.created_at,
        });
      }

      const hottestActive = [...activeMain]
        .sort((a, b) => matchEnergy(Number(b.votes_a || 0), Number(b.votes_b || 0)) - matchEnergy(Number(a.votes_a || 0), Number(a.votes_b || 0)))
        .slice(0, 6)
        .map((m) => {
          const a = catName[m.cat_a_id] || 'Unknown';
          const b = catName[m.cat_b_id] || 'Unknown';
          const margin = Math.abs(Number(m.votes_a || 0) - Number(m.votes_b || 0));
          const heat = matchEnergy(Number(m.votes_a || 0), Number(m.votes_b || 0));
          return {
            id: String(m.id),
            title: `${a} vs ${b}`,
            subtitle: `${margin <= 1 ? 'Photo-finish pressure' : 'Match heating up'} · Energy ${heat}`,
            created_at: String(m.created_at || new Date().toISOString()),
          };
        });
      highlights.unshift(...hottestActive);
    }

    const spotlightOptions = [
      {
        id: 'fraud_watch',
        title: 'Fraud Watch',
        subtitle: highlights[0]?.title ? `${highlights[0].title} is under pressure.` : 'A suspicious lead is forming.',
        cta_href: '#home-arenas',
      },
      {
        id: 'biggest_upset',
        title: 'Biggest Upset',
        subtitle: highlights[1]?.title ? `${highlights[1].title} could flip this Pulse.` : 'Underdog momentum detected.',
        cta_href: '#home-arenas',
      },
      {
        id: 'hottest_match',
        title: 'Hottest Match',
        subtitle: highlights[2]?.title ? `${highlights[2].title} is trending HOT.` : 'Votes are coming in fast.',
        cta_href: '#home-arenas',
      },
      {
        id: 'daily_boss',
        title: 'Daily Boss',
        subtitle: 'Whisker Daily Boss is live. Grab your one daily payout.',
        cta_href: '/arena',
      },
    ];
    const bucket = launchPulseBucket(new Date());
    const rotationIx = Math.abs(
      Array.from(bucket).reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
    ) % spotlightOptions.length;
    const launchSpotlight = LAUNCH_CONFIG.spotlightRotationEnabled
      ? spotlightOptions[rotationIx]
      : spotlightOptions[0];

    return NextResponse.json({
      ok: true,
      quests,
      highlights,
      launch: {
        spotlight: launchSpotlight,
        social_proof_line: `${Number(joinedTodayCount || 0)} Vuxsolians joined today`,
        recruit_push_enabled: LAUNCH_CONFIG.recruitPushEnabled,
        hot_match_bias_enabled: LAUNCH_CONFIG.hotMatchBiasEnabled,
        clutch_share_prompt_enabled: LAUNCH_CONFIG.clutchSharePromptEnabled,
        seed_matchup_autofill: LAUNCH_CONFIG.seedMatchupAutoFill,
      },
      // Temporarily disabled per launch cleanup request.
      rivalry_spotlight: null,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
