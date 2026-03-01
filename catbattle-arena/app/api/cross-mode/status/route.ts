import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../_lib/guest';
import { FEATURES } from '../../_lib/flags';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function dayStart(today: string) {
  return `${today}T00:00:00.000Z`;
}

export async function GET() {
  try {
    if (!FEATURES.CROSS_MODE_V2) {
      return NextResponse.json({ ok: true, enabled: false });
    }

    const userId = await getGuestId();
    if (!userId) return NextResponse.json({ ok: false, error: 'No session' }, { status: 401 });

    const today = new Date().toISOString().slice(0, 10);
    const bonusKeyVote = `cross_mode_vote_bonus:${today}`;
    const bonusKeyWhisker = `cross_mode_whisker_bonus:${today}`;
    const start = dayStart(today);

    const [
      voteBonusClaimRes,
      whiskerBonusClaimRes,
      whiskerWinRes,
      mainVotesRes,
    ] = await Promise.all([
      supabase.from('user_reward_claims').select('reward_key').eq('user_id', userId).eq('reward_key', bonusKeyVote).maybeSingle(),
      supabase.from('user_reward_claims').select('reward_key').eq('user_id', userId).eq('reward_key', bonusKeyWhisker).maybeSingle(),
      supabase
        .from('arena_matches')
        .select('id', { count: 'exact', head: true })
        .eq('challenger_user_id', userId)
        .eq('status', 'complete')
        .gt('rating_delta', 0)
        .gte('created_at', start),
      supabase
        .from('votes')
        .select('id', { count: 'exact', head: true })
        .eq('voter_user_id', userId)
        .gte('created_at', start),
    ]);

    const whiskerToMainEligible = Number(whiskerWinRes.count || 0) > 0;
    const mainToWhiskerEligible = Number(mainVotesRes.count || 0) >= 3;

    return NextResponse.json({
      ok: true,
      enabled: true,
      today,
      whisker_to_main: {
        reward_key: bonusKeyVote,
        eligible: whiskerToMainEligible,
        claimed: !!voteBonusClaimRes.data,
      },
      main_to_whisker: {
        reward_key: bonusKeyWhisker,
        eligible: mainToWhiskerEligible,
        claimed: !!whiskerBonusClaimRes.data,
        votes_today: Number(mainVotesRes.count || 0),
        votes_needed: 3,
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

