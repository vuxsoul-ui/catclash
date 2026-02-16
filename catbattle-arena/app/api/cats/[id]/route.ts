// PLACE AT: app/api/cats/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: cat, error } = await supabase
      .from("cats")
      .select(
        "id, name, image_path, rarity, ability, power, evolution, attack, defense, speed, charisma, chaos, cat_xp, cat_level, xp, level, wins, losses, battles_fought, status, user_id, created_at"
      )
      .eq("id", params.id)
      .single();

    if (error || !cat) {
      return NextResponse.json({ ok: false, error: "Cat not found" }, { status: 404 });
    }

    // Build image URL
    let image_url = "";
    if (cat.image_path) {
      const { data: urlData } = supabase.storage
        .from("cat-images")
        .getPublicUrl(cat.image_path);
      image_url = urlData?.publicUrl || "";
    }

    // Get recent battle history
    const { data: recentMatches } = await supabase
      .from("tournament_matches")
      .select("id, round, votes_a, votes_b, winner_id, status, cat_a_id, cat_b_id, created_at")
      .or(`cat_a_id.eq.${cat.id},cat_b_id.eq.${cat.id}`)
      .eq("status", "complete")
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

    const battleHistory = (recentMatches || []).map((m) => {
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

    const winRate =
      cat.battles_fought > 0
        ? Math.round((cat.wins / cat.battles_fought) * 100)
        : 0;

    const totalPower =
      (cat.attack || 0) + (cat.defense || 0) + (cat.speed || 0) + (cat.charisma || 0) + (cat.chaos || 0);

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
        wins: cat.wins || 0,
        losses: cat.losses || 0,
        battles_fought: cat.battles_fought || 0,
        win_rate: winRate,
        owner_id: cat.user_id,
        created_at: cat.created_at,
        battle_history: battleHistory,
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}