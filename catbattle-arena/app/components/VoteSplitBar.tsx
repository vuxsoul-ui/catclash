"use client";

import { useEffect, useState } from 'react';

type Rarity = string | null | undefined;

function rarityKey(rarity: Rarity): string {
  return String(rarity || 'common').trim().toLowerCase();
}

function getRarityTone(rarity: Rarity, side: 'a' | 'b', sameRarity: boolean): { fill: string; glow: string } {
  const key = String(rarity || 'common').trim().toLowerCase();
  const map: Record<string, { fill: string; glow: string }> = {
    common: { fill: 'linear-gradient(90deg, rgba(146,158,176,0.86), rgba(110,123,141,0.82))', glow: 'rgba(148,163,184,0.16)' },
    rare: { fill: 'linear-gradient(90deg, rgba(93,157,255,0.88), rgba(124,176,245,0.84))', glow: 'rgba(96,165,250,0.2)' },
    epic: { fill: 'linear-gradient(90deg, rgba(154,111,246,0.88), rgba(180,145,247,0.84))', glow: 'rgba(167,139,250,0.2)' },
    legendary: { fill: 'linear-gradient(90deg, rgba(240,189,86,0.88), rgba(231,158,74,0.84))', glow: 'rgba(245,158,11,0.2)' },
    mythic: { fill: 'linear-gradient(90deg, rgba(230,100,136,0.88), rgba(201,78,124,0.84))', glow: 'rgba(244,63,94,0.2)' },
    'god-tier': { fill: 'linear-gradient(90deg, rgba(124,206,236,0.88), rgba(156,139,236,0.84))', glow: 'rgba(125,211,252,0.22)' },
  };
  const tone = map[key] || map.common;
  if (side === 'b' && sameRarity) {
    const variantMap: Record<string, { fill: string; glow: string }> = {
      common: { fill: 'linear-gradient(270deg, rgba(125,211,252,0.9), rgba(167,139,250,0.84))', glow: 'rgba(125,211,252,0.26)' },
      rare: { fill: 'linear-gradient(270deg, rgba(99,179,255,0.9), rgba(99,102,241,0.84))', glow: 'rgba(129,140,248,0.26)' },
      epic: { fill: 'linear-gradient(270deg, rgba(192,132,252,0.9), rgba(129,140,248,0.84))', glow: 'rgba(192,132,252,0.27)' },
      legendary: { fill: 'linear-gradient(270deg, rgba(251,191,36,0.9), rgba(251,146,60,0.84))', glow: 'rgba(251,191,36,0.27)' },
      mythic: { fill: 'linear-gradient(270deg, rgba(236,72,153,0.9), rgba(251,113,133,0.84))', glow: 'rgba(244,114,182,0.27)' },
      'god-tier': { fill: 'linear-gradient(270deg, rgba(196,181,253,0.9), rgba(103,232,249,0.86))', glow: 'rgba(147,197,253,0.28)' },
    };
    return variantMap[key] || { fill: tone.fill.replace('90deg', '270deg'), glow: tone.glow };
  }
  return side === 'b'
    ? { fill: tone.fill.replace('90deg', '270deg'), glow: tone.glow }
    : tone;
}

export function VoteSplitBar({
  pctA,
  rarityA,
  rarityB,
  animTick = 0,
  justVoted = false,
  selectedSide = null,
  className = 'h-[10px]',
  durationMs = 600,
}: {
  pctA: number;
  rarityA?: Rarity;
  rarityB?: Rarity;
  animTick?: number;
  justVoted?: boolean;
  selectedSide?: 'a' | 'b' | null;
  className?: string;
  durationMs?: number;
}) {
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  const [renderPctA, setRenderPctA] = useState(() => clamp(pctA));
  const [pulseSide, setPulseSide] = useState<'a' | 'b' | null>(null);

  useEffect(() => {
    setRenderPctA(clamp(pctA));
  }, [pctA]);

  useEffect(() => {
    if (!animTick) return;
    if (!selectedSide) return;
    setPulseSide(selectedSide);
    const clearPulse = window.setTimeout(() => {
      setPulseSide(null);
    }, 180);
    return () => {
      window.clearTimeout(clearPulse);
      setPulseSide(null);
    };
  }, [animTick, selectedSide]);

  const renderPctB = clamp(100 - renderPctA);
  const sameRarity = rarityKey(rarityA) === rarityKey(rarityB);
  const toneA = getRarityTone(rarityA, 'a', sameRarity);
  const toneB = getRarityTone(rarityB, 'b', sameRarity);
  const winningSide: 'a' | 'b' | null = renderPctA === 50 ? null : renderPctA > 50 ? 'a' : 'b';

  return (
    <div
      className={`relative overflow-hidden rounded-full border border-white/14 bg-[#0a1220]/90 ${className}`}
      style={{
        height: justVoted ? '14px' : '10px',
        transition: 'height 180ms ease-out, box-shadow 180ms ease-out',
        boxShadow: justVoted
          ? 'inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.3), 0 8px 18px rgba(0,0,0,0.28)'
          : 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.24), 0 4px 12px rgba(0,0,0,0.24)',
      }}
    >
      <div
        className="absolute left-0 top-0 h-full"
        style={{
          width: `${renderPctA}%`,
          transition: `width ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1), opacity 140ms ease-out, transform 140ms ease-out`,
          background: toneA.fill,
          boxShadow: pulseSide === 'a' || (justVoted && winningSide === 'a') ? `0 0 12px ${toneA.glow}` : `0 0 4px ${toneA.glow}`,
          transform: pulseSide === 'a' ? 'scaleY(1.06)' : 'scaleY(1)',
          transformOrigin: 'center',
          opacity: pulseSide === 'b' || (justVoted && winningSide === 'b') ? 0.72 : 0.95,
          willChange: 'width, transform, opacity',
          zIndex: pulseSide === 'a' ? 2 : 1,
        }}
      />
      <div
        className="absolute right-0 top-0 h-full"
        style={{
          width: `${renderPctB}%`,
          transition: `width ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1), opacity 140ms ease-out, transform 140ms ease-out`,
          background: toneB.fill,
          boxShadow: pulseSide === 'b' || (justVoted && winningSide === 'b') ? `0 0 12px ${toneB.glow}` : `0 0 4px ${toneB.glow}`,
          transform: pulseSide === 'b' ? 'scaleY(1.06)' : 'scaleY(1)',
          transformOrigin: 'center',
          opacity: pulseSide === 'a' || (justVoted && winningSide === 'a') ? 0.72 : 0.95,
          willChange: 'width, transform, opacity',
          zIndex: pulseSide === 'b' ? 2 : 1,
        }}
      />
      <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/20" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-white/22" />
    </div>
  );
}
