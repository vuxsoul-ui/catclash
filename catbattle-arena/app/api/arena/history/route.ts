import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../_lib/guest';
import { resolveCatImageUrl } from '../../_lib/images';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim();

export async function GET() {
  try {
    const userId = await getGuestId();
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: matches, error } = await supabase
      .from('arena_matches')
      .select('id, challenger_user_id, snapshot_a_id, opponent_cat_id, opponent_name, winner_snapshot_id, status, turns, rating_delta, summary, created_at')
      .eq('challenger_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) {
      const msg = error.message || 'History failed';
      const lower = msg.toLowerCase();
      if ((lower.includes('relation') && lower.includes('arena_matches')) || lower.includes('could not find the table')) {
        return NextResponse.json({ ok: true, matches: [], arena_uninitialized: true });
      }
      return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }

    const [{ data: rating }, { data: ownedCats }] = await Promise.all([
      supabase
        .from('arena_ratings')
        .select('rating, tier, wins, losses')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('cats')
        .select('id')
        .eq('user_id', userId),
    ]);

    const ownedCatIds = (ownedCats || []).map((cat) => String((cat as any).id || '')).filter(Boolean);
    let resolvedMatchups: any[] = [];

    if (ownedCatIds.length > 0) {
      const { data: historyRows } = await supabase
        .from('match_history')
        .select('id, match_id, cat_a_id, cat_b_id, votes_a, votes_b, base_prob_a, skill_delta, final_prob_a, skills_cancelled, skill_a_id, skill_b_id, skill_a_triggered, skill_b_triggered, winner_id, resolved_at')
        .or(`cat_a_id.in.(${ownedCatIds.join(',')}),cat_b_id.in.(${ownedCatIds.join(',')})`)
        .not('resolved_at', 'is', null)
        .order('resolved_at', { ascending: false })
        .limit(20);

      const catIds = Array.from(
        new Set((historyRows || []).flatMap((row: any) => [row.cat_a_id, row.cat_b_id]).filter(Boolean))
      );
      const skillIds = Array.from(
        new Set((historyRows || []).flatMap((row: any) => [row.skill_a_id, row.skill_b_id]).filter(Boolean))
      );

      const [{ data: cats }, { data: skills }] = await Promise.all([
        catIds.length
          ? supabase
              .from('cats')
              .select('id, name, image_path, image_review_status')
              .in('id', catIds)
          : Promise.resolve({ data: [] as any[] }),
        skillIds.length
          ? supabase
              .from('skills')
              .select('id, name, description')
              .in('id', skillIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const catMap = new Map<string, any>();
      for (const cat of cats || []) {
        const imageUrl = await resolveCatImageUrl(supabase, (cat as any).image_path, (cat as any).image_review_status || null, 'thumb');
        catMap.set(String((cat as any).id), {
          id: String((cat as any).id),
          name: String((cat as any).name || 'Unknown'),
          image_url: imageUrl || '/cat-placeholder.svg',
        });
      }
      const skillMap = new Map<string, any>((skills || []).map((skill: any) => [
        String(skill.id),
        {
          id: String(skill.id),
          name: String(skill.name || 'Unknown Skill'),
          description: skill.description || null,
        },
      ]));

      resolvedMatchups = (historyRows || []).map((row: any) => {
        const catA = catMap.get(String(row.cat_a_id)) || { id: row.cat_a_id, name: 'Unknown', image_url: '/cat-placeholder.svg' };
        const catB = catMap.get(String(row.cat_b_id)) || { id: row.cat_b_id, name: 'Unknown', image_url: '/cat-placeholder.svg' };
        const skillA = row.skill_a_id ? skillMap.get(String(row.skill_a_id)) || null : null;
        const skillB = row.skill_b_id ? skillMap.get(String(row.skill_b_id)) || null : null;
        const finalProbA = Number(row.final_prob_a ?? 0.5);
        const baseProbA = Number(row.base_prob_a ?? 0.5);
        const skillDelta = Number(row.skill_delta || 0);

        return {
          id: String(row.id || row.match_id),
          match_id: String(row.match_id || row.id),
          resolved_at: row.resolved_at,
          winner_id: row.winner_id || null,
          base_prob_a: baseProbA,
          skill_delta: skillDelta,
          final_prob_a: finalProbA,
          skills_cancelled: !!row.skills_cancelled,
          skill_a_triggered: !!row.skill_a_triggered,
          skill_b_triggered: !!row.skill_b_triggered,
          skill_a_id: row.skill_a_id || null,
          skill_b_id: row.skill_b_id || null,
          skill_a_name: skillA?.name || null,
          skill_a_description: skillA?.description || null,
          skill_b_name: skillB?.name || null,
          skill_b_description: skillB?.description || null,
          cat_a: catA,
          cat_b: catB,
          cat_a_column: {
            id: catA.id,
            name: catA.name,
            image_url: catA.image_url,
            skill_name: skillA?.name || 'No skill equipped',
            skill_description: skillA?.description || null,
            triggered: !!row.skill_a_triggered,
            base_probability: baseProbA,
            skill_delta: skillDelta > 0 ? skillDelta : 0,
            final_probability: finalProbA,
            is_winner: row.winner_id === catA.id,
          },
          cat_b_column: {
            id: catB.id,
            name: catB.name,
            image_url: catB.image_url,
            skill_name: skillB?.name || 'No skill equipped',
            skill_description: skillB?.description || null,
            triggered: !!row.skill_b_triggered,
            base_probability: 1 - baseProbA,
            skill_delta: skillDelta < 0 ? Math.abs(skillDelta) : 0,
            final_probability: 1 - finalProbA,
            is_winner: row.winner_id === catB.id,
          },
        };
      });
    }

    return NextResponse.json({
      ok: true,
      matches: matches || [],
      resolved_matchups: resolvedMatchups,
      rating: rating || { rating: 1000, tier: 'bronze', wins: 0, losses: 0 },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
