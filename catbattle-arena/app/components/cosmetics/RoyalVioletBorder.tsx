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
  const rayX = mouse.x * 50;

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
          className="pointer-events-none absolute -top-1/2 h-[220%] w-[10%]"
          style={{
            left: '26%',
            borderRadius: '999px',
            background: 'linear-gradient(45deg, rgba(255,255,255,0), rgba(255,255,255,0.78), rgba(255,255,255,0))',
            opacity: 0.28,
            filter: 'blur(12px)',
            mixBlendMode: 'color-dodge',
            transform: 'rotate(38deg)',
            willChange: 'transform, opacity',
          }}
          animate={reduceMotion ? { x: 0, opacity: 0.16 } : { x: [rayX, rayX + 24, rayX], opacity: [0.14, 0.3, 0.16] }}
          transition={{ duration: 4.8, ease: 'easeInOut', repeat: Infinity }}
        />

        <motion.div
          className="pointer-events-none absolute -top-1/2 h-[220%] w-[9%]"
          style={{
            left: '56%',
            borderRadius: '999px',
            background: 'linear-gradient(45deg, rgba(255,255,255,0), rgba(255,255,255,0.65), rgba(255,255,255,0))',
            opacity: 0.2,
            filter: 'blur(12px)',
            mixBlendMode: 'color-dodge',
            transform: 'rotate(38deg)',
            willChange: 'transform, opacity',
          }}
          animate={reduceMotion ? { x: 0, opacity: 0.14 } : { x: [rayX - 10, rayX + 14, rayX - 10], opacity: [0.1, 0.24, 0.12] }}
          transition={{ duration: 5.9, ease: 'easeInOut', repeat: Infinity }}
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
