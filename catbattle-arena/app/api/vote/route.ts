// app/api/vote/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { getGuestId } from "../_lib/guest";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function getClientIp(req: NextRequest) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xr = req.headers.get("x-real-ip");
  if (xr) return xr;
  return null;
}

function sha256Hex(input: string | null) {
  if (!input) return null;
  return crypto.createHash("sha256").update(input).digest("hex");
}

function errToString(err: unknown) {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const matchId = body?.match_id as string | undefined;
    const votedFor = body?.voted_for as string | undefined;

    if (!matchId || !votedFor) {
      return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
    }

    const voterUserId = getGuestId() ?? null;
    const userAgent = req.headers.get("user-agent") ?? null;
    if (voterUserId) {
      await supabase.rpc("bootstrap_user", { p_user_id: voterUserId });
    }
    
    const { data, error } = await supabase.rpc("cast_vote", {
      p_match_id: matchId,
      p_voter_user_id: voterUserId,
      p_voted_for: votedFor,
      p_ip_hash: sha256Hex(getClientIp(req)),
      p_user_agent: userAgent,
    });

    if (error) {
      return NextResponse.json(
        { ok: false, error: "db_failed", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: "server_error", details: errToString(err) },
      { status: 500 }
    );
  }
}

