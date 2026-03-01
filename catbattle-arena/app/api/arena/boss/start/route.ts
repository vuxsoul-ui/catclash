import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../../_lib/guest';
import { createBattleState, type ArenaAction, type ArenaBehavior } from '../../../_lib/arena-engine';
import { FEATURES } from '../../../_lib/flags';
import { getActiveWhiskerModifier } from '../../../_lib/whisker-modifier';
import { trackWhiskerEvent } from '../../../_lib/whisker-telemetry';

export const dynamic = 'force-dynamic';

const REWARD_SIGILS = 25;

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

type SnapshotRow = {
  id: string;
  user_id: string;
  cat_id: string;
  cat_name: string;
  ai_behavior: ArenaBehavior;
  skill_priority: ArenaAction[];
  snapshot_stats: { attack: number; defense: number; speed: number; charisma: number; chaos: number; rarity?: string; owner_level?: number };
};

function randomSeed() {
  return Math.floor(Math.random() * 1_000_000_000);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function seededIndex(size: number, seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0) % Math.max(1, size);
}

type BossModifier = 'high_chaos' | 'shielded' | 'fast_start';

function bossModifierForDay(today: string): BossModifier {
  const mods: BossModifier[] = ['high_chaos', 'shielded', 'fast_start'];
  return mods[seededIndex(mods.length, `boss:modifier:${today}`)];
}

function applyBossModifier(
  stats: { attack: number; defense: number; speed: number; charisma: number; chaos: number; rarity: string; owner_level: number },
  modifier: BossModifier | null
) {
  if (!modifier) return stats;
  const next = { ...stats };
  if (modifier === 'high_chaos') next.chaos = Math.round(next.chaos * 1.2);
  if (modifier === 'shielded') next.defense = Math.round(next.defense * 1.15);
  if (modifier === 'fast_start') next.speed = Math.round(next.speed * 1.2);
  return next;
}

async function claimMainToWhiskerBonus(userId: string): Promise<number> {
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

    if (!snapshotId) return NextResponse.json({ ok: false, error: 'Missing snapshot_id' }, { status: 400 });
    await supabase.rpc('bootstrap_user', { p_user_id: userId });
    const crossModeBonus = await claimMainToWhiskerBonus(userId);

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

    const { data: mySnap } = await supabase
      .from('arena_snapshots')
      .select('id, user_id, cat_id, cat_name, ai_behavior, skill_priority, snapshot_stats')
      .eq('id', snapshotId)
      .maybeSingle();

    if (!mySnap) return NextResponse.json({ ok: false, error: 'Snapshot not found' }, { status: 404 });
    if ((mySnap as SnapshotRow).user_id !== userId) return NextResponse.json({ ok: false, error: 'Not your snapshot' }, { status: 403 });

    const today = todayKey();
    const bossModifier = FEATURES.DAILY_BOSS_V2 ? bossModifierForDay(today) : null;
    const { data: cats } = await supabase
      .from('cats')
      .select('id, name, rarity, attack, defense, speed, charisma, chaos')
      .eq('status', 'approved')
      .neq('user_id', userId)
      .order('id', { ascending: true })
      .limit(500);

    if (!cats || cats.length === 0) return NextResponse.json({ ok: false, error: 'No boss candidates' }, { status: 404 });

    const bossBase = cats[seededIndex(cats.length, `boss:${today}`)];
    const boost = 1.12;
    const bossStatsBase = {
      attack: Math.round(Number(bossBase.attack || 45) * boost),
      defense: Math.round(Number(bossBase.defense || 45) * boost),
      speed: Math.round(Number(bossBase.speed || 45) * boost),
      charisma: Math.round(Number(bossBase.charisma || 45) * boost),
      chaos: Math.round(Number(bossBase.chaos || 45) * boost),
      rarity: bossBase.rarity || 'Legendary',
      owner_level: 1,
    };
    const bossStats = applyBossModifier(bossStatsBase, bossModifier);

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
        label: `Daily Boss: ${bossBase.name}`,
        ai_behavior: 'aggressive',
        skill_priority: ['burst', 'control', 'strike', 'guard'],
        stats: bossStats,
      },
      seed: randomSeed(),
      weeklyModifier,
    });

    const { data: match, error: matchErr } = await supabase
      .from('arena_matches')
      .insert({
        challenger_user_id: userId,
        snapshot_a_id: (mySnap as SnapshotRow).id,
        snapshot_b_id: null,
        opponent_cat_id: bossBase.id,
        opponent_name: `Daily Boss: ${bossBase.name}`,
        status: 'active',
        turns: 0,
        seed: randomSeed(),
        rating_delta: 0,
        summary: {
          mode: 'daily_boss',
          boss_date: today,
          boss_reward_sigils: REWARD_SIGILS,
          boss_modifier: bossModifier,
          weekly_modifier: weeklyModifier,
          state,
          boss_cat_id: bossBase.id,
        },
      })
      .select('id')
      .maybeSingle();

    if (matchErr || !match) return NextResponse.json({ ok: false, error: matchErr?.message || 'Start failed' }, { status: 500 });

    await trackWhiskerEvent(supabase, userId, 'whisker_daily_boss_attempt', {
      match_id: match.id,
      boss_id: bossBase.id,
      boss_modifier: bossModifier,
      weekly_modifier: weeklyModifier,
    });

    return NextResponse.json({ ok: true, match_id: match.id, state, boss_name: bossBase.name, reward_sigils: REWARD_SIGILS, boss_modifier: bossModifier, cross_mode_bonus: crossModeBonus });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
