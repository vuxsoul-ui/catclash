'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { resolveCosmeticEffect } from '../../_lib/cosmetics/effectsRegistry';

type Particle = { id: string; x: number; y: number; size: number; dx: number; dy: number };

export default function VoteEffectLayer({
  effectSlug,
  triggerKey,
  onTriggered,
}: {
  effectSlug?: string | null;
  triggerKey: string;
  onTriggered?: () => void;
}) {
  const effect = resolveCosmeticEffect({ slug: effectSlug || undefined, category: 'vote_effect' });
  const [particles, setParticles] = useState<Particle[]>([]);
  const [boltPulse, setBoltPulse] = useState(false);
  const [trailPulse, setTrailPulse] = useState(false);
  const [crestPulse, setCrestPulse] = useState(false);

  const isBurst = useMemo(
    () => ['vote_ember_burst', 'vote_comet', 'vote_stardust', 'vote_crown', 'vote_aurora'].includes(effect.id),
    [effect.id]
  );
  const isLightning = useMemo(() => effect.id === 'vote_lightning_strike' || effect.id === 'vote_arc', [effect.id]);
  const toneClass = useMemo(() => {
    if (effect.id === 'vote_comet') return 'cosm-vote-particle-comet';
    if (effect.id === 'vote_stardust') return 'cosm-vote-particle-stardust';
    if (effect.id === 'vote_crown') return 'cosm-vote-particle-crown';
    if (effect.id === 'vote_aurora') return 'cosm-vote-particle-aurora';
    return '';
  }, [effect.id]);

  useEffect(() => {
    if (!triggerKey) return;
    onTriggered?.();
    let trailTimer: number | null = null;
    let crestTimer: number | null = null;
    if (isLightning) {
      setBoltPulse(true);
      const boltTimer = window.setTimeout(() => setBoltPulse(false), 240);
      return () => window.clearTimeout(boltTimer);
    }
    if (!isBurst) return;
    const perfMode = typeof window !== 'undefined'
      && (window.matchMedia('(hover: none)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const baseCount = effect.id === 'vote_stardust' ? 22 : effect.id === 'vote_crown' ? 14 : 16;
    const count = perfMode ? Math.max(8, Math.floor(baseCount * 0.55)) : baseCount;
    if (effect.id === 'vote_comet') {
      setTrailPulse(true);
      trailTimer = window.setTimeout(() => setTrailPulse(false), 300);
    }
    if (effect.id === 'vote_crown' || effect.id === 'vote_aurora') {
      setCrestPulse(true);
      crestTimer = window.setTimeout(() => setCrestPulse(false), 320);
    }
    const next = Array.from({ length: count }).map((_, i) => ({
      id: `${triggerKey}-${i}`,
      x: 50,
      y: 50,
      size: 3 + Math.random() * 4,
      dx: -34 + Math.random() * 68,
      dy: -28 - Math.random() * 32,
    }));
    setParticles(next);
    const timer = window.setTimeout(() => setParticles([]), 520);
    return () => {
      window.clearTimeout(timer);
      if (trailTimer) window.clearTimeout(trailTimer);
      if (crestTimer) window.clearTimeout(crestTimer);
    };
  }, [triggerKey, isBurst, isLightning, onTriggered, effect.id]);

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden rounded-xl ${effect.apply.className || ''}`}>
      {trailPulse ? <span className="cosm-vote-comet-tail" /> : null}
      {crestPulse ? (
        <>
          <span className="cosm-vote-crest" />
          <span className="cosm-vote-ring cosm-vote-ring-aurora" />
        </>
      ) : null}
      {isLightning && boltPulse ? (
        <>
          <span className="cosm-vote-flash" />
          <span className="cosm-vote-bolt cosm-vote-bolt-main" />
          <span className="cosm-vote-bolt cosm-vote-bolt-branch-a" />
          <span className="cosm-vote-bolt cosm-vote-bolt-branch-b" />
          <span className="cosm-vote-ring" />
        </>
      ) : null}
      {isBurst && particles.map((p) => (
        <span
          key={p.id}
          className={`cosm-vote-particle ${toneClass}`}
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            ['--dx' as string]: `${p.dx}px`,
            ['--dy' as string]: `${p.dy}px`,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}
