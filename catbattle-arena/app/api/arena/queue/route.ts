import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../_lib/guest';
import { ratingTier, simulateArenaBattle } from '../../_lib/arena-engine';

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
  ai_behavior: 'aggressive' | 'defensive' | 'tactical' | 'chaotic';
  skill_priority: string[];
  snapshot_stats: {
    attack: number;
    defense: number;
    speed: number;
    charisma: number;
    chaos: number;
    rarity?: string;
    owner_level?: number;
    ability?: string | null;
  };
};

function randomSeed() {
  return Math.floor(Math.random() * 1_000_000_000);
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
    if ((mySnap as SnapshotRow).user_id !== userId) return NextResponse.json({ ok: false, error: 'Not your snapshot' }, { status: 403 });

    let opponentSnapshot: SnapshotRow | null = null;
    let opponentCatId: string | null = null;
    let opponentName: string | null = null;
    let opponentUserId: string | null = null;

    if (!preferredNpcCatId) {
      const { data: oppSnaps } = await supabase
        .from('arena_snapshots')
        .select('id, user_id, cat_id, cat_name, ai_behavior, skill_priority, snapshot_stats')
        .neq('user_id', userId)
        .eq('active', true)
        .limit(20);
      if (oppSnaps && oppSnaps.length > 0) {
        opponentSnapshot = oppSnaps[Math.floor(Math.random() * oppSnaps.length)] as SnapshotRow;
        opponentCatId = opponentSnapshot.cat_id;
        opponentName = opponentSnapshot.cat_name;
        opponentUserId = opponentSnapshot.user_id;
      }
    }

    if (!opponentSnapshot) {
      const { data: npcCats } = await supabase
        .from('cats')
        .select('id, name, rarity, attack, defense, speed, charisma, chaos')
        .eq('status', 'approved')
        .neq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);
      const list = npcCats || [];
      const pick = preferredNpcCatId
        ? list.find((c) => c.id === preferredNpcCatId)
        : list[Math.floor(Math.random() * Math.max(1, list.length))];
      if (!pick) return NextResponse.json({ ok: false, error: 'No opponent available' }, { status: 400 });
      opponentSnapshot = {
        id: 'bot',
        user_id: 'bot',
        cat_id: pick.id,
        cat_name: pick.name,
        ai_behavior: 'aggressive',
        skill_priority: ['strike', 'guard', 'control', 'burst'],
        snapshot_stats: {
          attack: Number(pick.attack || 45),
          defense: Number(pick.defense || 45),
          speed: Number(pick.speed || 45),
          charisma: Number(pick.charisma || 45),
          chaos: Number(pick.chaos || 45),
          rarity: pick.rarity || 'Common',
          owner_level: 1,
        },
      };
      opponentCatId = pick.id;
      opponentName = pick.name;
    }

    const seed = randomSeed();
    const result = simulateArenaBattle({
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
    });

    const myWon = result.winner_slot === 'a';
    const ratingDelta = myWon ? 15 : -10;

    const { data: match, error: matchErr } = await supabase
      .from('arena_matches')
      .insert({
        challenger_user_id: userId,
        snapshot_a_id: (mySnap as SnapshotRow).id,
        snapshot_b_id: opponentSnapshot.id === 'bot' ? null : opponentSnapshot.id,
        opponent_cat_id: opponentCatId,
        opponent_name: opponentName,
        winner_snapshot_id: result.winner_slot === 'a' ? (mySnap as SnapshotRow).id : (opponentSnapshot.id === 'bot' ? null : opponentSnapshot.id),
        winner_cat_id: result.winner_slot === 'a' ? (mySnap as SnapshotRow).cat_id : opponentCatId,
        status: 'complete',
        turns: result.turns,
        seed,
        rating_delta: ratingDelta,
        summary: {
          final_hp_a: result.final_hp_a,
          final_hp_b: result.final_hp_b,
        },
      })
      .select('id')
      .maybeSingle();

    if (matchErr || !match) {
      const msg = matchErr?.message || 'Queue failed';
      if (msg.toLowerCase().includes('relation') && msg.toLowerCase().includes('arena_matches')) {
        return NextResponse.json({ ok: false, error: 'Whisker Arena is not initialized. Run migration 016 first.' }, { status: 503 });
      }
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }

    if (result.events.length > 0) {
      await supabase.from('arena_events').insert(
        result.events.map((e) => ({
          match_id: match.id,
          turn_no: e.turn_no,
          actor_slot: e.actor_slot,
          action_type: e.action_type,
          value: e.value,
          payload: e.payload,
        }))
      );
    }

    const { data: meRating } = await supabase.from('arena_ratings').select('rating, wins, losses').eq('user_id', userId).maybeSingle();
    const nextMeRating = Number(meRating?.rating || 1000) + ratingDelta;
    await supabase.from('arena_ratings').upsert({
      user_id: userId,
      rating: nextMeRating,
      tier: ratingTier(nextMeRating),
      wins: Number(meRating?.wins || 0) + (myWon ? 1 : 0),
      losses: Number(meRating?.losses || 0) + (myWon ? 0 : 1),
      updated_at: new Date().toISOString(),
      last_match_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    if (opponentUserId) {
      const oppDelta = -ratingDelta;
      const { data: oppRating } = await supabase.from('arena_ratings').select('rating, wins, losses').eq('user_id', opponentUserId).maybeSingle();
      const nextOppRating = Number(oppRating?.rating || 1000) + oppDelta;
      await supabase.from('arena_ratings').upsert({
        user_id: opponentUserId,
        rating: nextOppRating,
        tier: ratingTier(nextOppRating),
        wins: Number(oppRating?.wins || 0) + (myWon ? 0 : 1),
        losses: Number(oppRating?.losses || 0) + (myWon ? 1 : 0),
        updated_at: new Date().toISOString(),
        last_match_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    }

    return NextResponse.json({
      ok: true,
      match_id: match.id,
      winner_slot: result.winner_slot,
      turns: result.turns,
      rating_delta: ratingDelta,
      final_hp_a: result.final_hp_a,
      final_hp_b: result.final_hp_b,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
