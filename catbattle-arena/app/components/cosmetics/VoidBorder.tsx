'use client';

import type { CSSProperties, ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useMousePosition } from './useMousePosition';

type VoidBorderProps = {
  children: ReactNode;
  className?: string;
  radiusClassName?: string;
  thickness?: number;
};

const COSMIC_GRADIENT =
  'conic-gradient(from 24deg, #020617, #1e1b4b, #4c1d95, #020617)';
const GRAIN_TEXTURE =
  'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'120\' height=\'120\' viewBox=\'0 0 120 120\'%3E%3Cfilter id=\'n\' x=\'0\' y=\'0\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.95\' numOctaves=\'2\' stitchTiles=\'stitch\' /%3E%3C/filter%3E%3Crect width=\'120\' height=\'120\' filter=\'url(%23n)\' /%3E%3C/svg%3E")';

function ringMaskStyle(thickness: number): CSSProperties {
  return {
    padding: `${thickness}px`,
    WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
    WebkitMaskComposite: 'xor',
    maskComposite: 'exclude',
  } as CSSProperties;
}

export default function VoidBorder({
  children,
  className = '',
  radiusClassName = 'rounded-2xl',
  thickness = 10,
}: VoidBorderProps) {
  const reduceMotion = useReducedMotion();
  const { ref, mouse, handlers } = useMousePosition<HTMLDivElement>();
  const frameThickness = Math.max(1, thickness);
  const ringMask = ringMaskStyle(frameThickness);
  const rotateX = reduceMotion ? 0 : -mouse.y * 5;
  const rotateY = reduceMotion ? 0 : mouse.x * 5;
  const rayX = mouse.x * 52;

  return (
    <motion.div
      ref={ref}
      className={`relative isolate overflow-hidden bg-slate-950 p-[2px] ${radiusClassName} ${className}`}
      style={{
        transformStyle: 'preserve-3d',
        backfaceVisibility: 'hidden',
        willChange: 'transform',
      }}
      animate={
        reduceMotion ? { rotateX: 0, rotateY: 0, scale: 1 } : { rotateX, rotateY, scale: mouse.active ? 1.01 : 1 }
      }
      transition={{
        type: 'spring',
        stiffness: 180,
        damping: 18,
        mass: 0.65,
      }}
      {...handlers}
    >
      <motion.div
        aria-hidden
        className={`pointer-events-none absolute -inset-3 ${radiusClassName}`}
        style={{
          backgroundImage: COSMIC_GRADIENT,
          filter: 'blur(25px)',
          opacity: 0.42,
          backgroundSize: '180% 180%',
          willChange: 'transform, opacity',
        }}
        animate={reduceMotion ? { opacity: 0.3 } : { backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'], opacity: mouse.active ? 0.54 : 0.42 }}
        transition={reduceMotion ? undefined : { duration: 12, ease: 'linear', repeat: Infinity }}
      />

      <motion.div
        aria-hidden
        className={`pointer-events-none absolute inset-0 ${radiusClassName}`}
        style={{
          ...ringMask,
          backgroundColor: '#020617',
          willChange: 'transform, opacity, filter',
        }}
      >
        <motion.div
          className={`absolute -inset-8 ${radiusClassName}`}
          style={{
            backgroundImage: COSMIC_GRADIENT,
            backgroundSize: '180% 180%',
            filter: 'blur(15px)',
            mixBlendMode: 'screen',
            willChange: 'transform',
          }}
          animate={
            reduceMotion
              ? { opacity: [0.16, 0.24, 0.16] }
              : {
                  rotate: [0, 360],
                  opacity: [0.2, 0.34, 0.2],
                  scale: [1, 1.02, 1],
                  filter: ['blur(15px) brightness(0.98)', 'blur(15px) brightness(1.03)', 'blur(15px) brightness(0.98)'],
                }
          }
          transition={{
            rotate: { duration: 12, ease: 'linear', repeat: Infinity },
            opacity: { duration: 10, ease: 'easeInOut', repeat: Infinity },
            scale: { duration: 10, ease: 'easeInOut', repeat: Infinity },
            filter: { duration: 10, ease: 'easeInOut', repeat: Infinity },
          }}
        />

        <motion.div
          className="absolute -top-1/2 h-[220%] w-[26%]"
          style={{
            left: '36%',
            borderRadius: '999px',
            background:
              'linear-gradient(45deg, rgba(125,211,252,0), rgba(125,211,252,0.1), rgba(125,211,252,0))',
            filter: 'blur(34px)',
            opacity: 0.1,
            mixBlendMode: 'screen',
            transform: 'rotate(45deg)',
            willChange: 'transform, opacity',
          }}
          animate={reduceMotion ? { x: 0, opacity: 0.08 } : { x: rayX, opacity: mouse.active ? 0.14 : 0.1 }}
          transition={{ type: 'spring', stiffness: 120, damping: 16, mass: 0.9 }}
        />

        <motion.div
          className={`absolute inset-0 ${radiusClassName}`}
          style={{
            backgroundImage: GRAIN_TEXTURE,
            backgroundSize: '140px 140px',
            mixBlendMode: 'screen',
            willChange: 'opacity',
          }}
          animate={reduceMotion ? { opacity: 0.05 } : { opacity: [0.03, 0.05, 0.04, 0.05, 0.03] }}
          transition={{ duration: 6, ease: 'easeInOut', repeat: Infinity }}
        />

        <div
          className={`absolute inset-0 ${radiusClassName}`}
          style={{ boxShadow: 'inset 0 0 10px rgba(139, 92, 246, 0.3)' }}
        />
      </motion.div>

      <div
        className={`relative z-10 border border-white/10 bg-slate-950 ${radiusClassName}`}
        style={{
          margin: frameThickness,
          transform: 'translateZ(8px)',
          backfaceVisibility: 'hidden',
        }}
      >
        {children}
      </div>
    </motion.div>
  );
}
