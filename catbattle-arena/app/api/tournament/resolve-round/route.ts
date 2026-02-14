import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const adminSecret = req.headers.get("x-admin-secret") || "";
    if (!process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const tournamentId = body?.tournament_id as string | undefined;

    if (!tournamentId) {
      return NextResponse.json({ ok: false, error: "missing_tournament_id" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("resolve_current_round", {
      p_tournament_id: tournamentId,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: "db_failed", details: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e: unknown) {
    const details = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: "server_error", details }, { status: 500 });
  }
}
