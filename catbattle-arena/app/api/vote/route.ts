// REPLACE: app/api/vote/route.ts
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { requireGuestId } from "../_lib/guest";
import { computeGuildStandings } from "../_lib/guilds";
import { grantPendingCatXp } from "../_lib/cat-progression";
import { evaluateAndMaybeQualifyFlame } from "../_lib/arenaFlame";
import { checkRateLimitManyPersistent, getClientIpPrefix, hashValue } from "../_lib/rateLimit";
import { markReferralQualifiedFromVote } from "../_lib/referrals";
import { trackAppEvent } from "../_lib/telemetry";
import { applyFeatureTesterBoost, isFeatureTesterId } from "../_lib/tester";

export const dynamic = "force-dynamic";

function newRequestId(): string {
  try {
    return randomUUID();
  } catch {
    return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

function logVoteEvent(payload: Record<string, unknown>) {
  // Structured log for launch debugging (no secrets).
  // eslint-disable-next-line no-console
  console.info("[VOTE_LOG]", JSON.stringify({ ts: new Date().toISOString(), ...payload }));
}

async function fetchMatchVotes(supabase: any, matchId: string) {
  try {
    const { data } = await supabase
      .from("tournament_matches")
      .select("id, votes_a, votes_b")
      .eq("id", matchId)
      .maybeSingle();
    if (!data) return null;
    const a = Number(data.votes_a || 0);
    const b = Number(data.votes_b || 0);
    return { votes_a: a, votes_b: b, total_votes: a + b };
  } catch {
    return null;
  }
}

async function attachArenaPageVoteState(
  supabase: any,
  identityKey: string,
  matchId: string
): Promise<{ page_complete: boolean; voted_count: number; page_size: number }> {
  try {
    const { data, error } = await (supabase as any).rpc("record_arena_page_vote", {
      p_identity_key: identityKey,
      p_match_id: matchId,
    });
    if (error || !data) return { page_complete: false, voted_count: 0, page_size: 0 };
    const payload = data as Record<string, unknown>;
    return {
      page_complete: !!payload.page_complete,
      voted_count: Number(payload.voted_count || 0),
      page_size: Number(payload.page_size || 0),
    };
  } catch {
    return { page_complete: false, voted_count: 0, page_size: 0 };
  }
}

export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      logVoteEvent({ request_id: requestId, outcome: "error", detail: "missing_env" });
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
      logVoteEvent({ request_id: requestId, match_id: matchId, voted_for: votedFor, outcome: "invalid" });
      return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
    }

    let voterUserId = '';
    try {
      voterUserId = await requireGuestId();
    } catch {
      logVoteEvent({ request_id: requestId, match_id: matchId, voted_for: votedFor, outcome: "unauthorized" });
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const testerMode = isFeatureTesterId(voterUserId);
    const { data: cred } = await supabase.from('auth_credentials').select('user_id').eq('user_id', voterUserId).maybeSingle();
    const isRegistered = !!cred?.user_id;

    if (testerMode) {
      const { data: match, error: matchErr } = await supabase
        .from("tournament_matches")
        .select("id, cat_a_id, cat_b_id, status, votes_a, votes_b")
        .eq("id", matchId)
        .maybeSingle();

      if (matchErr || !match) {
        logVoteEvent({ request_id: requestId, match_id: matchId, voted_for: votedFor, user_id: voterUserId, outcome: "invalid_match" });
        return NextResponse.json({ ok: false, error: "match_not_found" }, { status: 404 });
      }
      if (votedFor !== match.cat_a_id && votedFor !== match.cat_b_id) {
        logVoteEvent({ request_id: requestId, match_id: matchId, voted_for: votedFor, user_id: voterUserId, outcome: "invalid_cat" });
        return NextResponse.json({ ok: false, error: "invalid_cat" }, { status: 400 });
      }

      const voteA = votedFor === match.cat_a_id;
      const beforeVotes = {
        votes_a: Number(match.votes_a || 0),
        votes_b: Number(match.votes_b || 0),
        total_votes: Number(match.votes_a || 0) + Number(match.votes_b || 0),
      };
      await supabase
        .from("tournament_matches")
        .update(
          voteA
            ? { votes_a: Number(match.votes_a || 0) + 1 }
            : { votes_b: Number(match.votes_b || 0) + 1 }
        )
        .eq("id", matchId);
      await applyFeatureTesterBoost(supabase as any, voterUserId);
      const afterVotes = await fetchMatchVotes(supabase, matchId);
      logVoteEvent({
        request_id: requestId,
        match_id: matchId,
        voted_for: votedFor,
        user_id: voterUserId,
        outcome: "success",
        tester_mode: true,
        votes_before: beforeVotes,
        votes_after: afterVotes,
      });
      try {
        await trackAppEvent(supabase, "vote_cast", { match_id: matchId, tester_mode: true }, voterUserId);
      } catch {}
      return NextResponse.json({
        ok: true,
        tester_mode: true,
        matchId,
        choice: votedFor,
        message: "Tester vote recorded",
        xp_earned: 10,
        cat_xp_banked: 10,
        rewards_locked: false,
        page_complete: false,
        voted_count: 0,
        page_size: 0,
      });
    }

    const ipHash = hashValue(getClientIpPrefix(req));
    const limitResult = await checkRateLimitManyPersistent([
      { key: `rl:vote:user:${voterUserId}`, limit: 10, windowMs: 60_000 },
      { key: `rl:vote:ip:${ipHash || "unknown"}`, limit: 30, windowMs: 60_000 },
    ]);
    if (!limitResult.allowed) {
      logVoteEvent({ request_id: requestId, match_id: matchId, voted_for: votedFor, user_id: voterUserId, outcome: "rate_limited" });
      return NextResponse.json(
        { ok: false, error: "Rate limit exceeded. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(limitResult.retryAfterSec) } }
      );
    }
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
      const afterVotes = await fetchMatchVotes(supabase, matchId);
      logVoteEvent({
        request_id: requestId,
        match_id: matchId,
        voted_for: votedFor,
        user_id: voterUserId,
        outcome: "success",
        rpc: true,
        votes_after: afterVotes,
      });
      const pageVoteMeta = await attachArenaPageVoteState(supabase, voterUserId, matchId);
      if (voterUserId) {
        await trackAppEvent(supabase, isRegistered ? 'vote_cast' : 'guest_vote_cast', { match_id: matchId }, voterUserId);
        if (isRegistered) {
          await evaluateAndMaybeQualifyFlame(supabase, voterUserId, 'vote', new Date());
          const q = await markReferralQualifiedFromVote(supabase, voterUserId);
          if ((q as any)?.qualified) {
            await trackAppEvent(supabase, 'recruit_qualified', { via: 'vote', reason: (q as any)?.reason || null }, voterUserId);
          }
        }
      }
      // RPC might return { ok: true } or similar
      if (rpcData && typeof rpcData === 'object') {
        return NextResponse.json({
          ...(rpcData as Record<string, unknown>),
          ok: true,
          matchId,
          choice: votedFor,
          ...pageVoteMeta,
        });
      }
      return NextResponse.json({ ok: true, matchId, choice: votedFor, message: "Vote recorded", ...pageVoteMeta });
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
      logVoteEvent({ request_id: requestId, match_id: matchId, voted_for: votedFor, user_id: voterUserId, outcome: "invalid_match" });
      return NextResponse.json({ ok: false, error: "match_not_found" }, { status: 404 });
    }

    if (match.status !== "active") {
      logVoteEvent({ request_id: requestId, match_id: matchId, voted_for: votedFor, user_id: voterUserId, outcome: "invalid_state", detail: "match_closed" });
      return NextResponse.json({ ok: false, error: "match_closed" }, { status: 400 });
    }

    // Verify voted_for is one of the two cats
    if (votedFor !== match.cat_a_id && votedFor !== match.cat_b_id) {
      logVoteEvent({ request_id: requestId, match_id: matchId, voted_for: votedFor, user_id: voterUserId, outcome: "invalid_cat" });
      return NextResponse.json({ ok: false, error: "invalid_cat" }, { status: 400 });
    }

    // 2. Check for duplicate vote (by guest_id)
    const { data: existingVote } = await supabase
      .from("votes")
      .select("id, voted_for")
      .eq("battle_id", matchId)
      .eq("voter_user_id", voterUserId)
      .limit(1)
      .single();

    if (existingVote) {
      logVoteEvent({ request_id: requestId, match_id: matchId, voted_for: votedFor, user_id: voterUserId, outcome: "duplicate" });
      const pageVoteMeta = await attachArenaPageVoteState(supabase, voterUserId, matchId);
      return NextResponse.json(
        { ok: true, alreadyVoted: true, matchId, choice: String((existingVote as any)?.voted_for || votedFor), ...pageVoteMeta },
        { status: 200 }
      );
    }

    // 3. Also check by IP hash
    if (ipHash) {
      const { data: ipVote } = await supabase
        .from("votes")
        .select("id, voted_for")
        .eq("battle_id", matchId)
        .eq("ip_hash", ipHash)
        .limit(1)
        .single();

      if (ipVote) {
        logVoteEvent({ request_id: requestId, match_id: matchId, voted_for: votedFor, user_id: voterUserId, outcome: "duplicate", detail: "ip_hash" });
        const pageVoteMeta = await attachArenaPageVoteState(supabase, voterUserId, matchId);
        return NextResponse.json(
          { ok: true, alreadyVoted: true, matchId, choice: String((ipVote as any)?.voted_for || votedFor), ...pageVoteMeta },
          { status: 200 }
        );
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
        logVoteEvent({ request_id: requestId, match_id: matchId, voted_for: votedFor, user_id: voterUserId, outcome: "duplicate", detail: "unique" });
        const pageVoteMeta = await attachArenaPageVoteState(supabase, voterUserId, matchId);
        return NextResponse.json(
          { ok: true, alreadyVoted: true, matchId, choice: votedFor, ...pageVoteMeta },
          { status: 200 }
        );
      }
      console.error("[VOTE] Insert error:", insertErr);
      logVoteEvent({ request_id: requestId, match_id: matchId, voted_for: votedFor, user_id: voterUserId, outcome: "error", detail: "insert_failed" });
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
    let crossModeBonus = 0;
    let earnedXp = 5;
    if (voterUserId && isRegistered) {
      const { data: userProg } = await supabase
        .from("user_progress")
        .select("xp")
        .eq("user_id", voterUserId)
        .single();

      let bonusXp = 0;
      try {
        const guildSnapshot = await computeGuildStandings(supabase, voterUserId);
        if (guildSnapshot.pledgedGuild) bonusXp += 1;
        if (guildSnapshot.pledgedGuild && guildSnapshot.pledgedGuild === guildSnapshot.leaderGuild) bonusXp += 1;
      } catch {
        bonusXp = 0;
      }

      earnedXp = 5 + bonusXp;
      if (userProg) {
        await supabase
          .from("user_progress")
          .update({ xp: (userProg.xp || 0) + earnedXp, updated_at: new Date().toISOString() })
          .eq("user_id", voterUserId);
      } else {
        // Create progress row
        await supabase
          .from("user_progress")
          .upsert({ user_id: voterUserId, xp: earnedXp, level: 1 });
      }

      // Cross-mode loop: if player has a Whisker win today, first main vote grants bonus sigils.
      const today = new Date().toISOString().slice(0, 10);
      const bonusKey = `cross_mode_vote_bonus:${today}`;
      const { data: existingBonus } = await supabase
        .from('user_reward_claims')
        .select('reward_key')
        .eq('user_id', voterUserId)
        .eq('reward_key', bonusKey)
        .maybeSingle();

      if (!existingBonus) {
        const dayStart = `${today}T00:00:00.000Z`;
        const { data: whiskerWin } = await supabase
          .from('arena_matches')
          .select('id')
          .eq('challenger_user_id', voterUserId)
          .eq('status', 'complete')
          .gt('rating_delta', 0)
          .gte('created_at', dayStart)
          .limit(1)
          .maybeSingle();

        if (whiskerWin?.id) {
          crossModeBonus = 25;
          const { error: claimErr } = await supabase
            .from('user_reward_claims')
            .insert({ user_id: voterUserId, reward_key: bonusKey, reward_sigils: crossModeBonus });
          if (!claimErr) {
            const { data: p2 } = await supabase
              .from('user_progress')
              .select('sigils')
              .eq('user_id', voterUserId)
              .maybeSingle();
            await supabase
              .from('user_progress')
              .update({ sigils: Number(p2?.sigils || 0) + crossModeBonus })
              .eq('user_id', voterUserId);
          } else {
            crossModeBonus = 0;
          }
        }
      }
    }

    let pendingCatXp = 0;
    if (voterUserId && isRegistered && earnedXp > 0) {
      pendingCatXp = await grantPendingCatXp(supabase, voterUserId, earnedXp);
    }
    if (voterUserId) {
      await trackAppEvent(supabase, isRegistered ? 'vote_cast' : 'guest_vote_cast', { match_id: matchId }, voterUserId);
      if (isRegistered) {
        await evaluateAndMaybeQualifyFlame(supabase, voterUserId, 'vote', new Date());
        const q = await markReferralQualifiedFromVote(supabase, voterUserId);
        if ((q as any)?.qualified) {
          await trackAppEvent(supabase, 'recruit_qualified', { via: 'vote', reason: (q as any)?.reason || null }, voterUserId);
        }
      }
    }

    const pageVoteMeta = await attachArenaPageVoteState(supabase, voterUserId, matchId);
    const afterVotes = await fetchMatchVotes(supabase, matchId);
    logVoteEvent({
      request_id: requestId,
      match_id: matchId,
      voted_for: votedFor,
      user_id: voterUserId,
      outcome: "success",
      rpc: false,
      votes_after: afterVotes,
    });

    return NextResponse.json({
      ok: true,
      matchId,
      choice: votedFor,
      message: !isRegistered
        ? "Vote recorded. Create an account to earn streak/XP/rewards."
        : crossModeBonus > 0
        ? `Vote recorded! +${earnedXp} XP (${pendingCatXp} cat XP banked) and +${crossModeBonus} sigils cross-mode bonus`
        : `Vote recorded! +${earnedXp} XP (${pendingCatXp} cat XP banked)`,
      cross_mode_bonus: crossModeBonus,
      xp_earned: isRegistered ? earnedXp : 0,
      cat_xp_banked: pendingCatXp,
      rewards_locked: !isRegistered,
      ...pageVoteMeta,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[VOTE] Exception:", msg);
    logVoteEvent({ request_id: requestId, outcome: "error", detail: msg });
    return NextResponse.json({ ok: false, error: "server_error", details: msg }, { status: 500 });
  }
}
