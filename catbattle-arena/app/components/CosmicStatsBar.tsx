'use client';

import React, { useEffect, useState } from 'react';

type StatValue = number | string;

type Cell = {
  key: 'flame' | 'energy' | 'sigils' | 'predict';
  label: string;
  value: StatValue;
  detail: string;
  onClick: () => void;
  tagline?: string;
};

type Props = {
  cells: [Cell, Cell, Cell, Cell];
};

function MiniSigilGlyph() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="cosmic-stat-icon cosmic-stat-icon--sigil">
      <polygon
        points="16,2 17.8,13 28,8 19.6,15.2 28,22 17.8,19 16,30 14.2,19 4,22 12.4,15.2 4,8 14.2,13"
        fill="none"
        stroke="rgba(180,100,255,0.9)"
        strokeWidth="0.8"
      />
      <polygon
        points="16,4.6 17.2,12.2 25.2,8.8 19,14.3 25.2,19.6 17.2,17 16,24.6 14.8,17 6.8,19.6 13,14.3 6.8,8.8 14.8,12.2"
        fill="rgba(140,60,220,0.25)"
        stroke="rgba(210,150,255,0.7)"
        strokeWidth="0.6"
      />
      <polygon
        points="16,12 18,15.2 16,18.4 14,15.2"
        fill="rgba(200,140,255,0.6)"
        stroke="rgba(230,180,255,0.9)"
        strokeWidth="0.7"
      />
    </svg>
  );
}

function FlameGlyph() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="cosmic-stat-icon cosmic-stat-icon--flame">
      <path
        d="M17.3 3.8c.7 3-1.5 4.8-3 6.9-1.7 2.2-2.6 4.1-1.4 6.6 1-1 1.8-1.9 2.4-3.2 1.5 2 4 3.6 4.8 6.9 1 4-1.8 8.3-7 8.3-4.6 0-8-3.3-8-8 0-5.7 4.2-8.7 7.6-12.3 1.4-1.5 2.5-3.1 2.9-5.2 1.1.5 1.3 1 .7 0z"
        fill="rgba(255,140,30,0.7)"
        stroke="rgba(255,160,50,0.9)"
        strokeWidth="1"
      />
      <path
        d="M16.5 12.2c-.4 1.5-1.5 2.5-2.2 3.7-.8 1.2-1 2.4-.4 3.9.7-.6 1.1-1.1 1.5-1.8.9 1.1 2.5 2 3 4 .6 2.5-1 5.2-4 5.2-2.7 0-4.6-1.9-4.6-4.7 0-3.3 2.4-5.2 4.3-7.4.9-1 1.5-1.9 1.8-2.9.6.3.8.6.6 0z"
        fill="rgba(255,219,170,0.85)"
      />
    </svg>
  );
}

function EnergyGlyph() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="cosmic-stat-icon cosmic-stat-icon--energy">
      <path
        d="M18 2 7 18h7l-1 12 12-17h-8l1-11Z"
        fill="rgba(220,220,30,0.6)"
        stroke="rgba(240,240,50,0.9)"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PredictGlyph() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="cosmic-stat-icon cosmic-stat-icon--predict">
      <circle cx="16" cy="16" r="9" fill="none" stroke="rgba(30,190,210,0.8)" strokeWidth="1.2" />
      <circle cx="16" cy="16" r="5" fill="none" stroke="rgba(30,190,210,0.8)" strokeWidth="1.1" />
      <circle cx="16" cy="16" r="1.6" fill="rgba(80,230,240,0.9)" />
      <path d="M16 3.5v3.4M16 25.1v3.4M3.5 16h3.4M25.1 16h3.4" stroke="rgba(30,190,210,0.8)" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function iconFor(key: Cell['key']) {
  if (key === 'flame') return <FlameGlyph />;
  if (key === 'energy') return <EnergyGlyph />;
  if (key === 'sigils') return <MiniSigilGlyph />;
  return <PredictGlyph />;
}

export default function CosmicStatsBar({ cells }: Props) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const THRESHOLD = 40;
    let ticking = false;
    let lastToggle = 0;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const nextCollapsed = window.scrollY > THRESHOLD;
          const now = Date.now();
          setIsCollapsed((prev) => {
            if (prev === nextCollapsed) return prev;
            if (now - lastToggle <= 50) return prev;
            lastToggle = now;
            return nextCollapsed;
          });
          ticking = false;
        });
        ticking = true;
      }
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className={`info-bar cosmic-stats-shell ${isCollapsed ? 'collapsed' : ''}`}>
      {cells.map((cell, index) => (
        <React.Fragment key={cell.key}>
          <button
            type="button"
            onClick={cell.onClick}
            aria-label={cell.detail}
            className={`cosmic-stat-cell cosmic-stat-cell--${cell.key}`}
          >
            <span className={`cosmic-stat-icon-wrap cosmic-stat-icon-wrap--${cell.key}`}>
              {cell.key === 'sigils' && <span className="cosmic-stat-orbit" aria-hidden="true" />}
              {iconFor(cell.key)}
            </span>
            <span className="cosmic-stat-copy">
              <span className={`cosmic-stat-value cosmic-stat-value--${cell.key}`}>{Number(cell.value).toLocaleString()}</span>
              <span className={`cosmic-stat-label cosmic-stat-label--${cell.key}`}>{cell.label}</span>
              {cell.tagline ? <span className="cosmic-stat-tagline">{cell.tagline}</span> : null}
            </span>
          </button>
          {index < cells.length - 1 ? <span className="cosmic-stat-divider" aria-hidden="true" /> : null}
        </React.Fragment>
      ))}
    </div>
  );
}
