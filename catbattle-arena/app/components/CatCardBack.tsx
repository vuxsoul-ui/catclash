'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { checkTapTarget } from '../lib/dev-click-guards';

type BackCat = {
  id: string;
  name: string;
  rarity: string;
  level?: number;
  ability?: string | null;
  ability_description?: string | null;
  description?: string | null;
  lore?: string | null;
  tagline?: string | null;
  origin?: string | null;
  wins?: number;
  losses?: number;
  owner_username?: string | null;
  owner_guild?: 'sun' | 'moon' | null;
};

function cleanText(value: unknown): string {
  const s = String(value ?? '').trim();
  if (!s) return '';
  const bad = s.toLowerCase();
  if (bad === 'null' || bad === 'undefined' || bad === 'n/a') return '';
  return s;
}

function originLabel(origin: string | null | undefined): string {
  const v = cleanText(origin).toLowerCase();
  if (v === 'adopted') return 'Adopted';
  if (v === 'crate' || v === 'crate-drop') return 'Crate-drop';
  if (v === 'submitted') return 'Submitted';
  return 'Submitted';
}

function heatLabel(votes: number): string | null {
  if (votes >= 16) return 'HOT';
  if (votes >= 8) return 'HEATING';
  return null;
}

export default function CatCardBack({
  cat,
  role,
  votes,
  sharePct,
  onClose,
  className,
}: {
  cat: BackCat;
  role: 'Challenger' | 'Defender';
  votes: number;
  sharePct: number;
  onClose: () => void;
  className?: string;
}) {
  const desc =
    cleanText(cat.description) ||
    cleanText((cat as { lore?: string | null }).lore) ||
    cleanText((cat as { tagline?: string | null }).tagline) ||
    'No lore yet. This cat is a mystery.';
  const displayName = cleanText((cat as { display_name?: string | null }).display_name) || cleanText(cat.name) || 'Unnamed Cat';
  const owner = cleanText(cat.owner_username);
  const wins = Math.max(0, Number(cat.wins || 0));
  const losses = Math.max(0, Number(cat.losses || 0));
  const guild = cat.owner_guild === 'sun' ? 'Solar' : cat.owner_guild === 'moon' ? 'Lunar' : null;
  const heat = heatLabel(votes);
  const ability = cleanText(cat.ability);
  const abilityDesc = cleanText(cat.ability_description);
  const meta = [
    { k: 'Rarity', v: cat.rarity },
    { k: 'Level', v: String(Math.max(1, Number(cat.level || 1))) },
    { k: 'Faction', v: guild || 'Unaligned' },
    { k: 'Origin', v: originLabel(cat.origin || null) },
    { k: 'Role', v: role },
    { k: 'Record', v: `${wins}-${losses}` },
    { k: 'Share', v: `${Math.max(0, Math.min(100, Math.round(sharePct)))}%` },
  ];

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const timer = window.setTimeout(() => {
      checkTapTarget({
        key: `cat-back-open-profile-${cat.id}`,
        selector: `[data-cat-back-actions="${cat.id}"] a[href="/cat/${cat.id}"]`,
        expect: ['A'],
      });
      checkTapTarget({
        key: `cat-back-share-${cat.id}`,
        selector: `[data-cat-back-actions="${cat.id}"] a[href="/c/${cat.id}/share"]`,
        expect: ['A'],
      });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [cat.id]);

  return (
    <div className={`arena-flip-face arena-flip-back arena-fighter-pane rounded-2xl border border-white/15 p-2 h-full min-h-0 flex flex-col overflow-hidden ${className || ''}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-[11px] font-semibold truncate">{displayName}</p>
        <button
          type="button"
          onClick={onClose}
          className="text-[9px] px-1.5 py-0.5 rounded border border-white/20 bg-white/10 text-white/85"
          aria-label={`Close ${displayName} details`}
        >
          Back
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]">
        <p className="text-[9px] text-white/78 leading-relaxed">{desc}</p>

        <Link
          href={`/cat/${cat.id}`}
          className="mt-1 flex items-center justify-between rounded-lg border border-white/12 bg-white/[0.04] px-2 py-1 text-[9px]"
        >
          <span className="text-white/55">Owner</span>
          <span className="text-cyan-100 truncate max-w-[60%] text-right">{owner ? `@${owner}` : 'Unknown'}</span>
        </Link>

        <div className="mt-1 grid grid-cols-2 gap-1 text-[8px]">
          {meta.map((item) => (
            <div key={item.k} className="rounded border border-white/12 bg-white/[0.04] px-1.5 py-1 min-w-0">
              <p className="text-white/50 leading-none mb-0.5">{item.k}</p>
              <p className="text-white/90 truncate leading-none">{item.v}</p>
            </div>
          ))}
        </div>

        {ability ? (
          <div className="mt-1 rounded-lg border border-cyan-300/20 bg-cyan-500/10 px-2 py-1 min-w-0">
            <p className="text-[9px] text-cyan-100 font-semibold">Ability: {ability}</p>
            {abilityDesc ? <p className="text-[8px] text-cyan-100/75">{abilityDesc}</p> : null}
          </div>
        ) : null}

        <div className="mt-1 flex items-center justify-between text-[8px] pb-1">
          <span className="text-white/65">Votes: {votes}</span>
          {heat ? <span className="rounded-full border border-amber-300/35 bg-amber-500/12 px-1.5 py-0.5 text-amber-100">{heat}</span> : null}
        </div>
      </div>

      <div data-cat-back-actions={cat.id} className="pt-1 grid grid-cols-2 gap-1.5 items-stretch">
        <Link href={`/cat/${cat.id}`} className="h-10 w-full rounded-md border border-cyan-300/30 bg-cyan-500/10 text-cyan-100 text-[10px] font-semibold inline-flex items-center justify-center whitespace-nowrap touch-manipulation">
          Open Cat Profile
        </Link>
        <Link href={`/c/${cat.id}/share`} className="h-10 w-full rounded-md border border-white/20 bg-white/[0.06] text-white text-[10px] font-semibold inline-flex items-center justify-center whitespace-nowrap touch-manipulation">
          Share Card
        </Link>
      </div>
    </div>
  );
}
