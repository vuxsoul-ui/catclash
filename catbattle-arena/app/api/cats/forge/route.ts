import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireGuestId } from '../../_lib/guest';
import { FORGE_COST_BY_RARITY, nextRarity } from '../../_lib/cat-progression';
import { normalizeStatsForRarity, rarityBounds } from '../../_lib/stat-balance';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const sb = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const FORGE_DAILY_LIMIT = 3;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(v)));
}

export async function POST(req: NextRequest) {
  try {
    let userId = '';
    try {
      userId = await requireGuestId();
    } catch {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    await sb.rpc('bootstrap_user', { p_user_id: userId });
    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body?.cat_ids) ? body.cat_ids.map((v: unknown) => String(v || '').trim()).filter(Boolean) : [];
    if (ids.length !== 3) {
      return NextResponse.json({ ok: false, error: 'Select exactly 3 cats to forge' }, { status: 400 });
    }
    if (new Set(ids).size !== 3) {
      return NextResponse.json({ ok: false, error: 'Duplicate cat in forge inputs' }, { status: 400 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const limitKey = `forge_daily:${userId}:${today}`;
    const { data: rl } = await sb.from('rate_limits').select('count').eq('key', limitKey).maybeSingle();
    const used = Math.max(0, Number(rl?.count || 0));
    if (used >= FORGE_DAILY_LIMIT) {
      return NextResponse.json({ ok: false, error: `Forge limit reached (${FORGE_DAILY_LIMIT}/day)` }, { status: 429 });
    }

    const { data: cats, error: catsErr } = await sb
      .from('cats')
      .select('id, user_id, name, image_path, rarity, attack, defense, speed, charisma, chaos, cat_level, status')
      .in('id', ids);
    if (catsErr) return NextResponse.json({ ok: false, error: catsErr.message }, { status: 500 });
    if ((cats || []).length !== 3) return NextResponse.json({ ok: false, error: 'Some cats were not found' }, { status: 404 });
    if ((cats || []).some((c) => String(c.user_id || '') !== userId)) {
      return NextResponse.json({ ok: false, error: 'You can only forge your own cats' }, { status: 403 });
    }
    if ((cats || []).some((c) => String(c.status || '') === 'pending')) {
      return NextResponse.json({ ok: false, error: 'Pending cats cannot be forged yet' }, { status: 400 });
    }

    const baseRarity = String(cats?.[0]?.rarity || 'Common');
    if ((cats || []).some((c) => String(c.rarity || '') !== baseRarity)) {
      return NextResponse.json({ ok: false, error: 'All 3 cats must be the same rarity' }, { status: 400 });
    }
    const outputRarity = nextRarity(baseRarity);
    if (!outputRarity) {
      return NextResponse.json({ ok: false, error: 'This rarity cannot be forged higher in Phase 1' }, { status: 400 });
    }

    if ((cats || []).some((c) => Number(c.cat_level || 1) < 5)) {
      return NextResponse.json({ ok: false, error: 'Each forge input must be at least cat level 5' }, { status: 400 });
    }

    const cost = FORGE_COST_BY_RARITY[baseRarity] || 100;
    const { data: prog } = await sb.from('user_progress').select('sigils').eq('user_id', userId).maybeSingle();
    const sigils = Math.max(0, Number(prog?.sigils || 0));
    if (sigils < cost) {
      return NextResponse.json({ ok: false, error: `Need ${cost} sigils to forge` }, { status: 400 });
    }

    const { data: activeRefs } = await sb
      .from('tournament_matches')
      .select('id')
      .or(`cat_a_id.in.(${ids.join(',')}),cat_b_id.in.(${ids.join(',')})`)
      .eq('status', 'active')
      .limit(1);
    if ((activeRefs || []).length > 0) {
      return NextResponse.json({ ok: false, error: 'Cannot forge cats that are currently in active arena matches' }, { status: 400 });
    }

    const avg = (key: 'attack' | 'defense' | 'speed' | 'charisma' | 'chaos') =>
      (cats || []).reduce((sum, c) => sum + Math.max(0, Number(c[key] || 0)), 0) / 3;
    const bounds = rarityBounds(outputRarity);
    const baseBoost = Math.max(2, Math.round((bounds.max - bounds.min) * 0.12));
    const jitter = () => (Math.random() * 8 - 3);
    const forgedRaw = {
      attack: clamp(avg('attack') + baseBoost + jitter(), bounds.min, bounds.max),
      defense: clamp(avg('defense') + baseBoost + jitter(), bounds.min, bounds.max),
      speed: clamp(avg('speed') + baseBoost + jitter(), bounds.min, bounds.max),
      charisma: clamp(avg('charisma') + baseBoost + jitter(), bounds.min, bounds.max),
      chaos: clamp(avg('chaos') + baseBoost + jitter(), bounds.min, bounds.max),
    };
    const forgedStats = normalizeStatsForRarity(outputRarity, forgedRaw);

    const topInput = [...(cats || [])].sort((a, b) => Number(b.cat_level || 1) - Number(a.cat_level || 1))[0];
    const forgedName = `Forged ${String(topInput?.name || 'Cat').slice(0, 20)}`;
    const forgedLevel = Math.max(1, Number(topInput?.cat_level || 1) - 2);

    const nextSigils = sigils - cost;
    const { error: sigErr } = await sb.from('user_progress').update({ sigils: nextSigils }).eq('user_id', userId);
    if (sigErr) return NextResponse.json({ ok: false, error: sigErr.message }, { status: 500 });

    const { data: created, error: createErr } = await sb
      .from('cats')
      .insert({
        user_id: userId,
        name: forgedName,
        image_path: topInput?.image_path || null,
        rarity: outputRarity,
        attack: forgedStats.attack,
        defense: forgedStats.defense,
        speed: forgedStats.speed,
        charisma: forgedStats.charisma,
        chaos: forgedStats.chaos,
        ability: 'Forgeborn',
        power: 'Forgeborn',
        cat_level: forgedLevel,
        cat_xp: 0,
        level: forgedLevel,
        xp: 0,
        status: 'approved',
        image_review_status: topInput?.image_path ? 'approved' : 'pending_review',
        description: `Forged from 3 ${baseRarity} cats`,
        origin: 'submitted',
      })
      .select('id, name, rarity, cat_level, attack, defense, speed, charisma, chaos')
      .single();
    if (createErr || !created) {
      await sb.from('user_progress').update({ sigils }).eq('user_id', userId);
      return NextResponse.json({ ok: false, error: createErr?.message || 'Forge failed' }, { status: 500 });
    }

    const { error: delErr } = await sb.from('cats').delete().in('id', ids);
    if (delErr) {
      await sb.from('cats').delete().eq('id', created.id);
      await sb.from('user_progress').update({ sigils }).eq('user_id', userId);
      return NextResponse.json({ ok: false, error: `Forge failed to consume inputs: ${delErr.message}` }, { status: 500 });
    }

    await Promise.all([
      sb.from('cat_forge_history').insert({
        user_id: userId,
        input_cat_ids: ids,
        output_cat_id: created.id,
        input_rarity: baseRarity,
        output_rarity: outputRarity,
        sigil_cost: cost,
      }),
      sb.from('rate_limits').upsert({ key: limitKey, count: used + 1, window_start: `${today}T00:00:00.000Z` }, { onConflict: 'key' }),
    ]);

    return NextResponse.json({
      ok: true,
      forged_cat: created,
      consumed_cat_ids: ids,
      sigils_after: nextSigils,
      forge_cost: cost,
      daily_used: used + 1,
      daily_limit: FORGE_DAILY_LIMIT,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
