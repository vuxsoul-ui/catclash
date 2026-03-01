'use client';

import type { CSSProperties, ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useMousePosition } from './useMousePosition';

type PrismShiftBorderProps = {
  children: ReactNode;
  className?: string;
  radiusClassName?: string;
  thickness?: number;
};

const PRISM_GRADIENT =
  'conic-gradient(from 18deg, #7dd3fc, #c084fc, #fb7185, #818cf8, #7dd3fc)';

function ringMaskStyle(thickness: number): CSSProperties {
  return {
    padding: `${thickness}px`,
    WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
    WebkitMaskComposite: 'xor',
    maskComposite: 'exclude',
  } as CSSProperties;
}

export default function PrismShiftBorder({
  children,
  className = '',
  radiusClassName = 'rounded-2xl',
  thickness = 2,
}: PrismShiftBorderProps) {
  const reduceMotion = useReducedMotion();
  const { ref, mouse, handlers } = useMousePosition<HTMLDivElement>();
  const ringMask = ringMaskStyle(Math.max(1, thickness));

  const rotateX = reduceMotion ? 0 : -mouse.y * 5;
  const rotateY = reduceMotion ? 0 : mouse.x * 5;
  const shiftX = 50 + mouse.x * 20;
  const shiftY = 50 + mouse.y * 16;
  const rayX = mouse.x * 52;

  return (
    <motion.div
      ref={ref}
      className={`relative isolate overflow-hidden border border-white/20 bg-slate-950 ${radiusClassName} ${className}`}
      style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden', willChange: 'transform' }}
      animate={reduceMotion ? { rotateX: 0, rotateY: 0, scale: 1 } : { rotateX, rotateY, scale: mouse.active ? 1.01 : 1 }}
      transition={{ type: 'spring', stiffness: 180, damping: 18, mass: 0.65 }}
      {...handlers}
    >
      <motion.div
        aria-hidden
        className={`pointer-events-none absolute -inset-3 ${radiusClassName}`}
        style={{
          backgroundImage: PRISM_GRADIENT,
          filter: 'blur(25px)',
          opacity: 0.5,
          backgroundSize: '200% 200%',
          willChange: 'transform, opacity',
        }}
        animate={reduceMotion ? { opacity: 0.35 } : { backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'], opacity: mouse.active ? 0.64 : 0.5 }}
        transition={reduceMotion ? undefined : { duration: 10, ease: 'linear', repeat: Infinity }}
      />

      <motion.div
        aria-hidden
        className={`pointer-events-none absolute inset-0 ${radiusClassName}`}
        style={{
          ...ringMask,
          backgroundImage: PRISM_GRADIENT,
          backgroundSize: '200% 200%',
          backgroundPosition: `${shiftX}% ${shiftY}%`,
          filter: 'saturate(200%)',
          willChange: 'transform, opacity',
        }}
        animate={reduceMotion ? { filter: 'saturate(150%) hue-rotate(0deg)' } : { backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'], filter: ['saturate(200%) hue-rotate(0deg)', 'saturate(220%) hue-rotate(180deg)', 'saturate(200%) hue-rotate(360deg)'] }}
        transition={reduceMotion ? undefined : { duration: 10, ease: 'linear', repeat: Infinity }}
      />

      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-1/2 h-[220%] w-[26%]"
        style={{
          left: '36%',
          borderRadius: '999px',
          background: 'linear-gradient(45deg, rgba(255,255,255,0), rgba(255,255,255,0.22), rgba(255,255,255,0))',
          filter: 'blur(40px)',
          opacity: 0.2,
          transform: 'rotate(45deg)',
          willChange: 'transform, opacity',
        }}
        animate={reduceMotion ? { x: 0, opacity: 0.14 } : { x: rayX, opacity: mouse.active ? 0.32 : 0.2 }}
        transition={{ type: 'spring', stiffness: 120, damping: 16, mass: 0.9 }}
      />

      <div
        aria-hidden
        className={`pointer-events-none absolute inset-[2px] ${radiusClassName}`}
        style={{
          background: 'rgba(2, 6, 23, 0.2)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)',
        }}
      />

      <div className={`relative z-10 ${radiusClassName}`} style={{ transform: 'translateZ(8px)', backfaceVisibility: 'hidden' }}>
        {children}
      </div>
    </motion.div>
  );
}
