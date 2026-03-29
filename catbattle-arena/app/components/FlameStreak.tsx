'use client';

import { Flame } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type FlameTier = 'none' | 'low' | 'growing' | 'peak';

function getTier(count: number): FlameTier {
  if (count <= 0) return 'none';
  if (count <= 3) return 'low';
  if (count <= 7) return 'growing';
  return 'peak';
}

function tierClasses(tier: FlameTier): string {
  if (tier === 'none') return 'border-white/14 bg-white/6 text-white/70';
  if (tier === 'low') return 'border-orange-300/30 bg-orange-500/10 text-orange-100';
  if (tier === 'growing') return 'border-amber-300/34 bg-amber-500/12 text-amber-100 animate-[subtleBreathe_1200ms_ease-in-out_infinite]';
  return 'border-cyan-300/38 bg-[linear-gradient(120deg,rgba(59,130,246,0.22),rgba(249,115,22,0.2))] text-cyan-50 animate-[subtleBreathe_920ms_ease-in-out_infinite]';
}

export default function FlameStreak({
  count,
  reactionTick = 0,
  className = '',
}: {
  count: number;
  reactionTick?: number;
  className?: string;
}) {
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const tier = getTier(safeCount);
  const prevCountRef = useRef(safeCount);
  const [justReacted, setJustReacted] = useState(false);
  const [downgraded, setDowngraded] = useState(false);

  useEffect(() => {
    if (!reactionTick) return;
    setJustReacted(true);
    const id = window.setTimeout(() => setJustReacted(false), 240);
    return () => window.clearTimeout(id);
  }, [reactionTick]);

  useEffect(() => {
    if (safeCount < prevCountRef.current) {
      setDowngraded(true);
      const id = window.setTimeout(() => setDowngraded(false), 900);
      prevCountRef.current = safeCount;
      return () => window.clearTimeout(id);
    }
    prevCountRef.current = safeCount;
  }, [safeCount]);

  return (
    <div className={`inline-flex flex-col items-end gap-1 ${className}`}>
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] uppercase transition-all duration-200 ${tierClasses(tier)} ${justReacted ? 'scale-[1.06]' : 'scale-100'}`}
      >
        <Flame className={`h-3.5 w-3.5 ${tier === 'none' ? 'opacity-70' : ''} ${justReacted ? 'animate-pulse' : ''}`} />
        <span>{safeCount}</span>
      </div>
      {downgraded ? (
        <span className="text-[10px] font-medium text-white/62 animate-[fadeIn_180ms_ease-out]">Flame fading...</span>
      ) : null}
    </div>
  );
}
