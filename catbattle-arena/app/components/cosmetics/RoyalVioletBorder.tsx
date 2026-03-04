'use client';

import type { CSSProperties, ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useMousePosition } from './useMousePosition';

type RoyalVioletBorderProps = {
  children: ReactNode;
  className?: string;
  radiusClassName?: string;
  thickness?: number;
};

const ROYAL_GRADIENT =
  'conic-gradient(from 18deg, #2e1065, #7c3aed, #c084fc, #4c1d95, #2e1065)';

function ringMaskStyle(thickness: number): CSSProperties {
  return {
    padding: `${thickness}px`,
    WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
    WebkitMaskComposite: 'xor',
    maskComposite: 'exclude',
  } as CSSProperties;
}

export default function RoyalVioletBorder({
  children,
  className = '',
  radiusClassName = 'rounded-2xl',
  thickness = 2,
}: RoyalVioletBorderProps) {
  const reduceMotion = useReducedMotion();
  const { ref, mouse, handlers } = useMousePosition<HTMLDivElement>();
  const ringMask = ringMaskStyle(Math.max(1, thickness));
  const rotateX = reduceMotion ? 0 : -mouse.y * 5;
  const rotateY = reduceMotion ? 0 : mouse.x * 5;

  return (
    <motion.div
      ref={ref}
      className={`relative isolate overflow-hidden bg-slate-950 p-[2px] ${radiusClassName} ${className}`}
      style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden', willChange: 'transform' }}
      animate={reduceMotion ? { rotateX: 0, rotateY: 0, scale: 1 } : { rotateX, rotateY, scale: mouse.active ? 1.01 : 1 }}
      transition={{ type: 'spring', stiffness: 180, damping: 18, mass: 0.65 }}
      {...handlers}
    >
      <motion.div
        aria-hidden
        className={`pointer-events-none absolute -inset-3 ${radiusClassName} blur-[20px]`}
        style={{
          backgroundImage: ROYAL_GRADIENT,
          backgroundSize: '210% 210%',
          opacity: 0.4,
          mixBlendMode: 'screen',
          willChange: 'transform, opacity',
        }}
        animate={reduceMotion ? { opacity: 0.3 } : { backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'], opacity: [0.34, 0.46, 0.36] }}
        transition={reduceMotion ? undefined : { duration: 8, ease: 'linear', repeat: Infinity }}
      />

      <motion.div
        aria-hidden
        className={`pointer-events-none absolute inset-0 ${radiusClassName}`}
        style={{
          ...ringMask,
          backgroundImage: ROYAL_GRADIENT,
          backgroundSize: '200% 200%',
          mixBlendMode: 'soft-light',
          willChange: 'transform',
        }}
        animate={
          reduceMotion
            ? { opacity: [0.24, 0.36, 0.24] }
            : {
                rotate: [0, 360],
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                filter: ['saturate(1.05) hue-rotate(0deg)', 'saturate(1.12) hue-rotate(15deg)', 'saturate(1.05) hue-rotate(0deg)'],
              }
        }
        transition={{
          rotate: { duration: 8, ease: 'linear', repeat: Infinity },
          backgroundPosition: { duration: 8, ease: 'linear', repeat: Infinity },
          filter: { duration: 8, ease: 'easeInOut', repeat: Infinity },
          opacity: { duration: 4, ease: 'easeInOut', repeat: Infinity },
        }}
      >
        <motion.div
          className={`absolute inset-0 ${radiusClassName}`}
          style={{
            backgroundImage: ROYAL_GRADIENT,
            backgroundSize: '220% 220%',
            opacity: 0.44,
            mixBlendMode: 'color-dodge',
            filter: 'blur(1.5px)',
            willChange: 'transform, opacity',
          }}
          animate={reduceMotion ? { opacity: 0.28 } : { opacity: [0.24, 0.58, 0.28], backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
          transition={reduceMotion ? undefined : { duration: 8, ease: 'linear', repeat: Infinity }}
        />

        <motion.div
          className={`pointer-events-none absolute inset-0 ${radiusClassName}`}
          style={{
            background:
              'radial-gradient(120% 90% at 50% 46%, rgba(192,132,252,0.38), rgba(124,58,237,0.18) 52%, rgba(17,24,39,0) 74%), radial-gradient(115% 110% at 50% 50%, rgba(15,23,42,0), rgba(15,23,42,0.52) 86%)',
            mixBlendMode: 'screen',
            filter: 'blur(0.8px)',
            opacity: 0.5,
            willChange: 'transform, opacity',
          }}
          animate={
            reduceMotion
              ? { opacity: [0.42, 0.52, 0.42] }
              : { scale: [1, 1.02, 1], opacity: [0.42, 0.58, 0.44] }
          }
          transition={{ duration: 6.8, ease: 'easeInOut', repeat: Infinity }}
        />
      </motion.div>

      <div
        aria-hidden
        className={`pointer-events-none absolute inset-[2px] ${radiusClassName}`}
        style={{
          background: 'rgba(2, 6, 23, 0.2)',
          boxShadow: 'inset 0 0 4px rgba(255, 255, 255, 0.4), inset 0 0 14px rgba(124, 58, 237, 0.24)',
        }}
      />

      <div className={`relative z-10 ${radiusClassName}`} style={{ transform: 'translateZ(8px)', backfaceVisibility: 'hidden' }}>
        {children}
      </div>
    </motion.div>
  );
}
