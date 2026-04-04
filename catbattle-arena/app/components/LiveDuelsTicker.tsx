'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { DuelRowData } from './duel/types';
import { formatPulseCountdown, getVirtualPulse } from '../lib/virtual-pulse';

function safeThumb(url: string | null | undefined): string {
  const raw = String(url || '').trim();
  if (!raw) return '/cat-placeholder.svg';
  if (raw.includes('/cat-placeholder')) return raw;
  return /\/thumb\.webp(?:$|[?#])/i.test(raw) ? raw : '/cat-placeholder.svg';
}

type LiveDuelsTickerProps = {
  duels: DuelRowData[];
  liveDuelCount: number;
  onOpenDuels?: () => void;
  className?: string;
};

export default function LiveDuelsTicker({
  duels,
  liveDuelCount,
  onOpenDuels,
  className = '',
}: LiveDuelsTickerProps) {
  const [mounted, setMounted] = useState(false);
  const [tickMs, setTickMs] = useState(0);
  useEffect(() => {
    setMounted(true);
    setTickMs(Date.now());
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setTickMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const pulse = useMemo(() => getVirtualPulse(tickMs), [tickMs]);
  const active = liveDuelCount > 0 && duels.length > 0;
  const duel = active ? duels[0] : null;
  const duelHref = duel ? `/duel?tab=live&duel=${encodeURIComponent(duel.id)}` : '/duel';
  const headline = duel ? `${duel.challenger_username || 'A rival'} is defending the Crown!` : null;
  const passiveTitle = pulse.state === 'live' ? '🔥 Pulse Live' : pulse.state === 'resolving' ? '⏳ Calculating...' : '✨ Vote Open';
  const passiveSubline = pulse.state === 'live'
    ? `Ends in ${mounted ? formatPulseCountdown(pulse.msRemaining) : '—'}`
    : pulse.state === 'resolving'
      ? 'Next pulse opens soon'
      : duels.length > 0
        ? `${duels.length} matches queued`
        : 'Vote now for bonus';

  return (
    <section
      className={`relative overflow-hidden rounded-full border border-cyan-300/20 bg-slate-900/40 backdrop-blur-xl h-14 px-3 ${className}`}
      aria-label="Live Duels Broadcast"
    >
      <span className="pointer-events-none absolute inset-y-0 w-px bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.1),transparent)] live-duels-scanner" />
      <div className="relative z-10 flex h-full items-center gap-2">
        <div className="shrink-0">
          {active ? (
            <span className="inline-flex h-5 w-5 items-center justify-center">
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <circle cx="12" cy="12" r="2" fill="rgba(34,211,238,0.75)" />
                <circle cx="12" cy="12" r="5" className="live-duels-pulse-ring" stroke="rgba(34,211,238,0.4)" strokeWidth="1" fill="none" />
                <circle cx="12" cy="12" r="5" className="live-duels-pulse-ring live-duels-pulse-ring--delay" stroke="rgba(34,211,238,0.28)" strokeWidth="1" fill="none" />
              </svg>
            </span>
          ) : (
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-white/70 live-duels-passive-dot">
              •
            </span>
          )}
        </div>

        {active && duel ? (
          <div className="live-duels-state live-duels-state--active min-w-0 flex flex-1 items-center gap-1.5">
            <img src={safeThumb(duel.challenger_cat?.image_url)} alt={duel.challenger_cat?.name || 'A'} className="h-6 w-6 shrink-0 rounded-full border border-white/20 object-cover" loading="lazy" />
            <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/56">VS</span>
            <img src={safeThumb(duel.challenged_cat?.image_url)} alt={duel.challenged_cat?.name || 'B'} className="h-6 w-6 shrink-0 rounded-full border border-white/20 object-cover" loading="lazy" />
            <p className="min-w-0 flex-1 truncate text-xs font-semibold text-white/80">{headline}</p>
          </div>
        ) : (
          <div className="live-duels-state live-duels-state--passive min-w-0 flex flex-1 items-center gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white/82">{passiveTitle}</p>
              <p className="truncate text-[10px] text-cyan-100/66">{passiveSubline}</p>
            </div>
          </div>
        )}

        <Link
          href={duelHref}
          onClick={() => onOpenDuels?.()}
          className="shrink-0 inline-flex h-9 min-w-[92px] items-center justify-center gap-1 rounded-full border border-cyan-300/30 bg-[linear-gradient(90deg,rgba(30,41,59,0.7),rgba(8,145,178,0.22))] px-3 text-[11px] font-semibold text-cyan-50 shadow-[0_0_10px_rgba(34,211,238,0.14)] transition-transform duration-100 active:scale-95"
        >
          Open
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </section>
  );
}
