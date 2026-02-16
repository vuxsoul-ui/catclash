// PLACE AT: app/api/tournament/active/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGuestId } from "../../_lib/guest";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  try {
    const guestId = await getGuestId();

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const today = new Date().toISOString().split("T")[0];

    // Get all active tournaments for today
    const { data: tournaments, error: tErr } = await supabase
      .from("tournaments")
      .select("id, date, round, status, tournament_type, champion_id")
      .eq("date", today)
      .in("status", ["active", "complete"])
      .order("tournament_type", { ascending: true });

    if (tErr || !tournaments || tournaments.length === 0) {
      return NextResponse.json({ ok: true, arenas: [], voted_matches: {} });
    }

    const tournamentIds = tournaments.map((t) => t.id);

    // Get ALL matches for these tournaments (all rounds for bracket view)
    const { data: allMatches, error: mErr } = await supabase
      .from("tournament_matches")
      .select("id, tournament_id, round, cat_a_id, cat_b_id, winner_id, status, votes_a, votes_b")
      .in("tournament_id", tournamentIds)
      .order("round", { ascending: true })
      .order("created_at", { ascending: true });

    if (mErr) {
      return NextResponse.json({ ok: false, error: mErr.message }, { status: 500 });
    }

    // Get all cat IDs we need
    const catIds = new Set<string>();
    for (const m of allMatches || []) {
      catIds.add(m.cat_a_id);
      catIds.add(m.cat_b_id);
    }

    // Fetch cat details
    const { data: cats } = await supabase
      .from("cats")
      .select("id, name, image_path, rarity, attack, defense, speed, charisma, chaos")
      .in("id", Array.from(catIds));

    const catMap: Record<string, { id: string; name: string; image_url: string | null; rarity: string; stats: { attack: number; defense: number; speed: number; charisma: number; chaos: number } }> = {};
    for (const cat of cats || []) {
      const { data: urlData } = cat.image_path
        ? supabase.storage.from("cat-images").getPublicUrl(cat.image_path)
        : { data: { publicUrl: null } };

      catMap[cat.id] = {
        id: cat.id,
        name: cat.name,
        image_url: urlData?.publicUrl || null,
        rarity: cat.rarity || "Common",
        stats: {
          attack: cat.attack || 0,
          defense: cat.defense || 0,
          speed: cat.speed || 0,
          charisma: cat.charisma || 0,
          chaos: cat.chaos || 0,
        },
      };
    }

    // Get user's votes
    const matchIds = (allMatches || []).map((m) => m.id);
    const votedMatches: Record<string, string> = {};

    if (guestId && matchIds.length > 0) {
      const { data: votes } = await supabase
        .from("votes")
        .select("battle_id, voted_for")
        .eq("voter_user_id", guestId)
        .in("battle_id", matchIds);

      for (const v of votes || []) {
        votedMatches[v.battle_id] = v.voted_for;
      }
    }

    // Build arena objects
    const arenas = tournaments.map((t) => {
      const tMatches = (allMatches || []).filter((m) => m.tournament_id === t.id);

      // Group by round
      const rounds: Record<number, typeof tMatches> = {};
      for (const m of tMatches) {
        if (!rounds[m.round]) rounds[m.round] = [];
        rounds[m.round].push(m);
      }

      const formattedRounds = Object.entries(rounds)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([roundNum, matches]) => ({
          round: Number(roundNum),
          matches: matches.map((m) => ({
            match_id: m.id,
            status: m.status,
            votes_a: m.votes_a || 0,
            votes_b: m.votes_b || 0,
            winner_id: m.winner_id,
            cat_a: catMap[m.cat_a_id] || { id: m.cat_a_id, name: "Unknown", image_url: null, rarity: "Common", stats: { attack: 0, defense: 0, speed: 0, charisma: 0, chaos: 0 } },
            cat_b: catMap[m.cat_b_id] || { id: m.cat_b_id, name: "Unknown", image_url: null, rarity: "Common", stats: { attack: 0, defense: 0, speed: 0, charisma: 0, chaos: 0 } },
          })),
        }));

      // Get champion info
      const champion = t.champion_id && catMap[t.champion_id] ? catMap[t.champion_id] : null;

      return {
        tournament_id: t.id,
        type: t.tournament_type || "main",
        date: t.date,
        current_round: t.round,
        status: t.status,
        champion,
        rounds: formattedRounds,
      };
    });

    return NextResponse.json({ ok: true, arenas, voted_matches: votedMatches });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}