import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { FEATURES } from '../../_lib/flags';
import { resolveCatImageUrl } from '../../_lib/images';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function daysAgoIso(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export async function GET() {
  try {
    if (!FEATURES.SOCIAL_LOOP_V2) {
      return NextResponse.json({ ok: true, enabled: false, rivalries: [] });
    }

    const since = daysAgoIso(21);
    const { data: rows, error } = await supabase
      .from('tournament_matches')
      .select('id, cat_a_id, cat_b_id, winner_id, created_at')
      .eq('status', 'complete')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const pairMap: Record<string, {
      cat_a_id: string;
      cat_b_id: string;
      battles: number;
      cat_a_wins: number;
      cat_b_wins: number;
      latest_match_id: string;
      latest_at: string;
    }> = {};

    for (const r of rows || []) {
      const a = String(r.cat_a_id || '').trim();
      const b = String(r.cat_b_id || '').trim();
      if (!a || !b || a === b) continue;
      const sorted = [a, b].sort();
      const key = `${sorted[0]}:${sorted[1]}`;
      if (!pairMap[key]) {
        pairMap[key] = {
          cat_a_id: sorted[0],
          cat_b_id: sorted[1],
          battles: 0,
          cat_a_wins: 0,
          cat_b_wins: 0,
          latest_match_id: String(r.id),
          latest_at: String(r.created_at || ''),
        };
      }
      pairMap[key].battles += 1;
      const winner = String(r.winner_id || '');
      if (winner === pairMap[key].cat_a_id) pairMap[key].cat_a_wins += 1;
      if (winner === pairMap[key].cat_b_id) pairMap[key].cat_b_wins += 1;
    }

    const pairs = Object.values(pairMap)
      .sort((x, y) => {
        if (y.battles !== x.battles) return y.battles - x.battles;
        if (y.latest_at !== x.latest_at) return y.latest_at.localeCompare(x.latest_at);
        return `${x.cat_a_id}:${x.cat_b_id}`.localeCompare(`${y.cat_a_id}:${y.cat_b_id}`);
      })
      .slice(0, 6);

    if (pairs.length === 0) return NextResponse.json({ ok: true, enabled: true, rivalries: [] });

    const catIds = Array.from(new Set(pairs.flatMap((p) => [p.cat_a_id, p.cat_b_id])));
    const { data: cats } = await supabase
      .from('cats')
      .select('id, name, image_path, image_review_status')
      .in('id', catIds);

    const catMap: Record<string, { id: string; name: string; image_url: string | null }> = {};
    for (const c of cats || []) {
      catMap[c.id] = {
        id: c.id,
        name: c.name || 'Unknown',
        image_url: await resolveCatImageUrl(supabase, c.image_path, c.image_review_status || null),
      };
    }

    const rivalries = pairs
      .filter((p) => !!catMap[p.cat_a_id] && !!catMap[p.cat_b_id] && p.cat_a_id !== p.cat_b_id)
      .map((p) => ({
        battles: p.battles,
        latest_match_id: p.latest_match_id,
        episode: p.battles >= 6 ? 'legendary' : p.battles >= 3 ? 'heated' : 'fresh',
        cat_a: {
          ...(catMap[p.cat_a_id] || { id: p.cat_a_id, name: 'Unknown', image_url: '/cat-placeholder.svg' }),
          wins: p.cat_a_wins,
        },
        cat_b: {
          ...(catMap[p.cat_b_id] || { id: p.cat_b_id, name: 'Unknown', image_url: '/cat-placeholder.svg' }),
          wins: p.cat_b_wins,
        },
      }));

    return NextResponse.json({ ok: true, enabled: true, rivalries });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
