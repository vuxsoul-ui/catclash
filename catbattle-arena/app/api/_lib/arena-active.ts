import type { SupabaseClient } from "@supabase/supabase-js";

export const CANONICAL_ACTIVE_STATUS = "active";
export const ACTIVE_STATUS_ALIASES = ["active", "in_progress", "open", "voting", "voting_now"] as const;
export const CLOSED_STATUS_ALIASES = ["complete", "completed", "closed", "archived"] as const;
export type ArenaType = "main" | "rookie";
export type ArenaInactiveReason = "NO_TOURNAMENT" | "NO_ACTIVE_ROUND" | "ROUND_CLOSED" | "UTC_MISMATCH" | "STATUS_MISMATCH" | "OK";

export function normalizeArenaStatus(input: string | null | undefined): string {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return CANONICAL_ACTIVE_STATUS;
  if (ACTIVE_STATUS_ALIASES.includes(raw as any)) return CANONICAL_ACTIVE_STATUS;
  if (CLOSED_STATUS_ALIASES.includes(raw as any)) return "complete";
  return raw;
}

export function computeArenaUtcContext(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();
  const startUtc = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  const endUtc = new Date(Date.UTC(year, month, day + 1, 0, 0, 0, 0));
  const dayKeyUtc = startUtc.toISOString().slice(0, 10);
  return {
    serverNowUtc: now.toISOString(),
    dayKeyUtc,
    pulseWindow: {
      startUtc: startUtc.toISOString(),
      endUtc: endUtc.toISOString(),
      nextPulseUtc: endUtc.toISOString(),
    },
  };
}

type EnsureActiveArenasResult = {
  serverNowUtc: string;
  computedDayKey: string;
  computedPulseWindow: { startUtc: string; endUtc: string; nextPulseUtc: string };
  arenaStatusSeen: string[];
  activeTournamentIds: { main: string | null; rookie: string | null };
  activeRoundIds: { main: string | null; rookie: string | null };
  reason: ArenaInactiveReason;
};

export async function ensureActiveArenasUtc(supabase: SupabaseClient, now = new Date()): Promise<EnsureActiveArenasResult> {
  const utc = computeArenaUtcContext(now);
  const arenaTypes: ArenaType[] = ["main", "rookie"];

  const { data: sameDayRows } = await supabase
    .from("tournaments")
    .select("id, tournament_type, round, status, date")
    .eq("date", utc.dayKeyUtc)
    .in("tournament_type", arenaTypes as any);
  const rows = sameDayRows || [];
  const statusSeen = Array.from(new Set(rows.map((r: any) => normalizeArenaStatus(r?.status || ""))));

  let reason: ArenaInactiveReason = "OK";
  if (rows.length === 0) {
    const prevDay = new Date(new Date(utc.pulseWindow.startUtc).getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const nextDay = new Date(new Date(utc.pulseWindow.endUtc).getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data: nearRows } = await supabase
      .from("tournaments")
      .select("id")
      .in("tournament_type", arenaTypes as any)
      .gte("date", prevDay)
      .lte("date", nextDay)
      .limit(1);
    reason = (nearRows || []).length > 0 ? "UTC_MISMATCH" : "NO_TOURNAMENT";
  } else if (rows.some((r: any) => normalizeArenaStatus(r?.status || "") !== CANONICAL_ACTIVE_STATUS)) {
    reason = "STATUS_MISMATCH";
  }

  const byType: Record<ArenaType, any | null> = { main: null, rookie: null };
  for (const type of arenaTypes) {
    const options = rows.filter((r: any) => String(r?.tournament_type || "") === type);
    byType[type] = options.find((r: any) => normalizeArenaStatus(r?.status || "") === CANONICAL_ACTIVE_STATUS) || options[0] || null;
    if (!byType[type]) {
      const { data: inserted } = await supabase
        .from("tournaments")
        .insert({
          date: utc.dayKeyUtc,
          status: CANONICAL_ACTIVE_STATUS,
          round: 1,
          tournament_type: type,
        })
        .select("id, tournament_type, round, status, date")
        .single();
      if (inserted) {
        byType[type] = inserted;
      }
    }
    if (!byType[type]) continue;

    const round = Math.max(1, Number(byType[type].round || 1));
    const status = normalizeArenaStatus(byType[type].status || "");
    if (round !== Number(byType[type].round || 1) || status !== CANONICAL_ACTIVE_STATUS) {
      await supabase
        .from("tournaments")
        .update({ round, status: CANONICAL_ACTIVE_STATUS })
        .eq("id", byType[type].id);
      byType[type] = { ...byType[type], round, status: CANONICAL_ACTIVE_STATUS };
    }

    const { data: activeCurrentRound } = await supabase
      .from("tournament_matches")
      .select("id")
      .eq("tournament_id", byType[type].id)
      .eq("round", round)
      .eq("status", CANONICAL_ACTIVE_STATUS)
      .limit(1);
    if ((activeCurrentRound || []).length > 0) continue;

    if (reason === "OK") reason = "NO_ACTIVE_ROUND";
    const { data: activeAnyRound } = await supabase
      .from("tournament_matches")
      .select("id, round")
      .eq("tournament_id", byType[type].id)
      .eq("status", CANONICAL_ACTIVE_STATUS)
      .order("round", { ascending: false })
      .limit(1);
    if ((activeAnyRound || []).length > 0) {
      const nextRound = Math.max(1, Number(activeAnyRound?.[0]?.round || 1));
      await supabase.from("tournaments").update({ round: nextRound, status: CANONICAL_ACTIVE_STATUS }).eq("id", byType[type].id);
      byType[type] = { ...byType[type], round: nextRound, status: CANONICAL_ACTIVE_STATUS };
      continue;
    }

    if (reason === "NO_ACTIVE_ROUND") reason = "ROUND_CLOSED";
    const { data: latestRound } = await supabase
      .from("tournament_matches")
      .select("round")
      .eq("tournament_id", byType[type].id)
      .order("round", { ascending: false })
      .limit(1);
    const reopenRound = Math.max(1, Number(latestRound?.[0]?.round || 1));
    const { data: roundRows } = await supabase
      .from("tournament_matches")
      .select("id, status")
      .eq("tournament_id", byType[type].id)
      .eq("round", reopenRound);
    const reopenIds = (roundRows || [])
      .filter((m: any) => normalizeArenaStatus(m?.status || "") === "complete")
      .map((m: any) => String(m.id))
      .filter(Boolean);
    if (reopenIds.length > 0) {
      await supabase.from("tournament_matches").update({ status: CANONICAL_ACTIVE_STATUS }).in("id", reopenIds);
      await supabase.from("tournaments").update({ round: reopenRound, status: CANONICAL_ACTIVE_STATUS }).eq("id", byType[type].id);
      byType[type] = { ...byType[type], round: reopenRound, status: CANONICAL_ACTIVE_STATUS };
    }
  }

  const activeTournamentIds = {
    main: byType.main?.id ? String(byType.main.id) : null,
    rookie: byType.rookie?.id ? String(byType.rookie.id) : null,
  };
  const activeRoundIds = {
    main: byType.main?.id ? `${byType.main.id}:r${Math.max(1, Number(byType.main.round || 1))}` : null,
    rookie: byType.rookie?.id ? `${byType.rookie.id}:r${Math.max(1, Number(byType.rookie.round || 1))}` : null,
  };

  return {
    serverNowUtc: utc.serverNowUtc,
    computedDayKey: utc.dayKeyUtc,
    computedPulseWindow: utc.pulseWindow,
    arenaStatusSeen: statusSeen,
    activeTournamentIds,
    activeRoundIds,
    reason,
  };
}
