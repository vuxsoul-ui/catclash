'use client';

import type { CSSProperties, ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

type FlameBorderProps = {
  children: ReactNode;
  className?: string;
  radiusClassName?: string;
  thickness?: number;
};

type PlasmaStreak = {
  id: number;
  left: string;
  width: number;
  height: number;
  gradient: string;
  duration: number;
  delay: number;
  driftX: number;
};

function ringMaskStyle(thickness: number): CSSProperties {
  return {
    padding: `${thickness}px`,
    WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
    WebkitMaskComposite: 'xor',
    maskComposite: 'exclude',
  } as CSSProperties;
} 

function buildPlasmaStreaks(): PlasmaStreak[] {
  return Array.from({ length: 12 }, (_, id) => {
    const duration = 1.1 + ((id * 29) % 17) / 10;
    const delay = ((id * 13) % 41) / 10;
    return {
      id,
      left: `${4 + ((id * 9) % 92)}%`,
      width: 12 + (id % 4) * 4,
      height: 54 + (id % 5) * 18,
      gradient: 'radial-gradient(ellipse at center, #ff0000 0%, #ff8c00 50%, transparent 100%)',
      duration,
      delay,
      driftX: ((id % 5) - 2) * 3,
    };
  });
}

export default function FlameBorder({
  children,
  className = '',
  radiusClassName = 'rounded-2xl',
  thickness = 2,
}: FlameBorderProps) {
  const reduceMotion = useReducedMotion();
  const ringMask = ringMaskStyle(Math.max(1, thickness));
  const streaks = buildPlasmaStreaks();

  return (
    <div className={`relative isolate grid overflow-hidden ${radiusClassName} ${className}`}>
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 ${radiusClassName}`}
        style={{
          ...ringMask,
          filter: 'contrast(180%) brightness(120%)',
          WebkitMaskImage: 'linear-gradient(to top, black 20%, transparent 95%)',
          maskImage: 'linear-gradient(to top, black 20%, transparent 95%)',
          willChange: 'transform, opacity',
        }}
      >
        <div className="absolute inset-0 overflow-hidden">
          {streaks.map((streak) => (
            <motion.span
              key={streak.id}
              className="absolute rounded-[999px]"
              style={{
                left: streak.left,
                bottom: '-26%',
                width: streak.width,
                height: streak.height,
                background: streak.gradient,
                mixBlendMode: 'screen',
                filter: 'blur(2px)',
                transform: 'translateX(-50%)',
                opacity: 0.85,
                willChange: 'transform, opacity',
              }}
              animate={
                reduceMotion
                  ? { y: 0, x: 0, opacity: 0.35 }
                  : { y: ['100%', '-20%'], x: [0, streak.driftX], opacity: [0.25, 0.95, 0] }
              }
              transition={
                reduceMotion
                  ? undefined
                  : {
                      duration: streak.duration,
                      delay: streak.delay,
                      repeat: Infinity,
                      ease: 'easeIn',
                    }
              }
            />
          ))}
        </div>
      </div>

      <div
        className={`relative z-10 bg-slate-950/80 backdrop-blur-xl border border-white/10 ${radiusClassName}`}
        style={{
          margin: Math.max(1, thickness),
        }}
      >
        {children}
      </div>
    </div>
  );
}
