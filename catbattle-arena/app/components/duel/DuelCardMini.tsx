'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import type { DuelRowData } from './types';
import { checkTapTarget } from '../../lib/dev-click-guards';
import { scanDuplicateTestIds } from '../../lib/dev-testid-guard';

function duelBadge(duel: DuelRowData): { label: string; cls: string } {
  if (duel.status === 'completed') return { label: 'RESULT', cls: 'bg-white/10 text-white/80 border-white/20' };
  const votes = Number(duel.votes?.total || 0);
  if (votes >= 16) return { label: 'HEATING', cls: 'bg-orange-500/15 text-orange-200 border-orange-300/30' };
  return { label: 'LIVE', cls: 'bg-emerald-500/15 text-emerald-200 border-emerald-300/30' };
}

export default function DuelCardMini({ duel }: { duel: DuelRowData }) {
  const catA = duel.challenger_cat;
  const catB = duel.challenged_cat;
  const badge = duelBadge(duel);
  const votes = Number(duel.votes?.total || 0);
  const duelHref = `/duel?tab=live&duel=${encodeURIComponent(duel.id)}`;
  const openLinkTestId = `open-duel-link-${duel.id}`;
  const ctaLinkTestId = `open-duel-link-cta-${duel.id}`;
  const votesA = Number(duel.votes?.cat_a || 0);
  const votesB = Number(duel.votes?.cat_b || 0);
  const pctA = votes > 0 ? Math.round((votesA / Math.max(1, votes)) * 100) : 50;
  const pctB = 100 - pctA;

  const withFallbackNav = (href: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const before = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.setTimeout(() => {
      const after = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (after === before) window.location.assign(href);
    }, 220);
  };

  const safeThumb = (url: string | null | undefined) => {
    const raw = String(url || '').trim();
    if (!raw) return '/cat-placeholder.svg';
    if (raw.includes('/cat-placeholder')) return raw;
    return /\/thumb\.webp(?:$|[?#])/i.test(raw) ? raw : '/cat-placeholder.svg';
  };

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const timer = window.setTimeout(() => {
      checkTapTarget({ key: `duel-card-open-${duel.id}`, selector: `[data-testid="${openLinkTestId}"]`, expect: ['A'] });
      checkTapTarget({ key: `duel-cta-open-${duel.id}`, selector: `[data-testid="${ctaLinkTestId}"]`, expect: ['A'] });
      scanDuplicateTestIds(`duel-card-${duel.id}`);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [ctaLinkTestId, duel.id, openLinkTestId]);

  return (
    <div className="live-duel-card group relative w-full overflow-hidden rounded-2xl border border-cyan-200/20 bg-[linear-gradient(165deg,rgba(12,23,40,0.88),rgba(12,16,24,0.92))] p-2.5 shadow-[0_12px_28px_rgba(0,0,0,0.35)] transition-all duration-200 hover:border-cyan-300/35 hover:shadow-[0_14px_34px_rgba(34,211,238,0.16)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_-10%,rgba(34,211,238,0.18),transparent_42%),radial-gradient(circle_at_10%_120%,rgba(249,115,22,0.12),transparent_36%)]" />
      <Link
        href={duelHref}
        onClick={withFallbackNav(duelHref)}
        data-testid={openLinkTestId}
        className="relative z-10 block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 tap-target"
        aria-label={`Open live duel ${catA?.name || 'Cat A'} versus ${catB?.name || 'Cat B'}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="live-duel-avatars relative flex items-center -space-x-2.5">
            <img
              src={safeThumb(catA?.image_url)}
              alt={catA?.name || 'Cat A'}
              width={40}
              height={40}
              className="live-duel-avatar live-duel-avatar-a h-10 w-10 rounded-full object-cover border border-white/20"
              loading="lazy"
            />
            <img
              src={safeThumb(catB?.image_url)}
              alt={catB?.name || 'Cat B'}
              width={40}
              height={40}
              className="live-duel-avatar live-duel-avatar-b h-10 w-10 rounded-full object-cover border border-white/20"
              loading="lazy"
            />
            <span className="live-duel-vs absolute left-1/2 -translate-x-1/2 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-white/25 bg-black/55 px-1 text-[9px] font-black text-white/90">
              VS
            </span>
          </div>
          <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${badge.cls}`}>
            {badge.label}
          </span>
        </div>
        <p className="mt-2 text-[11px] font-semibold text-white truncate">{catA?.name || 'Unknown'} vs {catB?.name || 'Unknown'}</p>
        <p className="mt-0.5 text-[10px] text-white/65 truncate">
          {duel.status === 'pending' ? 'New duel' : `${votes} votes`}
        </p>
        <div className="mt-2 flex items-center justify-between text-[9px] font-semibold text-white/60">
          <span className="truncate max-w-[44%]">{catA?.name || 'A'} {pctA}%</span>
          <span className="truncate max-w-[44%] text-right">{pctB}% {catB?.name || 'B'}</span>
        </div>
        <div className="live-duel-votebar mt-1.5 h-2 rounded-full bg-white/10 overflow-hidden flex">
          <div
            className="live-duel-votebar-a h-full bg-gradient-to-r from-orange-400 to-amber-300 transition-all duration-300"
            style={{ width: `${Math.max(10, pctA)}%` }}
          />
          <div
            className="live-duel-votebar-b h-full bg-gradient-to-r from-sky-400 to-cyan-300 transition-all duration-300"
            style={{ width: `${Math.max(10, pctB)}%` }}
          />
        </div>
      </Link>
      <Link
        href={duelHref}
        onClick={withFallbackNav(duelHref)}
        data-testid={ctaLinkTestId}
        className="relative z-10 mt-2 inline-flex h-10 w-full items-center justify-center rounded-xl border border-cyan-300/35 bg-cyan-500/16 px-2 text-[10px] font-bold tracking-wide text-cyan-100 hover:bg-cyan-500/24 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 touch-manipulation"
        aria-label="Open Duel"
      >
        Enter Duel
      </Link>
    </div>
  );
}
