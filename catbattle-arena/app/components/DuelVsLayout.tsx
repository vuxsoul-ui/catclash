'use client';

import type { ReactNode } from 'react';

export default function DuelVsLayout({
  left,
  right,
}: {
  left: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className="duel-vs-layout">
      <div className="duel-vs-pane">{left}</div>
      <div className="duel-vs-divider" aria-hidden>
        <span className="duel-vs-slash" />
        <span className="duel-vs-text">VS</span>
      </div>
      <div className="duel-vs-pane">{right}</div>

      <style jsx>{`
        .duel-vs-layout {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          align-items: stretch;
        }

        .duel-vs-pane {
          min-width: 0;
        }

        .duel-vs-divider {
          position: relative;
          display: grid;
          place-items: center;
          min-height: 24px;
        }

        .duel-vs-slash {
          position: absolute;
          width: 92px;
          height: 2px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(59,130,246,0.1), rgba(56,189,248,0.9), rgba(251,146,60,0.1));
          filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.45));
          transform: rotate(-11deg);
          animation: duelSlashPulse 320ms ease-in-out infinite alternate;
        }

        .duel-vs-text {
          position: relative;
          z-index: 1;
          padding: 2px 8px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(0, 0, 0, 0.42);
          font-size: 10px;
          letter-spacing: 0.18em;
          font-weight: 800;
          color: rgba(255, 255, 255, 0.8);
        }

        @keyframes duelSlashPulse {
          from { opacity: 0.66; transform: rotate(-11deg) scaleX(0.97); }
          to { opacity: 1; transform: rotate(-11deg) scaleX(1.04); }
        }

        @media (min-width: 900px) {
          .duel-vs-layout {
            grid-template-columns: 1fr auto 1fr;
            gap: 12px;
            align-items: center;
          }
          .duel-vs-divider {
            min-height: 100%;
            width: 56px;
          }
          .duel-vs-slash {
            width: 60px;
            transform: rotate(-65deg);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .duel-vs-slash {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

