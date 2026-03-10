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

function heatLabel(votes: number): string | null {
  if (votes >= 16) return 'HOT';
  if (votes >= 8) return 'HEATING';
  return null;
}

function rarityTierClass(rarity: string): string {
  const key = cleanText(rarity).toLowerCase();
  if (key === 'rare') return 'tier-rare';
  if (key === 'epic') return 'tier-epic';
  if (key === 'legendary') return 'tier-legendary';
  if (key === 'mythic') return 'tier-mythic';
  return 'tier-common';
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
  const tierClass = rarityTierClass(cat.rarity);
  const meta = [
    { k: 'Rarity', v: cat.rarity },
    { k: 'Level', v: String(Math.max(1, Number(cat.level || 1))) },
    { k: 'Faction', v: guild || 'Unaligned' },
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
    <div className={`arena-flip-face arena-flip-back arena-fighter-pane cat-card-back-shell ${tierClass} rounded-2xl h-full min-h-0 flex flex-col overflow-hidden ${className || ''}`}>
      <div className="cat-card-back-accent" />

      <div className="relative z-[1] flex items-center justify-between gap-2 px-3 pt-2.5">
        <div className="min-w-0">
          <p className="cat-card-back-name truncate">{displayName}</p>
          <p className="cat-card-back-lore truncate">{desc}</p>
        </div>
        <span className="cat-card-back-tier-chip shrink-0">{cleanText(cat.rarity || 'Common').toUpperCase()}</span>
      </div>

      <div className="relative z-[1] flex-1 min-h-0 overflow-y-auto px-3 pb-2 pt-2 [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]">
        <div className="cat-card-back-owner-row">
          <span className="cat-card-back-owner-icon" aria-hidden="true" />
          <span className="cat-card-back-owner-label">OWNER</span>
          <span className="cat-card-back-owner-handle">{owner ? `@${owner}` : 'Unknown'}</span>
        </div>

        <div className="cat-card-back-grid mt-2">
          {meta.map((item) => {
            const isRecord = item.k === 'Record';
            const isTier = item.k === 'Rarity';
            const isRoleMeta = item.k === 'Role' || item.k === 'Faction';
            return (
              <div key={item.k} className="cat-card-back-cell min-w-0">
                <p className="cat-card-back-cell-label">{item.k}</p>
                <p className={`cat-card-back-cell-value truncate ${isTier ? 'cat-card-back-cell-value--tier' : ''} ${isRecord ? 'cat-card-back-cell-value--record' : ''} ${isRoleMeta ? 'cat-card-back-cell-value--meta' : ''}`}>
                  {item.v}
                </p>
              </div>
            );
          })}
        </div>

        {ability ? (
          <div className="cat-card-back-ability mt-2 min-w-0">
            <p className="cat-card-back-ability-name">Ability: {ability}</p>
            {abilityDesc ? <p className="cat-card-back-ability-desc">{abilityDesc}</p> : null}
          </div>
        ) : null}

        <div className="cat-card-back-footer mt-2">
          <div className="min-w-0 flex-1">
            <div className="cat-card-back-footer-top">
              <span>Vote Heat</span>
              <span>{votes}</span>
            </div>
            <div className="cat-card-back-progress">
              <div
                className="cat-card-back-progress-fill"
                style={{ width: `${Math.max(4, Math.min(100, Math.round(sharePct)))}%` }}
              />
            </div>
            <div className="cat-card-back-footer-bottom">
              <span>{Math.max(0, Math.min(100, Math.round(sharePct)))} / 100</span>
              <span>{wins}-{losses}</span>
            </div>
          </div>
          {heat ? <span className="cat-card-back-heat">{heat}</span> : null}
        </div>
      </div>

      <div className="relative z-[1] px-3 pb-3 pt-1">
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="cat-card-back-back-btn"
            aria-label={`Close ${displayName} details`}
          >
            Back
          </button>
          <div className="text-[9px] uppercase tracking-[0.14em] text-white/35">{role}</div>
        </div>

        <div data-cat-back-actions={cat.id} className="grid grid-cols-2 gap-1.5 items-stretch">
          <Link href={`/cat/${cat.id}`} className="cat-card-back-action cat-card-back-action--primary h-10 w-full whitespace-nowrap touch-manipulation inline-flex items-center justify-center">
            Open Cat Profile
          </Link>
          <Link href={`/c/${cat.id}/share`} className="cat-card-back-action cat-card-back-action--secondary h-10 w-full whitespace-nowrap touch-manipulation inline-flex items-center justify-center">
            Share Card
          </Link>
        </div>
      </div>
    </div>
  );
}
