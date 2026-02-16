// REPLACE: app/api/vote/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { getGuestId } from "../_lib/guest";

export const dynamic = "force-dynamic";

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

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { ok: false, error: "missing_env" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => null);
    const matchId = body?.match_id as string | undefined;
    const votedFor = body?.voted_for as string | undefined;

    if (!matchId || !votedFor) {
      return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
    }

    // getGuestId is async now
    const voterUserId = await getGuestId();
    const ipHash = sha256Hex(getClientIp(req));
    const userAgent = req.headers.get("user-agent") ?? null;

    // Try RPC first
    const { data: rpcData, error: rpcError } = await supabase.rpc("cast_vote", {
      p_match_id: matchId,
      p_voter_user_id: voterUserId,
      p_voted_for: votedFor,
      p_ip_hash: ipHash,
      p_user_agent: userAgent,
    });

    // If RPC works, return its result
    if (!rpcError) {
      // RPC might return { ok: true } or similar
      if (rpcData && typeof rpcData === 'object') {
        return NextResponse.json(rpcData);
      }
      return NextResponse.json({ ok: true, message: "Vote recorded" });
    }

    // RPC failed — fall back to direct insert
    console.error("[VOTE] RPC failed, using fallback:", rpcError.message);

    // 1. Verify the match exists and is active
    const { data: match, error: matchErr } = await supabase
      .from("tournament_matches")
      .select("id, cat_a_id, cat_b_id, status, votes_a, votes_b")
      .eq("id", matchId)
      .single();

    if (matchErr || !match) {
      return NextResponse.json({ ok: false, error: "match_not_found" }, { status: 404 });
    }

    if (match.status !== "active") {
      return NextResponse.json({ ok: false, error: "match_closed" }, { status: 400 });
    }

    // Verify voted_for is one of the two cats
    if (votedFor !== match.cat_a_id && votedFor !== match.cat_b_id) {
      return NextResponse.json({ ok: false, error: "invalid_cat" }, { status: 400 });
    }

    // 2. Check for duplicate vote (by guest_id)
    const { data: existingVote } = await supabase
      .from("votes")
      .select("id")
      .eq("battle_id", matchId)
      .eq("voter_user_id", voterUserId)
      .limit(1)
      .single();

    if (existingVote) {
      return NextResponse.json({ ok: false, error: "You already voted on this match" }, { status: 409 });
    }

    // 3. Also check by IP hash
    if (ipHash) {
      const { data: ipVote } = await supabase
        .from("votes")
        .select("id")
        .eq("battle_id", matchId)
        .eq("ip_hash", ipHash)
        .limit(1)
        .single();

      if (ipVote) {
        return NextResponse.json({ ok: false, error: "You already voted on this match" }, { status: 409 });
      }
    }

    // 4. Insert vote
    const { error: insertErr } = await supabase
      .from("votes")
      .insert({
        battle_id: matchId,
        voter_user_id: voterUserId,
        ip_hash: ipHash,
        user_agent: userAgent,
        voted_for: votedFor,
      });

    if (insertErr) {
      // Unique constraint violation = duplicate vote
      if (insertErr.code === "23505") {
        return NextResponse.json({ ok: false, error: "You already voted on this match" }, { status: 409 });
      }
      console.error("[VOTE] Insert error:", insertErr);
      return NextResponse.json({ ok: false, error: "vote_failed", details: insertErr.message }, { status: 500 });
    }

    // 5. Increment vote count on match
    const isVoteA = votedFor === match.cat_a_id;
    const { error: updateErr } = await supabase
      .from("tournament_matches")
      .update(
        isVoteA
          ? { votes_a: (match.votes_a || 0) + 1 }
          : { votes_b: (match.votes_b || 0) + 1 }
      )
      .eq("id", matchId);

    if (updateErr) {
      console.error("[VOTE] Update match error:", updateErr);
      // Vote was still recorded, just count didn't update
    }

    // 6. Award XP (best effort)
    if (voterUserId) {
      const { data: userProg } = await supabase
        .from("user_progress")
        .select("xp")
        .eq("user_id", voterUserId)
        .single();

      if (userProg) {
        await supabase
          .from("user_progress")
          .update({ xp: (userProg.xp || 0) + 5, updated_at: new Date().toISOString() })
          .eq("user_id", voterUserId);
      } else {
        // Create progress row
        await supabase
          .from("user_progress")
          .upsert({ user_id: voterUserId, xp: 5, level: 1 });
      }
    }

    return NextResponse.json({ ok: true, message: "Vote recorded! +5 XP" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[VOTE] Exception:", msg);
    return NextResponse.json({ ok: false, error: "server_error", details: msg }, { status: 500 });
  }
}