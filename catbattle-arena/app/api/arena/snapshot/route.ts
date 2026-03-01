import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../_lib/guest';
import { trackWhiskerEvent } from '../../_lib/whisker-telemetry';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim();

const ALLOWED_BEHAVIORS = new Set(['aggressive', 'defensive', 'tactical', 'chaotic', 'turtle', 'trickster']);
const ALLOWED_SKILLS = new Set(['strike', 'guard', 'control', 'burst', 'heal', 'bleed', 'stun']);

function normalizePriority(input: unknown): string[] {
  const arr = Array.isArray(input) ? input : ['strike', 'guard', 'control', 'burst'];
  const cleaned = arr
    .map((x) => String(x || '').trim().toLowerCase())
    .filter((x) => ALLOWED_SKILLS.has(x));
  return cleaned.length ? cleaned.slice(0, 5) : ['strike', 'guard', 'control', 'burst'];
}

function normalizeBehavior(input: unknown): string {
  const v = String(input || 'tactical').trim().toLowerCase();
  if (v === 'turtle') return 'turtle';
  if (v === 'trickster') return 'trickster';
  if (v === 'defensive') return 'turtle';
  if (v === 'chaotic') return 'trickster';
  if (v === 'aggressive') return 'aggressive';
  return 'tactical';
}

function rarityMultiplier(rarity: string): number {
  const r = String(rarity || '').toLowerCase();
  if (r === 'legendary') return 1.08;
  if (r === 'epic') return 1.05;
  if (r === 'rare') return 1.03;
  if (r === 'mythic' || r === 'god-tier') return 1.1;
  return 1.0;
}

function scaledStat(base: number, level: number, rarity: string): number {
  const lvlBonus = Math.min(0.18, Math.max(0, level - 1) * 0.008);
  const mult = rarityMultiplier(rarity) + lvlBonus;
  return Math.max(1, Math.round(base * mult));
}

export async function GET() {
  try {
    const userId = await getGuestId();
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await supabase
      .from('arena_snapshots')
      .select('id, cat_id, cat_name, ai_behavior, skill_priority, created_at, active')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) {
      const msg = error.message || 'Snapshot list failed';
      if (msg.toLowerCase().includes('could not find the table') || msg.toLowerCase().includes('arena_snapshots')) {
        return NextResponse.json({ ok: false, error: 'Whisker Arena is not initialized. Run migration 016 first.' }, { status: 503 });
      }
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
    const rows = (data || []) as Array<any>;
    const byCatCount: Record<string, number> = {};
    const withVersion = [...rows]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((row) => {
        byCatCount[row.cat_id] = (byCatCount[row.cat_id] || 0) + 1;
        return { ...row, snapshot_version: byCatCount[row.cat_id] };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ ok: true, snapshots: withVersion });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getGuestId();
    const body = await request.json().catch(() => ({}));
    const catId = String(body?.cat_id || '').trim();
    const aiBehavior = normalizeBehavior(body?.ai_behavior);
    const skillPriority = normalizePriority(body?.skill_priority);

    if (!catId) return NextResponse.json({ ok: false, error: 'Missing cat_id' }, { status: 400 });
    if (!ALLOWED_BEHAVIORS.has(aiBehavior)) return NextResponse.json({ ok: false, error: 'Invalid ai_behavior' }, { status: 400 });

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await supabase.rpc('bootstrap_user', { p_user_id: userId });

    const { data: cat, error: catErr } = await supabase
      .from('cats')
      .select('id, user_id, name, rarity, ability, attack, defense, speed, charisma, chaos')
      .eq('id', catId)
      .maybeSingle();
    if (catErr || !cat) return NextResponse.json({ ok: false, error: 'Cat not found' }, { status: 404 });
    if (cat.user_id !== userId) return NextResponse.json({ ok: false, error: 'Not your cat' }, { status: 403 });

    const { data: ownerProgress } = await supabase
      .from('user_progress')
      .select('level')
      .eq('user_id', userId)
      .maybeSingle();
    const ownerLevel = Math.max(1, Number(ownerProgress?.level || 1));

    const payload = {
      user_id: userId,
      cat_id: cat.id,
      cat_name: cat.name,
      ai_behavior: aiBehavior,
      skill_priority: skillPriority,
      snapshot_stats: {
        attack: scaledStat(Number(cat.attack || 0), ownerLevel, String(cat.rarity || 'Common')),
        defense: scaledStat(Number(cat.defense || 0), ownerLevel, String(cat.rarity || 'Common')),
        speed: scaledStat(Number(cat.speed || 0), ownerLevel, String(cat.rarity || 'Common')),
        charisma: scaledStat(Number(cat.charisma || 0), ownerLevel, String(cat.rarity || 'Common')),
        chaos: scaledStat(Number(cat.chaos || 0), ownerLevel, String(cat.rarity || 'Common')),
        rarity: cat.rarity || 'Common',
        ability: cat.ability || null,
        owner_level: ownerLevel,
      },
      active: true,
    };

    const { count: previousCount } = await supabase
      .from('arena_snapshots')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('cat_id', cat.id);

    const { data: inserted, error } = await supabase
      .from('arena_snapshots')
      .insert(payload)
      .select('id, cat_id, cat_name, ai_behavior, skill_priority, created_at, active')
      .maybeSingle();
    if (error) {
      const msg = error.message || 'Snapshot failed';
      if (msg.toLowerCase().includes('relation') && msg.toLowerCase().includes('arena_snapshots')) {
        return NextResponse.json({ ok: false, error: 'Whisker Arena is not initialized. Run migration 016 first.' }, { status: 503 });
      }
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
    await trackWhiskerEvent(supabase, userId, 'whisker_snapshot_publish', {
      snapshot_id: inserted?.id || null,
      ai_behavior: aiBehavior,
      cat_id: cat.id,
    });
    return NextResponse.json({
      ok: true,
      snapshot: {
        ...inserted,
        snapshot_version: Math.max(1, Number(previousCount || 0) + 1),
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
