import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { loadArenaPage, type ArenaType, type ArenaTab } from "../../_lib/arena-pages";

export const dynamic = "force-dynamic";

function parseArena(value: string | null): ArenaType {
  return value === "rookie" ? "rookie" : "main";
}

function parseTab(value: string | null): ArenaTab {
  return value === "results" ? "results" : "voting";
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const arena = parseArena(url.searchParams.get("arena"));
    const tab = parseTab(url.searchParams.get("tab"));
    const pageIndex = Math.max(0, Number(url.searchParams.get("page") || 0));
    const sinceRaw = String(url.searchParams.get("since") || "").trim();
    const parsedSince = Number(sinceRaw || 0);
    const sinceIso = Number.isFinite(parsedSince) && parsedSince > 0
      ? new Date(parsedSince).toISOString()
      : new Date(Date.now() - 60_000).toISOString();

    const page = await loadArenaPage({ arena, tab, pageIndex });
    const matchIds = page.matchIds;
    if (matchIds.length === 0) {
      return NextResponse.json({ ok: true, updates: [], serverTime: Date.now() });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let rows: any[] = [];
    const primary = await supabase
      .from("tournament_matches")
      .select("id, votes_a, votes_b, updated_at, created_at")
      .in("id", matchIds)
      .gte("updated_at", sinceIso);
    if (!primary.error) {
      rows = primary.data || [];
    } else {
      const fallbackNoUpdated = await supabase
        .from("tournament_matches")
        .select("id, votes_a, votes_b, created_at")
        .in("id", matchIds);
      rows = fallbackNoUpdated.data || [];
    }

    const updates = (rows || []).map((r: any) => ({
      matchId: String(r.id),
      votesA: Number(r.votes_a || 0),
      votesB: Number(r.votes_b || 0),
      updatedAt: String(r.updated_at || r.created_at || new Date().toISOString()),
    }));

    return NextResponse.json({
      ok: true,
      dayKey: page.dayKey,
      arena,
      tab,
      pageIndex: page.pageIndex,
      updates,
      serverTime: Date.now(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
