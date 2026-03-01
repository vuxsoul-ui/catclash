import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../../../_lib/guest';
import { ratingTier, runBattleTurn, toStance, xpForBattle, type ArenaAction, type ArenaBattleState } from '../../../../_lib/arena-engine';
import { trackWhiskerEvent } from '../../../../_lib/whisker-telemetry';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim();
const WIN_STREAK_BONUS_MAX = 3;
const CAT_LEVEL_CAP = 30;

function toAction(input: unknown): ArenaAction {
  const v = String(input || '').toLowerCase();
  if (v === 'guard' || v === 'control' || v === 'burst' || v === 'heal' || v === 'bleed' || v === 'stun') return v;
  return 'strike';
}

function isActionUnlocked(action: ArenaAction, catLevel: number): boolean {
  if (action === 'heal') return catLevel >= 3;
  if (action === 'bleed') return catLevel >= 5;
  if (action === 'stun') return catLevel >= 8;
  return true;
}

function xpToNext(level: number): number {
  return Math.max(120, level * 130);
}

async function applyCatXp(supabase: any, catId: string, won: boolean) {
  const { data: catRow } = await supabase
    .from('cats')
    .select('id, cat_xp, cat_level')
    .eq('id', catId)
    .maybeSingle();

  const cat = catRow as { id: string; cat_xp: number | null; cat_level: number | null } | null;
  if (!cat) return;

  let xp = Number(cat.cat_xp || 0) + xpForBattle(won);
  let level = Math.max(1, Number(cat.cat_level || 1));

  while (level < CAT_LEVEL_CAP && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
  }

  await (supabase.from('cats') as any)
    .update({ cat_xp: xp, cat_level: level })
    .eq('id', catId);
}

async function grantBonusRoll(supabase: any, userId: string, amount: number): Promise<number> {
  if (amount <= 0) return 0;
  await supabase.rpc('ensure_user_prediction_stats', { p_user_id: userId });
  const { data: stats } = await supabase
    .from('user_prediction_stats')
    .select('bonus_rolls')
    .eq('user_id', userId)
    .maybeSingle();
  const next = Math.max(0, Number(stats?.bonus_rolls || 0)) + amount;
  await supabase.from('user_prediction_stats').update({ bonus_rolls: next }).eq('user_id', userId);
  return amount;
}

async function grantWhiskerProgress(supabase: any, userId: string, won: boolean) {
  const rewardTokens = won ? 8 : 4;
  const rewardXp = won ? 30 : 12;
  const { data: progress } = await supabase
    .from('user_progress')
    .select('xp, whisker_tokens')
    .eq('user_id', userId)
    .maybeSingle();

  const nextXp = Math.max(0, Number(progress?.xp || 0)) + rewardXp;
  const nextTokens = Math.max(0, Number(progress?.whisker_tokens || 0)) + rewardTokens;
  await supabase
    .from('user_progress')
    .update({ xp: nextXp, whisker_tokens: nextTokens })
    .eq('user_id', userId);

  return { whisker_tokens_awarded: rewardTokens, whisker_xp_awarded: rewardXp };
}

async function claimFirstWinAfterPulseBonus(supabase: any, userId: string, won: boolean): Promise<number> {
  if (!won) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const key = `whisker_first_win:${today}`;
  const { error: claimErr } = await supabase
    .from('user_reward_claims')
    .insert({ user_id: userId, reward_key: key, reward_sigils: 0 });

  if (claimErr) {
    const msg = String(claimErr.message || '').toLowerCase();
    if (msg.includes('duplicate') || msg.includes('unique')) return 0;
    return 0;
  }
  return grantBonusRoll(supabase, userId, 1);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getGuestId();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const action = toAction(body?.action);
    const stance = toStance(body?.stance);

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: match, error: matchErr } = await supabase
      .from('arena_matches')
      .select('id, challenger_user_id, snapshot_a_id, snapshot_b_id, opponent_cat_id, status, turns, summary')
      .eq('id', id)
      .maybeSingle();

    if (matchErr) return NextResponse.json({ ok: false, error: matchErr.message }, { status: 500 });
    if (!match) return NextResponse.json({ ok: false, error: 'Match not found' }, { status: 404 });
    if (match.challenger_user_id !== userId) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });

    const state = (match.summary?.state || null) as ArenaBattleState | null;
    if (!state) return NextResponse.json({ ok: false, error: 'Battle state missing' }, { status: 400 });

    if (match.status === 'complete' || state.winner_slot) {
      return NextResponse.json({ ok: true, done: true, state, winner_slot: state.winner_slot || null });
    }

    const { data: mySnap } = await supabase
      .from('arena_snapshots')
      .select('cat_id')
      .eq('id', match.snapshot_a_id)
      .maybeSingle();
    const myCatId = String(mySnap?.cat_id || '').trim();
    let myCatLevel = 1;
    if (myCatId) {
      const { data: myCat } = await supabase
        .from('cats')
        .select('cat_level')
        .eq('id', myCatId)
        .maybeSingle();
      myCatLevel = Math.max(1, Number(myCat?.cat_level || 1));
    }
    if (!isActionUnlocked(action, myCatLevel)) {
      return NextResponse.json({ ok: false, error: `Move locked. Requires cat level ${action === 'heal' ? 3 : action === 'bleed' ? 5 : 8}.` }, { status: 400 });
    }

    const turnResult = runBattleTurn({ state, playerAction: action, playerStance: stance });

    if (turnResult.events.length > 0) {
      await supabase.from('arena_events').insert(
        turnResult.events.map((e) => ({
          match_id: match.id,
          turn_no: e.turn_no,
          actor_slot: e.actor_slot,
          action_type: e.action_type,
          value: e.value,
          payload: e.payload,
        }))
      );
    }

    if (!turnResult.done) {
      await supabase
        .from('arena_matches')
        .update({
          turns: turnResult.state.turn,
          summary: {
            ...(match.summary || {}),
            state: turnResult.state,
          },
        })
        .eq('id', match.id);

      await trackWhiskerEvent(supabase, userId, 'whisker_action_selected', {
        match_id: match.id,
        action,
        stance,
        turn: turnResult.state.turn,
      });

      return NextResponse.json({
        ok: true,
        done: false,
        state: turnResult.state,
        events: turnResult.events,
      });
    }

    const myWon = turnResult.winner_slot === 'a';

    const { data: currentRating } = await supabase
      .from('arena_ratings')
      .select('rating, wins, losses')
      .eq('user_id', userId)
      .maybeSingle();

    const prevWins = Number(currentRating?.wins || 0);
    const prevLosses = Number(currentRating?.losses || 0);
    const { data: recentForStreak } = await supabase
      .from('arena_matches')
      .select('rating_delta')
      .eq('challenger_user_id', userId)
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(3);
    let currentStreak = 0;
    for (const row of recentForStreak || []) {
      if (Number(row.rating_delta || 0) > 0) currentStreak += 1;
      else break;
    }
    const streakBonus = myWon ? Math.min(WIN_STREAK_BONUS_MAX, currentStreak) : 0;

    const ratingDelta = myWon ? 15 + streakBonus : -10;
    const nextRating = Number(currentRating?.rating || 1000) + ratingDelta;

    await supabase
      .from('arena_ratings')
      .upsert({
        user_id: userId,
        rating: nextRating,
        tier: ratingTier(nextRating),
        wins: prevWins + (myWon ? 1 : 0),
        losses: prevLosses + (myWon ? 0 : 1),
        updated_at: new Date().toISOString(),
        last_match_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    const opponentUserId = String(match.summary?.opponent_user_id || '').trim();
    if (opponentUserId) {
      const oppDelta = -ratingDelta;
      const { data: oppRating } = await supabase
        .from('arena_ratings')
        .select('rating, wins, losses')
        .eq('user_id', opponentUserId)
        .maybeSingle();
      const nextOpp = Number(oppRating?.rating || 1000) + oppDelta;
      await supabase
        .from('arena_ratings')
        .upsert({
          user_id: opponentUserId,
          rating: nextOpp,
          tier: ratingTier(nextOpp),
          wins: Number(oppRating?.wins || 0) + (myWon ? 0 : 1),
          losses: Number(oppRating?.losses || 0) + (myWon ? 1 : 0),
          updated_at: new Date().toISOString(),
          last_match_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
    }

    const { data: mySnapFinal } = await supabase
      .from('arena_snapshots')
      .select('cat_id')
      .eq('id', match.snapshot_a_id)
      .maybeSingle();

    let opponentSnapshotCatId: string | null = null;
    if (match.snapshot_b_id) {
      const { data: oppSnap } = await supabase
        .from('arena_snapshots')
        .select('cat_id')
        .eq('id', match.snapshot_b_id)
        .maybeSingle();
      opponentSnapshotCatId = oppSnap?.cat_id || null;
    }

    const winnerSnapshotId = turnResult.winner_slot === 'a' ? match.snapshot_a_id : match.snapshot_b_id;
    const winnerCatId = turnResult.winner_slot === 'a'
      ? mySnapFinal?.cat_id || null
      : (opponentSnapshotCatId || match.opponent_cat_id);

    await supabase
      .from('arena_matches')
      .update({
        status: 'complete',
        turns: turnResult.state.turn,
        rating_delta: ratingDelta,
        winner_snapshot_id: winnerSnapshotId,
        winner_cat_id: winnerCatId,
        summary: {
          ...(match.summary || {}),
          state: turnResult.state,
          final_hp_a: turnResult.state.fighter_a.hp,
          final_hp_b: turnResult.state.fighter_b.hp,
          streak_bonus: streakBonus,
          resolved_at: new Date().toISOString(),
        },
      })
      .eq('id', match.id);

    let bossFirstClearToday = false;
    let bossRewardApplied = false;
    let bossClearStreak = 0;
    let bonusRollsAwarded = 0;

    const mode = String(match.summary?.mode || '');
    if (myWon && mode === 'daily_boss') {
      const bossDate = String(match.summary?.boss_date || new Date().toISOString().slice(0, 10));
      const rewardSigils = Math.max(0, Number(match.summary?.boss_reward_sigils || 25));
      const rewardKey = `daily_boss_win:${bossDate}`;
      const { error: claimErr } = await supabase
        .from('user_reward_claims')
        .insert({
          user_id: userId,
          reward_key: rewardKey,
          reward_sigils: rewardSigils,
        });
      if (!claimErr) {
        bossFirstClearToday = true;
        bossRewardApplied = true;
        const { data: prog } = await supabase
          .from('user_progress')
          .select('sigils, xp, whisker_tokens')
          .eq('user_id', userId)
          .maybeSingle();
        await supabase
          .from('user_progress')
          .update({
            sigils: Number(prog?.sigils || 0) + rewardSigils,
            xp: Number(prog?.xp || 0) + 40,
            whisker_tokens: Number(prog?.whisker_tokens || 0) + 10,
          })
          .eq('user_id', userId);

        bonusRollsAwarded += await grantBonusRoll(supabase, userId, 1);

        const { data: streakRow, error: streakErr } = await supabase
          .from('daily_boss_progress')
          .select('last_clear_date, clear_streak')
          .eq('user_id', userId)
          .maybeSingle();
        if (!streakErr) {
          const prevDate = String(streakRow?.last_clear_date || '');
          const prevStreak = Math.max(0, Number(streakRow?.clear_streak || 0));
          let nextStreak = 1;
          if (prevDate) {
            const prev = new Date(`${prevDate}T00:00:00.000Z`);
            const cur = new Date(`${bossDate}T00:00:00.000Z`);
            const days = Math.round((cur.getTime() - prev.getTime()) / 86400000);
            if (days === 1) nextStreak = prevStreak + 1;
            if (days === 0) nextStreak = prevStreak;
          }
          bossClearStreak = nextStreak;
          await supabase
            .from('daily_boss_progress')
            .upsert({
              user_id: userId,
              last_clear_date: bossDate,
              clear_streak: nextStreak,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });
        }
      } else {
        const msg = String(claimErr.message || '').toLowerCase();
        if (msg.includes('duplicate') || msg.includes('unique')) {
          bossRewardApplied = false;
        }
      }
    }

    const progressRewards = await grantWhiskerProgress(supabase, userId, myWon);
    bonusRollsAwarded += await claimFirstWinAfterPulseBonus(supabase, userId, myWon);

    if (mySnapFinal?.cat_id) {
      await applyCatXp(supabase, mySnapFinal.cat_id, myWon);
    }

    await trackWhiskerEvent(supabase, userId, mode === 'daily_boss' ? 'whisker_daily_boss_win' : 'whisker_match_end', {
      match_id: match.id,
      mode,
      won: myWon,
      turn_count: turnResult.state.turn,
      ai_profile: String(match.summary?.opponent_profile || 'unknown'),
      rating_delta: ratingDelta,
    });

    return NextResponse.json({
      ok: true,
      done: true,
      winner_slot: turnResult.winner_slot,
      state: turnResult.state,
      events: turnResult.events,
      rating_delta: ratingDelta,
      streak_bonus: streakBonus,
      first_clear_today: bossFirstClearToday,
      reward_applied: bossRewardApplied,
      clear_streak: bossClearStreak,
      ...progressRewards,
      bonus_rolls_awarded: bonusRollsAwarded,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
