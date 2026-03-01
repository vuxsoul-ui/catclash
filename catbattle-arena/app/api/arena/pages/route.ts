import { NextRequest, NextResponse } from "next/server";
import { getGuestId } from "../../_lib/guest";
import { loadArenaPage, type ArenaType, type ArenaTab } from "../../_lib/arena-pages";
import { fixtureArenaPage, isFixtureModeRequest } from "../../_lib/fixtureArena";
import { checkRateLimitMany, getClientIp, hashValue } from "../../_lib/rateLimit";

export const dynamic = "force-dynamic";

function parseArena(value: string | null): ArenaType {
  return "main";
}

function parseTab(value: string | null): ArenaTab {
  return value === "results" ? "results" : "voting";
}

function emptyDebug(arena: ArenaType, pageIndex = 0) {
  return {
    requestedCount: 4,
    returnedCount: 0,
    arena,
    pageIndex,
    roundId: 1,
    eligibleCatsCount: 0,
    openMatchesCount: 0,
    existingCount: 0,
    generatedCount: 0,
    attempts: 0,
    timeWindow: new Date().toISOString().slice(0, 10),
    whyNotFilled: [] as string[],
    fairness: {
      exposureCounts: { min: 0, median: 0, max: 0 },
      newCatsIncluded: 0,
      duplicatesAvoided: 0,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const arena = parseArena(url.searchParams.get("arena"));
    const tab = parseTab(url.searchParams.get("tab"));
    const pageIndex = Math.max(0, Number(url.searchParams.get("page") || 0));
    const debugMode = url.searchParams.get("debug") === "1";
    const ipHash = hashValue(getClientIp(request));
    const rl = checkRateLimitMany([
      { key: `rl:arena-pages:ip:${ipHash || "unknown"}`, limit: 120, windowMs: 60_000 },
      { key: `rl:arena-pages:arena:${arena}:${tab}`, limit: 300, windowMs: 60_000 },
    ]);
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, error: "Too many refreshes. Please wait a few seconds." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    if (isFixtureModeRequest(request)) {
      const page = fixtureArenaPage(arena, tab, pageIndex);
      const etag = `"arena-pages:${page.dayKey}:${page.arena}:${page.tab}:${page.pageIndex}:fixture"`;
      if (request.headers.get("if-none-match") === etag) {
        return new NextResponse(null, { status: 304, headers: { ETag: etag, "Cache-Control": "private, max-age=5" } });
      }
      return NextResponse.json({
        ok: true,
        dayKey: page.dayKey,
        arena: page.arena,
        tab: page.tab,
        pageIndex: page.pageIndex,
        pageSize: page.pageSize,
        totalMatches: page.totalMatches,
        totalPages: page.totalPages,
        matches: page.matches,
        generatedAt: new Date().toISOString(),
        nextRefreshAtUtc: `${page.dayKey}T23:59:59.999Z`,
        activeVoters10m: page.activeVoters10m,
        voteSnapshotVersion: `fixture:${page.arena}:${page.tab}`,
      }, { headers: { ETag: etag, "Cache-Control": "private, max-age=5" } });
    }
    const userId = await getGuestId();
    let page = await loadArenaPage({ arena, tab, pageIndex, userId, targetCount: 4, debug: debugMode });
    if (tab === "voting" && page.matches.length === 0) {
      // Fallback: trigger tournament refill once, then retry.
      try {
        const origin = new URL(request.url).origin;
        await fetch(`${origin}/api/tournament/active?refresh=1`, { cache: "no-store" });
        page = await loadArenaPage({ arena, tab, pageIndex, userId, targetCount: 4, debug: debugMode });
      } catch {
        // ignore; return original empty result
      }
    }

    const payload: Record<string, unknown> = {
      ok: true,
      dayKey: page.dayKey,
      arena: page.arena,
      tab: page.tab,
      pageIndex: page.pageIndex,
      pageSize: page.pageSize,
      totalMatches: page.totalMatches,
      totalPages: page.totalPages,
      matches: page.matches,
      generatedAt: new Date().toISOString(),
      nextRefreshAtUtc: `${page.dayKey}T23:59:59.999Z`,
      activeVoters10m: page.activeVoters10m,
      voteSnapshotVersion: `${page.dayKey}:${page.arena}:${page.tab}:${page.pageIndex}`,
    };
    const etag = `"arena-pages:${payload.voteSnapshotVersion}"`;
    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag, "Cache-Control": "private, max-age=5" } });
    }
    if (debugMode) {
      payload.debug = page.debug || emptyDebug(arena, pageIndex);
    }
    return NextResponse.json(payload, { headers: { ETag: etag, "Cache-Control": "private, max-age=5" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const requestUrl = new URL(request.url);
    const arena = parseArena(requestUrl.searchParams.get("arena"));
    const tab = parseTab(requestUrl.searchParams.get("tab"));
    const debugMode = requestUrl.searchParams.get("debug") === "1";
    const pageIndex = Math.max(0, Number(requestUrl.searchParams.get("page") || 0));
    // Launch-safe fallback: avoid surfacing 500s to clients if page generation fails.
    const fallbackPayload: Record<string, unknown> = {
      ok: true,
      fallback: true,
      error: msg,
      dayKey: new Date().toISOString().slice(0, 10),
      arena,
      tab,
      pageIndex: 0,
      pageSize: 16,
      totalMatches: 0,
      totalPages: 1,
      matches: [],
      generatedAt: new Date().toISOString(),
      nextRefreshAtUtc: new Date().toISOString(),
      activeVoters10m: 0,
      voteSnapshotVersion: "fallback",
    };
    if (debugMode) fallbackPayload.debug = emptyDebug(arena, pageIndex);
    return NextResponse.json(fallbackPayload);
  }
}
