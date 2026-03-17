'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { resolveCosmeticEffect } from '../../_lib/cosmetics/effectsRegistry';

type Particle = { id: string; x: number; y: number; size: number; dx: number; dy: number };
type VoteEffectTrigger = { key: string; clientX?: number; clientY?: number } | null;

const COMET_ARCS = [
  { angle: -75, dist: 65, headSz: 10, tailCount: 5 },
  { angle: -45, dist: 55, headSz: 8, tailCount: 4 },
  { angle: -105, dist: 50, headSz: 7, tailCount: 4 },
  { angle: 20, dist: 40, headSz: 6, tailCount: 3 },
  { angle: -160, dist: 38, headSz: 5, tailCount: 3 },
] as const;

const STARDUST_PALETTE = [
  { rgb: '218,168,255', sym: '★' },
  { rgb: '255,215,168', sym: '✦' },
  { rgb: '168,228,255', sym: '◆' },
  { rgb: '255,198,225', sym: '✧' },
  { rgb: '215,255,198', sym: '⬟' },
  { rgb: '255,255,200', sym: '✶' },
] as const;

function spawnCrownFlash(x: number, y: number, container: HTMLElement) {
  const flash = document.createElement('div');
  flash.className = 'crown-flash';
  flash.style.setProperty('--fx', `${(x / Math.max(container.clientWidth, 1)) * 100}%`);
  container.appendChild(flash);
  flash.addEventListener('animationend', () => flash.remove(), { once: true });

  [0, 0.12, 0.26].forEach((delay, i) => {
    const ring = document.createElement('div');
    ring.className = 'crown-ring';
    ring.style.left = `${x}px`;
    ring.style.top = `${y}px`;
    ring.style.setProperty('--rw', '20px');
    ring.style.setProperty('--bw', `${1.8 - i * 0.4}px`);
    ring.style.setProperty('--alpha', `${0.65 - i * 0.15}`);
    ring.style.setProperty('--scale', `${4.5 + i * 1.2}`);
    ring.style.setProperty('--dur', `${0.65 + i * 0.1}s`);
    ring.style.animationDelay = `${delay}s`;
    container.appendChild(ring);
    ring.addEventListener('animationend', () => ring.remove(), { once: true });
  });

  [
    { char: '♛', size: '1.3rem', ty: '-55px', dur: '.9s', delay: 0, ox: x, oy: y },
    { char: '✦', size: '.7rem', ty: '-45px', dur: '.8s', delay: .05, ox: x - 22, oy: y + 4 },
    { char: '✦', size: '.65rem', ty: '-40px', dur: '.75s', delay: .08, ox: x + 22, oy: y + 4 },
    { char: '◆', size: '.5rem', ty: '-35px', dur: '.7s', delay: .04, ox: x - 38, oy: y + 8 },
    { char: '◆', size: '.5rem', ty: '-32px', dur: '.68s', delay: .06, ox: x + 38, oy: y + 8 },
  ].forEach((s) => {
    const el = document.createElement('div');
    el.className = 'crown-sigil';
    el.textContent = s.char;
    el.style.left = `${s.ox}px`;
    el.style.top = `${s.oy}px`;
    el.style.setProperty('--fsz', s.size);
    el.style.setProperty('--ty', s.ty);
    el.style.setProperty('--dur', s.dur);
    el.style.animationDelay = `${s.delay}s`;
    container.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
  });

  const count = 20 + Math.floor(Math.random() * 6);
  for (let i = 0; i < count; i += 1) {
    const p = document.createElement('div');
    p.className = 'crown-mote';
    const angle = (Math.random() * 360) * Math.PI / 180;
    const dist = 30 + Math.random() * 65;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.setProperty('--sz', `${2 + Math.random() * 4.5}px`);
    p.style.setProperty('--dur', `${0.45 + Math.random() * 0.5}s`);
    p.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
    p.style.setProperty('--ty', `${Math.sin(angle) * dist - 18}px`);
    p.style.setProperty('--rot', `${Math.random() * 360}deg`);
    p.style.animationDelay = `${Math.random() * 0.06}s`;
    container.appendChild(p);
    p.addEventListener('animationend', () => p.remove(), { once: true });
  }
}

function spawnArcLight(x: number, y: number, container: HTMLElement) {
  const flash = document.createElement('div');
  flash.className = 'arc-flash';
  flash.style.setProperty('--fx', `${(x / Math.max(container.clientWidth, 1)) * 100}%`);
  container.appendChild(flash);
  flash.addEventListener('animationend', () => flash.remove(), { once: true });

  const core = document.createElement('div');
  core.className = 'arc-core';
  core.style.left = `${x}px`;
  core.style.top = `${y}px`;
  core.style.setProperty('--cw', `${10 + Math.random() * 6}px`);
  container.appendChild(core);
  core.addEventListener('animationend', () => core.remove(), { once: true });

  const boltCount = 4 + Math.floor(Math.random() * 3);
  const ns = 'http://www.w3.org/2000/svg';
  for (let i = 0; i < boltCount; i += 1) {
    const angle = (Math.random() * 360) * Math.PI / 180;
    const len = 35 + Math.random() * 55;
    const segs = 3 + Math.floor(Math.random() * 3);
    let pathD = 'M 0 0';
    let ex = 0;
    let ey = 0;
    for (let s = 0; s < segs; s += 1) {
      const prog = (s + 1) / segs;
      const jitter = (len / segs) * 0.45;
      ex = Math.cos(angle) * len * prog + (Math.random() - 0.5) * jitter * 2;
      ey = Math.sin(angle) * len * prog + (Math.random() - 0.5) * jitter * 2;
      pathD += ` L ${ex} ${ey}`;
    }
    const w = Math.abs(ex) * 2 + 30;
    const h = Math.abs(ey) * 2 + 30;
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `-15 -15 ${w} ${h}`);
    svg.style.cssText = `position:absolute;width:${w}px;height:${h}px;left:${x - w / 2}px;top:${y - h / 2}px;overflow:visible;pointer-events:none;z-index:199;`;
    const po = document.createElementNS(ns, 'path');
    po.setAttribute('d', pathD);
    po.setAttribute('stroke', 'rgba(140,235,255,.9)');
    po.setAttribute('stroke-width', `${1 + Math.random() * 1.2}`);
    po.setAttribute('fill', 'none');
    po.setAttribute('stroke-linecap', 'round');
    po.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(po);
    const pi = document.createElementNS(ns, 'path');
    pi.setAttribute('d', pathD);
    pi.setAttribute('stroke', 'rgba(220,250,255,.95)');
    pi.setAttribute('stroke-width', '.5');
    pi.setAttribute('fill', 'none');
    svg.appendChild(pi);
    svg.classList.add('arc-bolt');
    svg.style.setProperty('--dur', `${0.3 + Math.random() * 0.25}s`);
    svg.style.animationDelay = `${Math.random() * 0.04}s`;
    container.appendChild(svg);
    svg.addEventListener('animationend', () => svg.remove(), { once: true });
  }

  const moteCount = 16 + Math.floor(Math.random() * 6);
  for (let i = 0; i < moteCount; i += 1) {
    const p = document.createElement('div');
    p.className = 'arc-mote';
    const angle = (Math.random() * 360) * Math.PI / 180;
    const dist = 25 + Math.random() * 60;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.setProperty('--sz', `${1.5 + Math.random() * 3.5}px`);
    p.style.setProperty('--dur', `${0.3 + Math.random() * 0.38}s`);
    p.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
    p.style.setProperty('--ty', `${Math.sin(angle) * dist - 15}px`);
    p.style.animationDelay = `${Math.random() * 0.05}s`;
    container.appendChild(p);
    p.addEventListener('animationend', () => p.remove(), { once: true });
  }

  window.setTimeout(() => {
    const a2 = (Math.random() * 360) * Math.PI / 180;
    const l2 = 20 + Math.random() * 35;
    const s2 = document.createElementNS(ns, 'svg');
    let d2 = 'M 0 0';
    for (let s = 0; s < 3; s += 1) {
      const p2 = (s + 1) / 3;
      d2 += ` L ${Math.cos(a2) * l2 * p2 + (Math.random() - .5) * 12} ${Math.sin(a2) * l2 * p2 + (Math.random() - .5) * 12}`;
    }
    s2.setAttribute('viewBox', '-10 -10 80 80');
    s2.style.cssText = `position:absolute;width:80px;height:80px;left:${x - 40}px;top:${y - 40}px;overflow:visible;pointer-events:none;z-index:198;`;
    const pm = document.createElementNS(ns, 'path');
    pm.setAttribute('d', d2);
    pm.setAttribute('stroke', 'rgba(80,215,255,.7)');
    pm.setAttribute('stroke-width', '.8');
    pm.setAttribute('fill', 'none');
    s2.appendChild(pm);
    s2.classList.add('arc-bolt');
    s2.style.setProperty('--dur', '.35s');
    container.appendChild(s2);
    s2.addEventListener('animationend', () => s2.remove(), { once: true });
  }, 80);
}

function spawnCometTrail(x: number, y: number, container: HTMLElement) {
  const flash = document.createElement('div');
  flash.className = 'comet-flash';
  flash.style.setProperty('--fx', `${(x / Math.max(container.clientWidth, 1)) * 100}%`);
  container.appendChild(flash);
  flash.addEventListener('animationend', () => flash.remove(), { once: true });

  const ns = 'http://www.w3.org/2000/svg';

  COMET_ARCS.forEach(({ angle, dist, headSz, tailCount }, arcIndex) => {
    const radians = angle * Math.PI / 180;
    const tx = Math.cos(radians) * dist;
    const ty = Math.sin(radians) * dist;

    const svg = document.createElementNS(ns, 'svg');
    const width = Math.abs(tx) + headSz * 4 + 30;
    const height = Math.abs(ty) + headSz * 4 + 30;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.classList.add('comet-streak');
    svg.style.left = `${x - width / 2}px`;
    svg.style.top = `${y - height / 2}px`;
    svg.style.setProperty('--dur', `${0.42 + arcIndex * 0.04}s`);

    const defs = document.createElementNS(ns, 'defs');
    const gradient = document.createElementNS(ns, 'linearGradient');
    const gradientId = `comet-grad-${Date.now()}-${arcIndex}-${Math.floor(Math.random() * 9999)}`;
    gradient.setAttribute('id', gradientId);
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '100%');
    gradient.setAttribute('y2', '100%');
    const stopA = document.createElementNS(ns, 'stop');
    stopA.setAttribute('offset', '0%');
    stopA.setAttribute('stop-color', 'rgba(255,255,255,0.95)');
    const stopB = document.createElementNS(ns, 'stop');
    stopB.setAttribute('offset', '35%');
    stopB.setAttribute('stop-color', 'rgba(145,225,255,0.75)');
    const stopC = document.createElementNS(ns, 'stop');
    stopC.setAttribute('offset', '100%');
    stopC.setAttribute('stop-color', 'rgba(28,185,248,0)');
    gradient.append(stopA, stopB, stopC);
    defs.appendChild(gradient);
    svg.appendChild(defs);

    const originX = width / 2;
    const originY = height / 2;
    const tipX = originX + tx;
    const tipY = originY + ty;
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', `${originX}`);
    line.setAttribute('y1', `${originY}`);
    line.setAttribute('x2', `${tipX}`);
    line.setAttribute('y2', `${tipY}`);
    line.setAttribute('stroke', `url(#${gradientId})`);
    line.setAttribute('stroke-width', `${headSz * 0.35}`);
    line.setAttribute('stroke-linecap', 'round');
    svg.appendChild(line);
    container.appendChild(svg);
    svg.addEventListener('animationend', () => svg.remove(), { once: true });

    for (let i = tailCount; i >= 1; i -= 1) {
      const progress = i / (tailCount + 1);
      const tail = document.createElement('div');
      tail.className = 'comet-tail-seg';
      tail.style.left = `${x}px`;
      tail.style.top = `${y}px`;
      tail.style.setProperty('--sz', `${headSz * (0.35 + ((tailCount - i) * 0.1))}px`);
      tail.style.setProperty('--tx', `${tx * progress}px`);
      tail.style.setProperty('--ty', `${ty * progress}px`);
      tail.style.setProperty('--dur', `${0.38 + arcIndex * 0.04}s`);
      tail.style.opacity = `${0.95 - ((tailCount - i) * 0.15)}`;
      tail.style.animationDelay = `${(tailCount - i) * 0.025}s`;
      container.appendChild(tail);
      tail.addEventListener('animationend', () => tail.remove(), { once: true });
    }

    const head = document.createElement('div');
    head.className = 'comet-head';
    head.style.left = `${x}px`;
    head.style.top = `${y}px`;
    head.style.setProperty('--sz', `${headSz}px`);
    head.style.setProperty('--tx', `${tx}px`);
    head.style.setProperty('--ty', `${ty}px`);
    head.style.setProperty('--dur', `${0.44 + arcIndex * 0.04}s`);
    head.style.animationDelay = `${arcIndex * 0.015}s`;
    container.appendChild(head);
    head.addEventListener('animationend', () => head.remove(), { once: true });
  });

  const iceCount = 22;
  for (let i = 0; i < iceCount; i += 1) {
    const p = document.createElement('div');
    p.className = 'comet-ice';
    const angle = (Math.random() * 360) * Math.PI / 180;
    const dist = 18 + Math.random() * 46;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.setProperty('--sz', `${1 + Math.random() * 2.5}px`);
    p.style.setProperty('--dur', `${0.28 + Math.random() * 0.32}s`);
    p.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
    p.style.setProperty('--ty', `${Math.sin(angle) * dist - 8}px`);
    p.style.animationDelay = `${Math.random() * 0.03}s`;
    container.appendChild(p);
    p.addEventListener('animationend', () => p.remove(), { once: true });
  }
}

function spawnStardustPop(x: number, y: number, container: HTMLElement) {
  const flash = document.createElement('div');
  flash.className = 'stardust-flash';
  flash.style.setProperty('--fx', `${(x / Math.max(container.clientWidth, 1)) * 100}%`);
  container.appendChild(flash);
  flash.addEventListener('animationend', () => flash.remove(), { once: true });

  [0, 0.08].forEach((delay, index) => {
    const palette = STARDUST_PALETTE[(index + Math.floor(Math.random() * STARDUST_PALETTE.length)) % STARDUST_PALETTE.length];
    const ring = document.createElement('div');
    ring.className = 'stardust-ring';
    ring.style.left = `${x}px`;
    ring.style.top = `${y}px`;
    ring.style.setProperty('--ring-color', `rgba(${palette.rgb},0.8)`);
    ring.style.setProperty('--dur', `${0.55 + index * 0.08}s`);
    ring.style.animationDelay = `${delay}s`;
    ring.style.setProperty('--scale', `${3.8 + index * 1.2}`);
    container.appendChild(ring);
    ring.addEventListener('animationend', () => ring.remove(), { once: true });
  });

  const symbolCount = 8 + Math.floor(Math.random() * 5);
  for (let i = 0; i < symbolCount; i += 1) {
    const palette = STARDUST_PALETTE[Math.floor(Math.random() * STARDUST_PALETTE.length)];
    const angle = (Math.random() * 360) * Math.PI / 180;
    const dist = 26 + Math.random() * 42;
    const star = document.createElement('div');
    star.className = 'stardust-symbol';
    star.textContent = palette.sym;
    star.style.left = `${x}px`;
    star.style.top = `${y}px`;
    star.style.setProperty('--color', `rgba(${palette.rgb},0.88)`);
    star.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
    star.style.setProperty('--ty', `${Math.sin(angle) * dist - 10}px`);
    star.style.setProperty('--dur', `${0.55 + Math.random() * 0.28}s`);
    star.style.setProperty('--r1', `${(Math.random() * 80) - 40}deg`);
    star.style.setProperty('--r2', `${(Math.random() * 260) - 130}deg`);
    star.style.setProperty('--fsz', `${0.62 + Math.random() * 0.34}rem`);
    star.style.animationDelay = `${Math.random() * 0.05}s`;
    container.appendChild(star);
    star.addEventListener('animationend', () => star.remove(), { once: true });
  }

  const dustCount = 18 + Math.floor(Math.random() * 7);
  for (let i = 0; i < dustCount; i += 1) {
    const palette = STARDUST_PALETTE[Math.floor(Math.random() * STARDUST_PALETTE.length)];
    const angle = (Math.random() * 360) * Math.PI / 180;
    const dist = 20 + Math.random() * 48;
    const mote = document.createElement('div');
    mote.className = 'stardust-mote';
    mote.style.left = `${x}px`;
    mote.style.top = `${y}px`;
    mote.style.setProperty('--color', palette.rgb);
    mote.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
    mote.style.setProperty('--ty', `${Math.sin(angle) * dist - 8}px`);
    mote.style.setProperty('--sz', `${1.5 + Math.random() * 3}px`);
    mote.style.setProperty('--dur', `${0.34 + Math.random() * 0.26}s`);
    mote.style.animationDelay = `${Math.random() * 0.04}s`;
    container.appendChild(mote);
    mote.addEventListener('animationend', () => mote.remove(), { once: true });
  }
}

export default function VoteEffectLayer({
  effectSlug,
  trigger,
  onTriggered,
}: {
  effectSlug?: string | null;
  trigger: VoteEffectTrigger;
  onTriggered?: () => void;
}) {
  const effect = resolveCosmeticEffect({ slug: effectSlug || undefined, category: 'vote_effect' });
  const [particles, setParticles] = useState<Particle[]>([]);
  const [boltPulse, setBoltPulse] = useState(false);
  const [trailPulse, setTrailPulse] = useState(false);
  const [crestPulse, setCrestPulse] = useState(false);

  const isBurst = useMemo(
    () => ['vote_ember_burst', 'vote_crown', 'vote_aurora'].includes(effect.id),
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
    if (!trigger?.key) return;
    onTriggered?.();
    let trailTimer: number | null = null;
    let crestTimer: number | null = null;
    const container = document.querySelector(`[data-vote-effect-trigger="${trigger.key}"]`) as HTMLElement | null;
    if (container && ['vote_crown', 'vote_arc', 'vote_comet', 'vote_stardust'].includes(effect.id)) {
      const rect = container.getBoundingClientRect();
      const x = trigger.clientX != null ? trigger.clientX - rect.left : rect.width / 2;
      const y = trigger.clientY != null ? trigger.clientY - rect.top : rect.height / 2;
      if (effect.id === 'vote_crown') {
        spawnCrownFlash(x, y, container);
      } else if (effect.id === 'vote_comet') {
        spawnCometTrail(x, y, container);
      } else if (effect.id === 'vote_stardust') {
        spawnStardustPop(x, y, container);
      } else {
        spawnArcLight(x, y, container);
      }
      return;
    }
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
      id: `${trigger.key}-${i}`,
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
  }, [trigger, isBurst, isLightning, onTriggered, effect.id]);

  return (
    <div
      data-vote-effect-trigger={trigger?.key || ''}
      className={`pointer-events-none absolute inset-0 overflow-hidden rounded-xl ${effect.apply.className || ''}`}
    >
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
