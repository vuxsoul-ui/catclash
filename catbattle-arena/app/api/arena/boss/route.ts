import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../_lib/guest';
import { resolveCatImageUrl } from '../../_lib/images';
import { FEATURES } from '../../_lib/flags';
import { getActiveWhiskerModifier } from '../../_lib/whisker-modifier';

export const dynamic = 'force-dynamic';

const REWARD_SIGILS = 25;

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

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

export async function GET() {
  try {
    const userId = await getGuestId();
    const today = todayKey();

    const { data: cats } = await supabase
      .from('cats')
      .select('id, name, rarity, image_path, image_review_status, attack, defense, speed, charisma, chaos')
      .eq('status', 'approved')
      .neq('user_id', userId)
      .order('id', { ascending: true })
      .limit(500);

    if (!cats || cats.length === 0) {
      return NextResponse.json({ ok: false, error: 'No boss candidates yet' }, { status: 404 });
    }

    const idx = seededIndex(cats.length, `boss:${today}`);
    const boss = cats[idx];
    const rewardKey = `daily_boss_win:${today}`;
    const { data: claimed } = await supabase
      .from('user_reward_claims')
      .select('reward_key')
      .eq('user_id', userId)
      .eq('reward_key', rewardKey)
      .maybeSingle();

    let clearStreak = 0;
    if (FEATURES.DAILY_BOSS_V2) {
      const { data: progress, error: progErr } = await supabase
        .from('daily_boss_progress')
        .select('clear_streak')
        .eq('user_id', userId)
        .maybeSingle();
      if (!progErr && progress) {
        clearStreak = Math.max(0, Number(progress.clear_streak || 0));
      }
    }

    const bossModifier = FEATURES.DAILY_BOSS_V2 ? bossModifierForDay(today) : null;

    const weeklyModifier = getActiveWhiskerModifier();

    return NextResponse.json({
      ok: true,
      today,
      reward_sigils: REWARD_SIGILS,
      claimed: !!claimed,
      clear_streak: clearStreak,
      boss_modifier: bossModifier,
      first_clear_today: !claimed,
      reward_applied: !!claimed,
      weekly_modifier: weeklyModifier,
      boss: {
        id: boss.id,
        name: boss.name,
        rarity: boss.rarity || 'Common',
        image_url: await resolveCatImageUrl(supabase, boss.image_path, boss.image_review_status || null),
        stats: {
          attack: Number(boss.attack || 45),
          defense: Number(boss.defense || 45),
          speed: Number(boss.speed || 45),
          charisma: Number(boss.charisma || 45),
          chaos: Number(boss.chaos || 45),
        },
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
