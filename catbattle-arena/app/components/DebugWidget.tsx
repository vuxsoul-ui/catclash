'use client';

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

type Props = {
  arenaType: 'main' | 'rookie';
  onHydrate?: (payload: unknown) => void;
  onRefresh?: (payload: unknown) => void;
};

export default function DebugWidget({ arenaType, onHydrate, onRefresh }: Props) {
  const searchParams = useSearchParams();
  const debug = useMemo(() => searchParams?.get('debug') === '1', [searchParams]);
  if (!debug) return null;

  const handleClick = useCallback(async () => {
    const url = `/api/arena/refresh?arena=${encodeURIComponent(arenaType)}&debug=1`;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      const bodyText = await res.text();
      // eslint-disable-next-line no-console
      console.log('[DEBUG_WIDGET] refresh', { url, status: res.status, body_len: bodyText.length });

      let payload: unknown = null;
      try {
        payload = JSON.parse(bodyText);
      } catch {
        payload = null;
      }

      if (typeof onHydrate === 'function') onHydrate(payload);
      else if (typeof onRefresh === 'function') onRefresh(payload);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('[DEBUG_WIDGET] refresh failed', e);
    }
  }, [arenaType, onHydrate, onRefresh]);

  return (
    <div className="fixed bottom-4 right-4 z-[99999] rounded-2xl border border-white/60 bg-black/80 p-3 text-xs text-white shadow-[0_8px_28px_rgba(0,0,0,0.65)] backdrop-blur">
      <div className="font-mono text-[11px] tracking-[0.3em] text-yellow-300 mb-1">DEBUG</div>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-500/10 px-3 py-1 font-semibold text-[11px] text-cyan-100 hover:border-cyan-200/80"
      >
        Refresh matches
      </button>
    </div>
  );
}
