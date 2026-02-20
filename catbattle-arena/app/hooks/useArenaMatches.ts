'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type RefreshResult = {
  ok: boolean;
  count: number;
  status?: string | null;
};

type Params<T> = {
  arenaType: string;
  viewMode: 'voting' | 'results';
  pageIndex: number;
  round: number;
  matches: T[];
  enabled?: boolean;
  onRefresh?: () => Promise<RefreshResult>;
};

const BACKOFF_MS = [400, 900, 1800] as const;

function emitTelemetry(event: string, payload: Record<string, unknown>) {
  fetch('/api/telemetry/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, payload }),
  }).catch(() => null);
}

export function useArenaMatches<T>({
  arenaType,
  viewMode,
  pageIndex,
  round,
  matches,
  enabled = true,
  onRefresh,
}: Params<T>) {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefilling, setIsRefilling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualRefreshHint, setManualRefreshHint] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);

  const retriesRunningRef = useRef(false);
  const cancelledRef = useRef(false);

  const matchesCount = matches.length;

  const runRetrySequence = useCallback(async () => {
    if (!enabled || retriesRunningRef.current || viewMode !== 'voting' || !onRefresh) return;
    retriesRunningRef.current = true;
    setIsRefilling(true);
    setError(null);
    setManualRefreshHint(false);
    emitTelemetry('arena_fetch_empty', { arenaType, viewMode, pageIndex, round });

    const startedAt = Date.now();

    for (let i = 0; i < BACKOFF_MS.length; i += 1) {
      if (cancelledRef.current) break;
      const delay = BACKOFF_MS[i];
      setRetryAttempt(i + 1);
      emitTelemetry('arena_refill_retry', { arenaType, viewMode, pageIndex, round, attempt: i + 1, delay_ms: delay });
      await new Promise((resolve) => setTimeout(resolve, delay));
      if (cancelledRef.current) break;

      const result = await onRefresh();
      if (!result?.ok) continue;
      if (Number(result.count || 0) > 0) {
        setIsRefilling(false);
        setManualRefreshHint(false);
        setError(null);
        retriesRunningRef.current = false;
        emitTelemetry('arena_fetch_success', { arenaType, viewMode, pageIndex, round, count: Number(result.count || 0) });
        return;
      }
    }

    if (!cancelledRef.current) {
      setIsRefilling(false);
      setManualRefreshHint(true);
      setError('Arena is reloading.');
      emitTelemetry('arena_refill_failed', {
        arenaType,
        viewMode,
        pageIndex,
        round,
        retry_count: BACKOFF_MS.length,
        elapsed_ms: Date.now() - startedAt,
      });
    }
    retriesRunningRef.current = false;
  }, [arenaType, enabled, onRefresh, pageIndex, round, viewMode]);

  const refresh = useCallback(async () => {
    if (!onRefresh) return false;
    emitTelemetry('arena_fetch_start', { arenaType, viewMode, pageIndex, round, manual: true });
    setManualRefreshHint(false);
    setError(null);
    setIsRefilling(true);
    const result = await onRefresh();
    const count = Number(result?.count || 0);
    if (result?.ok && count > 0) {
      setIsRefilling(false);
      setError(null);
      emitTelemetry('arena_fetch_success', { arenaType, viewMode, pageIndex, round, count, manual: true });
      return true;
    }
    setIsRefilling(false);
    setError('Arena is reloading.');
    setManualRefreshHint(true);
    emitTelemetry('arena_fetch_empty', { arenaType, viewMode, pageIndex, round, manual: true });
    return false;
  }, [arenaType, onRefresh, pageIndex, round, viewMode]);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    emitTelemetry('arena_fetch_start', { arenaType, viewMode, pageIndex, round, source: 'state-change' });
    if (matchesCount > 0) {
      setIsLoading(false);
      setIsRefilling(false);
      setError(null);
      setManualRefreshHint(false);
      setRetryAttempt(0);
      retriesRunningRef.current = false;
      emitTelemetry('arena_fetch_success', { arenaType, viewMode, pageIndex, round, count: matchesCount, source: 'state-change' });
      return;
    }

    if (viewMode !== 'voting') {
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
    void runRetrySequence();
  }, [arenaType, enabled, matchesCount, pageIndex, round, runRetrySequence, viewMode]);

  useEffect(() => {
    if (!isRefilling) return;
    const id = window.setTimeout(() => {
      setManualRefreshHint(true);
    }, 2500);
    return () => window.clearTimeout(id);
  }, [isRefilling]);

  return useMemo(
    () => ({
      matches,
      isLoading,
      isRefilling,
      error,
      retryAttempt,
      showManualRefresh: manualRefreshHint,
      refresh,
    }),
    [error, isLoading, isRefilling, manualRefreshHint, matches, refresh, retryAttempt],
  );
}
