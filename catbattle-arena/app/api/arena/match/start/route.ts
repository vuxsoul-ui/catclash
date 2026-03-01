import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../../_lib/guest';
import { actionCost, createBattleState, type ArenaAction, type ArenaBehavior } from '../../../_lib/arena-engine';
import { getActiveWhiskerModifier } from '../../../_lib/whisker-modifier';
import { FEATURES } from '../../../_lib/flags';
import { trackWhiskerEvent } from '../../../_lib/whisker-telemetry';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim();

type SnapshotRow = {
  id: string;
  user_id: string;
  cat_id: string;
  cat_name: string;
  ai_behavior: ArenaBehavior;
  skill_priority: ArenaAction[];
  snapshot_stats: {
    attack: number;
    defense: number;
    speed: number;
    charisma: number;
    chaos: number;
    rarity?: string;
    owner_level?: number;
  };
};

function randomSeed() {
  return Math.floor(Math.random() * 1_000_000_000);
}

function npcBehaviorFromStats(stats: {
  attack: number;
  defense: number;
  speed: number;
  charisma: number;
  chaos: number;
}): ArenaBehavior {
  const { attack, defense, speed, chaos } = stats;
  if (chaos >= Math.max(attack, defense, speed)) return 'trickster';
  if (defense >= attack && defense >= speed) return 'turtle';
  if (speed >= attack) return 'tactical';
  return 'aggressive';
}

function npcPriorityFromStats(stats: {
  attack: number;
  defense: number;
  speed: number;
  charisma: number;
  chaos: number;
}): ArenaAction[] {
  const { attack, defense, speed, chaos } = stats;
  if (chaos >= attack && chaos >= defense) return ['burst', 'control', 'strike', 'guard'];
  if (defense >= attack) return ['guard', 'control', 'strike', 'burst'];
  if (speed >= attack) return ['control', 'strike', 'guard', 'burst'];
  return ['strike', 'burst', 'control', 'guard'];
}

async function claimMainToWhiskerBonus(supabase: any, userId: string): Promise<number> {
  if (!FEATURES.CROSS_MODE_V2) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const dayStart = `${today}T00:00:00.000Z`;
  const bonusKey = `cross_mode_whisker_bonus:${today}`;
  const bonusSigils = 25;

  const { data: already } = await supabase
    .from('user_reward_claims')
    .select('reward_key')
    .eq('user_id', userId)
    .eq('reward_key', bonusKey)
    .maybeSingle();
  if (already?.reward_key) return 0;

  const { count } = await supabase
    .from('votes')
    .select('id', { count: 'exact', head: true })
    .eq('voter_user_id', userId)
    .gte('created_at', dayStart);
  if (Number(count || 0) < 3) return 0;

  const { error: claimErr } = await supabase
    .from('user_reward_claims')
    .insert({ user_id: userId, reward_key: bonusKey, reward_sigils: bonusSigils });
  if (claimErr) return 0;

  const { data: prog } = await supabase
    .from('user_progress')
    .select('sigils')
    .eq('user_id', userId)
    .maybeSingle();
  await supabase
    .from('user_progress')
    .update({ sigils: Number(prog?.sigils || 0) + bonusSigils })
    .eq('user_id', userId);
  return bonusSigils;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getGuestId();
    const body = await request.json().catch(() => ({}));
    const snapshotId = String(body?.snapshot_id || '').trim();
    const preferredNpcCatId = String(body?.opponent_cat_id || '').trim();

    if (!snapshotId) return NextResponse.json({ ok: false, error: 'Missing snapshot_id' }, { status: 400 });

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    await supabase.rpc('bootstrap_user', { p_user_id: userId });
    const crossModeBonus = await claimMainToWhiskerBonus(supabase, userId);

    const { data: existing } = await supabase
      .from('arena_matches')
      .select('id, summary')
      .eq('challenger_user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      return NextResponse.json({ ok: true, match_id: existing.id, state: existing.summary?.state || null, resumed: true });
    }

    const { data: mySnap, error: myErr } = await supabase
      .from('arena_snapshots')
      .select('id, user_id, cat_id, cat_name, ai_behavior, skill_priority, snapshot_stats')
      .eq('id', snapshotId)
      .maybeSingle();

    if (myErr) {
      const msg = myErr.message || 'Snapshot lookup failed';
      const lower = msg.toLowerCase();
      if (lower.includes('could not find the table') || lower.includes('arena_snapshots')) {
        return NextResponse.json({ ok: false, error: 'Whisker Arena is not initialized. Run migration 016 first.' }, { status: 503 });
      }
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }

    if (!mySnap) return NextResponse.json({ ok: false, error: 'Snapshot not found' }, { status: 404 });
    if ((mySnap as SnapshotRow).user_id !== userId) {
      return NextResponse.json({ ok: false, error: 'Not your snapshot' }, { status: 403 });
    }

    let opponentSnapshot: SnapshotRow | null = null;
    let opponentCatId: string | null = null;
    let opponentName: string | null = null;
    let opponentUserId: string | null = null;

    if (!preferredNpcCatId) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: recentRows } = await supabase
        .from('arena_matches')
        .select('snapshot_b_id')
        .eq('challenger_user_id', userId)
        .gte('created_at', oneDayAgo)
        .not('snapshot_b_id', 'is', null)
        .limit(200);
      const recentOpponentSnapshotIds = new Set((recentRows || []).map((r: any) => String(r.snapshot_b_id || '')).filter(Boolean));

      const { data: oppSnaps } = await supabase
        .from('arena_snapshots')
        .select('id, user_id, cat_id, cat_name, ai_behavior, skill_priority, snapshot_stats')
        .neq('user_id', userId)
        .eq('active', true)
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(80);

      if (oppSnaps && oppSnaps.length > 0) {
        const filtered = (oppSnaps as SnapshotRow[]).filter((s) => !recentOpponentSnapshotIds.has(String(s.id)));
        const pool = filtered.length > 0 ? filtered : (oppSnaps as SnapshotRow[]);
        opponentSnapshot = pool[Math.floor(Math.random() * pool.length)] as SnapshotRow;
        opponentCatId = opponentSnapshot.cat_id;
        opponentName = opponentSnapshot.cat_name;
        opponentUserId = opponentSnapshot.user_id;
      }
    }

    if (!opponentSnapshot) {
      const { data: myRating } = await supabase
        .from('arena_ratings')
        .select('rating')
        .eq('user_id', userId)
        .maybeSingle();
      const rating = Number(myRating?.rating || 1000);
      const powerBand = rating >= 1450 ? [58, 100] : rating >= 1250 ? [52, 84] : rating >= 1100 ? [46, 72] : [36, 62];

      let targeted: {
        id: string;
        name: string;
        rarity: string | null;
        attack: number | null;
        defense: number | null;
        speed: number | null;
        charisma: number | null;
        chaos: number | null;
      } | null = null;
      if (preferredNpcCatId) {
        const { data: targetedCat } = await supabase
          .from('cats')
          .select('id, name, rarity, attack, defense, speed, charisma, chaos')
          .eq('id', preferredNpcCatId)
          .eq('status', 'approved')
          .neq('user_id', userId)
          .maybeSingle();
        targeted = targetedCat || null;
      }

      const { data: npcCats } = await supabase
        .from('cats')
        .select('id, name, rarity, attack, defense, speed, charisma, chaos, power')
        .eq('status', 'approved')
        .neq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(120);

      const inBand = (c: {
        attack: number | null;
        defense: number | null;
        speed: number | null;
        charisma: number | null;
        chaos: number | null;
        power?: number | null;
      }) => {
        const dbPower = Number(c.power || 0);
        const computedPower = Math.round(
          Number(c.attack || 0) * 0.24 +
          Number(c.defense || 0) * 0.24 +
          Number(c.speed || 0) * 0.2 +
          Number(c.charisma || 0) * 0.16 +
          Number(c.chaos || 0) * 0.16
        );
        const p = dbPower > 0 ? dbPower : computedPower;
        return p >= powerBand[0] && p <= powerBand[1];
      };

      const list = (npcCats || []).filter(inBand);
      const pick = targeted || list[Math.floor(Math.random() * Math.max(1, list.length))];

      if (!pick) return NextResponse.json({ ok: false, error: 'No opponent available' }, { status: 400 });

      const stats = {
        attack: Number(pick.attack || 45),
        defense: Number(pick.defense || 45),
        speed: Number(pick.speed || 45),
        charisma: Number(pick.charisma || 45),
        chaos: Number(pick.chaos || 45),
      };

      opponentSnapshot = {
        id: 'bot',
        user_id: 'bot',
        cat_id: pick.id,
        cat_name: pick.name,
        ai_behavior: npcBehaviorFromStats(stats),
        skill_priority: npcPriorityFromStats(stats),
        snapshot_stats: {
          ...stats,
          rarity: pick.rarity || 'Common',
          owner_level: 1,
        },
      };
      opponentCatId = pick.id;
      opponentName = pick.name;
    }

    const seed = randomSeed();
    const weeklyModifier = getActiveWhiskerModifier().key;
    const state = createBattleState({
      fighterA: {
        slot: 'a',
        label: (mySnap as SnapshotRow).cat_name,
        ai_behavior: (mySnap as SnapshotRow).ai_behavior,
        skill_priority: (mySnap as SnapshotRow).skill_priority || ['strike', 'guard', 'control', 'burst'],
        stats: (mySnap as SnapshotRow).snapshot_stats,
      },
      fighterB: {
        slot: 'b',
        label: opponentSnapshot.cat_name,
        ai_behavior: opponentSnapshot.ai_behavior,
        skill_priority: opponentSnapshot.skill_priority || ['strike', 'guard', 'control', 'burst'],
        stats: opponentSnapshot.snapshot_stats,
      },
      seed,
      weeklyModifier,
    });

    const { data: match, error: matchErr } = await supabase
      .from('arena_matches')
      .insert({
        challenger_user_id: userId,
        snapshot_a_id: (mySnap as SnapshotRow).id,
        snapshot_b_id: opponentSnapshot.id === 'bot' ? null : opponentSnapshot.id,
        opponent_cat_id: opponentCatId,
        opponent_name: opponentName,
        status: 'active',
        turns: 0,
        seed,
        rating_delta: 0,
        summary: {
          mode: 'interactive',
          state,
          opponent_user_id: opponentUserId,
          opponent_profile: opponentSnapshot.ai_behavior,
          weekly_modifier: weeklyModifier,
        },
      })
      .select('id, summary')
      .maybeSingle();

    if (matchErr || !match) {
      const msg = matchErr?.message || 'Start failed';
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }

    await trackWhiskerEvent(supabase, userId, 'whisker_match_start', {
      match_id: match.id,
      ai_profile: opponentSnapshot.ai_behavior,
      weekly_modifier: weeklyModifier,
      mode: 'interactive',
    });

    return NextResponse.json({
      ok: true,
      match_id: match.id,
      state,
      cross_mode_bonus: crossModeBonus,
      actions: {
        strike: actionCost('strike'),
        guard: actionCost('guard'),
        control: actionCost('control'),
        burst: actionCost('burst'),
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
