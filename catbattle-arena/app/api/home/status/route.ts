import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSupabase() {
  return createClient(
    String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\s/g, "").trim(),
    String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function todayUtcKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function nextPulseAtUtc(now = new Date()): string {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return next.toISOString();
}

export async function GET() {
  try {
    const sb = getSupabase();
    const dayKey = todayUtcKey();
    const { data: tournaments } = await sb
      .from("tournaments")
      .select("id, tournament_type, updated_at, created_at")
      .eq("date", dayKey)
      .in("tournament_type", ["main", "rookie"]);

    const byType: Record<"main" | "rookie", string[]> = { main: [], rookie: [] };
    for (const t of tournaments || []) {
      const type = String((t as any).tournament_type || "");
      const id = String((t as any).id || "");
      if ((type === "main" || type === "rookie") && id) byType[type].push(id);
    }

    const [mainLatest, rookieLatest, duelLatest, voteLatest] = await Promise.all([
      byType.main.length
        ? sb
            .from("tournament_matches")
            .select("updated_at, created_at")
            .in("tournament_id", byType.main)
            .order("updated_at", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false })
            .limit(1)
        : Promise.resolve({ data: [] as any[] }),
      byType.rookie.length
        ? sb
            .from("tournament_matches")
            .select("updated_at, created_at")
            .in("tournament_id", byType.rookie)
            .order("updated_at", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false })
            .limit(1)
        : Promise.resolve({ data: [] as any[] }),
      sb.from("duel_votes").select("created_at").order("created_at", { ascending: false }).limit(1),
      sb.from("votes").select("created_at").order("created_at", { ascending: false }).limit(1),
    ]);

    const mainStamp = String((mainLatest.data?.[0] as any)?.updated_at || (mainLatest.data?.[0] as any)?.created_at || "");
    const rookieStamp = String((rookieLatest.data?.[0] as any)?.updated_at || (rookieLatest.data?.[0] as any)?.created_at || "");
    const duelStamp = String((duelLatest.data?.[0] as any)?.created_at || "");
    const voteStamp = String((voteLatest.data?.[0] as any)?.created_at || "");

    return NextResponse.json(
      {
        ok: true,
        dayKey,
        serverNowUtc: new Date().toISOString(),
        nextPulseAtUtc: nextPulseAtUtc(),
        arenaVersionMain: `${dayKey}:main:${mainStamp || "0"}:${voteStamp || "0"}`,
        arenaVersionRookie: `${dayKey}:rookie:${rookieStamp || "0"}:${voteStamp || "0"}`,
        duelVersion: `${dayKey}:duel:${duelStamp || "0"}`,
      },
      { headers: { "Cache-Control": "private, max-age=5" } }
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
