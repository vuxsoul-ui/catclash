'use client';

import type { ReactNode } from 'react';

export type CrateRevealStage = 'idle' | 'opening' | 'burst' | 'reveal' | 'settle';

export type CrateFx = {
  screenShakePx: number;
  rumbleScale: number;
  popScale: number;
  leakGlowPx: number;
  rayOpacity: number;
  sparkDurationMs: number;
  confettiDurationMs: number;
};

export default function CrateReveal({
  active,
  stage,
  skipReady,
  shakeScreen,
  fx,
  onSkip,
  children,
}: {
  active: boolean;
  stage: CrateRevealStage;
  skipReady: boolean;
  shakeScreen: boolean;
  fx: CrateFx;
  onSkip: () => void;
  children: ReactNode;
}) {
  if (!active) return null;
  return (
    <div
      className={`fixed inset-0 z-[120] bg-[rgba(5,4,12,0.92)] backdrop-blur-[18px] ${shakeScreen ? 'screen-shake' : ''}`}
      onClick={onSkip}
      style={{
        ['--fx-shake-x' as string]: `${fx.screenShakePx}px`,
        ['--fx-rumble-scale' as string]: String(fx.rumbleScale),
        ['--fx-pop-scale' as string]: String(fx.popScale),
        ['--fx-leak-glow' as string]: `${fx.leakGlowPx}px`,
        ['--fx-ray-opacity' as string]: String(fx.rayOpacity),
        ['--fx-spark-duration' as string]: `${fx.sparkDurationMs}ms`,
        ['--fx-confetti-duration' as string]: `${fx.confettiDurationMs}ms`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 55% 55% at 50% 50%, rgba(185,118,8,0.14) 0%, transparent 65%)',
        }}
      />
      {stage !== 'settle' && (
        <button
          onClick={(e) => { e.stopPropagation(); onSkip(); }}
          disabled={!skipReady}
          className="absolute top-5 right-4 rounded-full border border-white/20 bg-black/40 px-3 py-1 text-xs text-white/80 disabled:opacity-40"
        >
          Skip
        </button>
      )}
      {stage !== 'settle' && skipReady && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-[11px] text-white/60">
          Tap anywhere to speed up
        </div>
      )}
      <div className="absolute inset-0 px-4" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
