import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGuestId } from "../../_lib/guest";
import { getUtcDayKey } from "../../_lib/arena-pages";

export const dynamic = "force-dynamic";

function parseArena(value: string | null): "main" | "rookie" {
  return value === "rookie" ? "rookie" : "main";
}

function admin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getGuestId();
    const url = new URL(request.url);
    const arena = parseArena(url.searchParams.get("arena"));
    const dayKey = getUtcDayKey();
    const supabase = admin();
    const { data, error } = await supabase
      .from("user_arena_progress")
      .select("arena, day_key, page_index, within_page_offset, voted_match_ids, updated_at")
      .eq("user_id", userId)
      .eq("arena", arena)
      .eq("day_key", dayKey)
      .maybeSingle();
    if (error) {
      // Progress persistence is non-critical; fail-soft to avoid breaking arena flow.
      return NextResponse.json({
        ok: true,
        progress: null,
        skipped: "progress_read_unavailable",
        reason: String((error as any)?.code || (error as any)?.message || "unknown"),
      });
    }
    return NextResponse.json({ ok: true, progress: data || null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String((e as any)?.message || e);
    return NextResponse.json({ ok: true, progress: null, skipped: "progress_read_failed", reason: msg });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getGuestId();
    const body = await request.json().catch(() => ({}));
    const arena = parseArena(String(body?.arena || null));
    const pageIndex = Math.max(0, Number(body?.pageIndex || 0));
    const withinPageOffset = Math.max(0, Number(body?.withinPageOffset || 0));
    const votedMatchIds = Array.isArray(body?.votedMatchIds)
      ? body.votedMatchIds.map((v: unknown) => String(v)).slice(0, 64)
      : [];
    const dayKey = getUtcDayKey();
    const supabase = admin();
    const { error } = await supabase
      .from("user_arena_progress")
      .upsert({
        user_id: userId,
        arena,
        day_key: dayKey,
        page_index: pageIndex,
        within_page_offset: withinPageOffset,
        voted_match_ids: votedMatchIds,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,arena,day_key" });
    if (error) {
      // Progress persistence is non-critical; fail-soft to avoid breaking arena flow.
      return NextResponse.json({
        ok: true,
        skipped: "progress_write_unavailable",
        reason: String((error as any)?.code || (error as any)?.message || "unknown"),
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String((e as any)?.message || e);
    return NextResponse.json({ ok: true, skipped: "progress_write_failed", reason: msg });
  }
}
