import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "../../_lib/adminAuth";
import { loadArenaPage, type ArenaType } from "../../_lib/arena-pages";

export const dynamic = "force-dynamic";

function parseArena(input: string | null): ArenaType {
  return input === "rookie" ? "rookie" : "main";
}

function parseSide(input: string | null): "a" | "b" {
  return input === "b" ? "b" : "a";
}

function supabaseAdmin() {
  return createClient(
    String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\s/g, "").trim(),
    String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!(auth as any).ok) return auth as NextResponse;

  try {
    const body = await request.json().catch(() => ({}));
    const arena = parseArena(String(body?.arena || "main"));
    const pageIndex = Math.max(0, Number(body?.page || 0));
    const side = parseSide(String(body?.side || "a"));
    const requestedMatchId = String(body?.match_id || "").trim();

    const page = await loadArenaPage({ arena, tab: "voting", pageIndex, targetCount: 4 });
    const match =
      (requestedMatchId
        ? page.matches.find((m) => String(m.match_id) === requestedMatchId)
        : page.matches[0]) || null;
    if (!match) {
      return NextResponse.json({ ok: false, error: "No active match found on selected page" }, { status: 404 });
    }

    const supabase = supabaseAdmin();
    const { data: beforeRow } = await supabase
      .from("tournament_matches")
      .select("id, votes_a, votes_b")
      .eq("id", match.match_id)
      .maybeSingle();
    if (!beforeRow) {
      return NextResponse.json({ ok: false, error: "Match not found" }, { status: 404 });
    }

    const nextVotesA = Number(beforeRow.votes_a || 0) + (side === "a" ? 1 : 0);
    const nextVotesB = Number(beforeRow.votes_b || 0) + (side === "b" ? 1 : 0);

    const { error: updateErr } = await supabase
      .from("tournament_matches")
      .update({ votes_a: nextVotesA, votes_b: nextVotesB })
      .eq("id", match.match_id);
    if (updateErr) {
      return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
    }

    const { data: afterRow } = await supabase
      .from("tournament_matches")
      .select("id, votes_a, votes_b")
      .eq("id", match.match_id)
      .maybeSingle();

    const updatesPage = await loadArenaPage({ arena, tab: "voting", pageIndex, targetCount: 4 });
    const pageMatchIds = updatesPage.matchIds;
    const { data: updates } = await supabase
      .from("tournament_matches")
      .select("id, votes_a, votes_b, updated_at, created_at")
      .in("id", pageMatchIds);

    return NextResponse.json({
      ok: true,
      arena,
      page: pageIndex,
      side,
      match_id: match.match_id,
      before: { votes_a: Number(beforeRow.votes_a || 0), votes_b: Number(beforeRow.votes_b || 0) },
      after: { votes_a: Number(afterRow?.votes_a || 0), votes_b: Number(afterRow?.votes_b || 0) },
      updates: (updates || []).map((u: any) => ({
        matchId: String(u.id),
        votesA: Number(u.votes_a || 0),
        votesB: Number(u.votes_b || 0),
        updatedAt: String(u.updated_at || u.created_at || ""),
      })),
      serverTime: Date.now(),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
