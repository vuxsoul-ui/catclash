'use client';

import type { DuelRowData } from './types';

function duelMeta(duel: DuelRowData): { label: string; cls: string } {
  if (duel.status === 'pending') return { label: 'PENDING', cls: 'bg-amber-500/15 text-amber-200 border-amber-300/25' };
  if (duel.status === 'completed') return { label: 'RESULT', cls: 'bg-white/10 text-white/80 border-white/20' };
  const votes = Number(duel.votes?.total || 0);
  if (votes >= 16) return { label: 'HEATING', cls: 'bg-orange-500/15 text-orange-200 border-orange-300/25' };
  return { label: 'LIVE', cls: 'bg-emerald-500/15 text-emerald-200 border-emerald-300/25' };
}

export default function DuelRow({
  duel,
  actionLabel,
  onOpen,
}: {
  duel: DuelRowData;
  actionLabel?: string;
  onOpen: (duel: DuelRowData) => void;
}) {
  const votes = Number(duel.votes?.total || 0);
  const meta = duelMeta(duel);
  const label = actionLabel || (duel.status === 'voting' ? 'Vote' : 'View');

  return (
    <div className="h-[84px] rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2.5 flex items-center gap-2.5">
      <div className="relative shrink-0 w-[52px] h-[36px]">
        <img
          src={duel.challenger_cat?.image_url || '/cat-placeholder.svg'}
          alt={duel.challenger_cat?.name || 'Cat A'}
          width={28}
          height={28}
          className="absolute left-0 top-1 h-7 w-7 rounded-full object-cover border border-white/20"
          loading="lazy"
        />
        <img
          src={duel.challenged_cat?.image_url || '/cat-placeholder.svg'}
          alt={duel.challenged_cat?.name || 'Cat B'}
          width={28}
          height={28}
          className="absolute left-4 top-1 h-7 w-7 rounded-full object-cover border border-white/20"
          loading="lazy"
        />
        <span className="absolute left-[34px] top-2 text-[9px] font-bold text-white/65">VS</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-white truncate">
          {duel.challenger_cat?.name || duel.challenger_username} vs {duel.challenged_cat?.name || duel.challenged_username}
        </p>
        <p className="text-[10px] text-white/60 truncate">
          {votes} votes • {String(duel.status || 'voting')}
        </p>
        <span className={`mt-1 inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${meta.cls}`}>{meta.label}</span>
      </div>
      <button
        onClick={() => onOpen(duel)}
        className="shrink-0 h-11 min-w-[62px] rounded-lg bg-white text-black px-3 text-[11px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 touch-manipulation"
      >
        {label}
      </button>
    </div>
  );
}
