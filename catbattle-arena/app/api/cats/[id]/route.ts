// PLACE AT: app/api/cats/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveCatImageUrl } from '../../_lib/images';

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function isRealCompletedMatch(match: {
  status?: string | null;
  winner_id?: string | null;
  votes_a?: number | null;
  votes_b?: number | null;
}) {
  const status = String(match.status || '').toLowerCase();
  const totalVotes = Math.max(0, Number(match.votes_a || 0)) + Math.max(0, Number(match.votes_b || 0));
  return (status === 'complete' || status === 'completed') && !!match.winner_id && totalVotes > 0;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let { data: cat, error } = await supabase
      .from("cats")
      .select(
        "id, name, image_path, image_review_status, rarity, ability, power, evolution, attack, defense, speed, charisma, chaos, cat_xp, cat_level, xp, level, wins, losses, battles_fought, status, user_id, created_at"
      )
      .eq("id", id)
      .single();

    if (error?.message?.includes('image_review_status')) {
      ({ data: cat, error } = await supabase
        .from("cats")
        .select(
          "id, name, image_path, rarity, ability, power, evolution, attack, defense, speed, charisma, chaos, cat_xp, cat_level, xp, level, wins, losses, battles_fought, status, user_id, created_at"
        )
        .eq("id", id)
        .single());
    }

    if (error || !cat) {
      return NextResponse.json({ ok: false, error: "Cat not found" }, { status: 404 });
    }

    // Build image URL
    const image_url = (await resolveCatImageUrl(supabase, cat.image_path, cat.image_review_status || null, "original")) || "";

    // Get recent battle history
    const { data: recentMatches } = await supabase
      .from("tournament_matches")
      .select("id, round, votes_a, votes_b, winner_id, status, cat_a_id, cat_b_id, created_at")
      .or(`cat_a_id.eq.${cat.id},cat_b_id.eq.${cat.id}`)
      .in("status", ["complete", "completed"])
      .order("created_at", { ascending: false })
      .limit(10);

    // Enrich battle history with opponent names
    const opponentIds = new Set<string>();
    for (const m of recentMatches || []) {
      const oppId = m.cat_a_id === cat.id ? m.cat_b_id : m.cat_a_id;
      opponentIds.add(oppId);
    }

    const { data: opponents } = opponentIds.size > 0
      ? await supabase.from("cats").select("id, name").in("id", Array.from(opponentIds))
      : { data: [] };

    const oppMap: Record<string, string> = {};
    for (const o of opponents || []) {
      oppMap[o.id] = o.name;
    }

    const realRecentMatches = (recentMatches || []).filter(isRealCompletedMatch);

    const battleHistory = realRecentMatches.map((m) => {
      const isA = m.cat_a_id === cat.id;
      const oppId = isA ? m.cat_b_id : m.cat_a_id;
      const won = m.winner_id === cat.id;
      return {
        match_id: m.id,
        opponent_name: oppMap[oppId] || "Unknown",
        won,
        my_votes: isA ? m.votes_a : m.votes_b,
        opp_votes: isA ? m.votes_b : m.votes_a,
        date: m.created_at,
      };
    });

    // Use match-derived totals to avoid stale/overcounted counters from legacy resolve flows.
    // Note: `.or(...)` is a single filter; keep winner logic *inside* each AND branch to avoid precedence surprises.
    const safeWins = battleHistory.filter((match) => match.won).length;
    const safeLosses = battleHistory.filter((match) => !match.won).length;
    const safeBattles = safeWins + safeLosses;
    const winRate = safeBattles > 0 ? Math.round((safeWins / safeBattles) * 100) : null;

    const totalPower =
      (cat.attack || 0) + (cat.defense || 0) + (cat.speed || 0) + (cat.charisma || 0) + (cat.chaos || 0);

    const [{ data: stanceRow }, { data: fanVotes }, { data: cheerRows }, { data: ownerTitleRow }] = await Promise.all([
      supabase.from('cat_stances').select('stance').eq('cat_id', cat.id).maybeSingle(),
      supabase.from('votes').select('id, user_agent').eq('voted_for', cat.id),
      supabase.from('match_tactics').select('id').eq('cat_id', cat.id).in('action_type', ['cheer', 'guard_break']),
      supabase
        .from('equipped_cosmetics')
        .select('cosmetics(name)')
        .eq('user_id', cat.user_id)
        .in('slot', ['title', 'cat_title'])
        .limit(1)
        .maybeSingle(),
    ]);
    const { data: ownerProfile } = cat.user_id
      ? await supabase.from('profiles').select('username').eq('id', cat.user_id).maybeSingle()
      : { data: null as { username?: string | null } | null };

    const organicFanVotes = (fanVotes || []).filter((vote) => String((vote as { user_agent?: string | null }).user_agent || '') !== 'seed-script');
    const fanCount = organicFanVotes.length + (cheerRows || []).length;

    const oppCounter: Record<string, number> = {};
    for (const m of realRecentMatches) {
      const opp = m.cat_a_id === cat.id ? m.cat_b_id : m.cat_a_id;
      oppCounter[opp] = (oppCounter[opp] || 0) + 1;
    }
    const rivalries = Object.entries(oppCounter)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, battles]) => ({ cat_id: id, cat_name: oppMap[id] || 'Unknown', battles }));

    return NextResponse.json({
      ok: true,
      cat: {
        id: cat.id,
        name: cat.name,
        image_url,
        rarity: cat.rarity || "Common",
        ability: cat.ability || "None",
        power: cat.power || "None",
        evolution: cat.evolution || "Kitten",
        level: cat.cat_level || cat.level || 1,
        xp: cat.cat_xp || cat.xp || 0,
        stats: {
          attack: cat.attack || 0,
          defense: cat.defense || 0,
          speed: cat.speed || 0,
          charisma: cat.charisma || 0,
          chaos: cat.chaos || 0,
        },
        total_power: totalPower,
        wins: safeWins,
        losses: safeLosses,
        battles_fought: safeBattles,
        win_rate: winRate,
        stance: stanceRow?.stance || null,
        fan_count: fanCount,
        rivalries,
        owner_title: (ownerTitleRow?.cosmetics as { name?: string } | null)?.name || null,
        owner_id: cat.user_id,
        owner_username: ownerProfile?.username || null,
        created_at: cat.created_at,
        battle_history: battleHistory,
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
