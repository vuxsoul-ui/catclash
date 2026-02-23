'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import type { DuelRowData } from './types';
import { scanDuplicateTestIds } from '../../lib/dev-testid-guard';

function duelBadge(duel: DuelRowData): { label: string; cls: string } {
  if (duel.status === 'completed') return { label: 'RESULT', cls: 'bg-white/10 text-white/80 border-white/20' };
  const votes = Number(duel.votes?.total || 0);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const timer = window.setTimeout(() => {
      scanDuplicateTestIds(`duel-card-`);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [duel.id]);
  if (votes >= 16) return { label: 'HEATING', cls: 'bg-orange-500/15 text-orange-200 border-orange-300/30' };
  return { label: 'LIVE', cls: 'bg-emerald-500/15 text-emerald-200 border-emerald-300/30' };
}

export default function DuelCardMini({ duel }: { duel: DuelRowData }) {
  const catA = duel.challenger_cat;
  const catB = duel.challenged_cat;
  const badge = duelBadge(duel);
  const votes = Number(duel.votes?.total || 0);

  return (
    <Link
      href={`/duel?tab=live&duel=${encodeURIComponent(duel.id)}`}
      className="group block w-full rounded-xl border border-white/12 bg-white/[0.035] p-2.5 backdrop-blur-sm active:scale-[0.99] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center -space-x-2.5">
          <img
            src={catA?.image_url || '/cat-placeholder.svg'}
            alt={catA?.name || 'Cat A'}
            width={40}
            height={40}
            className="h-10 w-10 rounded-full object-cover border border-white/20"
            loading="lazy"
          />
          <img
            src={catB?.image_url || '/cat-placeholder.svg'}
            alt={catB?.name || 'Cat B'}
            width={40}
            height={40}
            className="h-10 w-10 rounded-full object-cover border border-white/20"
            loading="lazy"
          />
        </div>
        <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${badge.cls}`}>
          {badge.label}
        </span>
      </div>
      <p className="mt-2 text-[11px] font-semibold text-white truncate">{catA?.name || 'Unknown'} vs {catB?.name || 'Unknown'}</p>
      <p className="mt-0.5 text-[10px] text-white/60 truncate">
        {duel.status === 'pending' ? 'New duel' : `${votes} votes`}
      </p>
      <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden flex">
        <div
          className="h-full bg-orange-400/85 transition-all duration-300"
          style={{ width: `${Math.max(10, Number(duel.votes?.cat_a || 0) + Number(duel.votes?.cat_b || 0) > 0 ? Math.round((Number(duel.votes?.cat_a || 0) / Math.max(1, votes)) * 100) : 50)}%` }}
        />
        <div
          className="h-full bg-cyan-400/80 transition-all duration-300"
          style={{ width: `${Math.max(10, Number(duel.votes?.cat_a || 0) + Number(duel.votes?.cat_b || 0) > 0 ? Math.round((Number(duel.votes?.cat_b || 0) / Math.max(1, votes)) * 100) : 50)}%` }}
        />
      </div>
      <div className="mt-2 inline-flex h-7 items-center rounded-lg border border-cyan-300/30 bg-cyan-500/12 px-2 text-[10px] font-semibold text-cyan-100 group-hover:bg-cyan-500/20">
        Open Duel
      </div>
    </Link>
  );
}
