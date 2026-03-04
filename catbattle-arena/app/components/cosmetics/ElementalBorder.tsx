'use client';

import type { CSSProperties, ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useMousePosition } from './useMousePosition';
import VoidBorder from './VoidBorder';
import RoyalVioletBorder from './RoyalVioletBorder';

export type ElementalVariant = 'plasma' | 'lightning' | 'prism' | 'void' | 'royal';

type ElementalBorderProps = {
  variant: ElementalVariant;
  children: ReactNode;
  className?: string;
};

const PRISM_GRADIENT = 'linear-gradient(135deg, #ff0080, #7928ca, #0070f3, #00dfd8, #ff0080)';
const EMBER_PARTICLE_GRADIENT = 'radial-gradient(circle at 50% 50%, rgba(255, 214, 153, 0.72) 0%, rgba(255, 120, 32, 0.4) 44%, rgba(255, 120, 32, 0) 74%)';

export default function ElementalBorder({
  variant,
  children,
  className = '',
}: ElementalBorderProps) {
  if (variant === 'void') {
    return <VoidBorder className={className}>{children}</VoidBorder>;
  }
  if (variant === 'royal') {
    return <RoyalVioletBorder className={className}>{children}</RoyalVioletBorder>;
  }

  const reduceMotion = useReducedMotion();
  const { ref, mouse, handlers } = useMousePosition<HTMLDivElement>();
  const tiltX = reduceMotion ? 0 : -mouse.y * 10;
  const tiltY = reduceMotion ? 0 : mouse.x * 10;
  const rayShift = reduceMotion ? 0 : mouse.x * 34;

  const mouseVars = {
    '--mouse-x': `${50 + mouse.x * 50}%`,
    '--mouse-y': `${50 + mouse.y * 50}%`,
  } as CSSProperties;

  const plasmaLayers = Array.from({ length: 4 }, (_, idx) => ({
    id: idx,
    left: `${18 + idx * 20}%`,
    width: 44 + idx * 10,
    height: 44 + idx * 10,
    duration: 3.2 + idx * 0.75,
    delay: idx * 0.28,
  }));

  const bloomBackgroundByVariant: Record<ElementalVariant, string> = {
    plasma: 'radial-gradient(55% 55% at 50% 50%, rgba(255,90,0,0.42), rgba(255,140,0,0.18), rgba(0,0,0,0))',
    lightning: 'radial-gradient(55% 55% at 50% 50%, rgba(125,211,252,0.45), rgba(59,130,246,0.18), rgba(0,0,0,0))',
    prism: 'radial-gradient(56% 56% at 50% 50%, rgba(192,132,252,0.34), rgba(59,130,246,0.24), rgba(0,223,216,0.18), rgba(0,0,0,0))',
    void: 'radial-gradient(56% 56% at 50% 50%, rgba(76,29,149,0.4), rgba(30,41,59,0.24), rgba(0,0,0,0))',
    royal: 'radial-gradient(56% 56% at 50% 50%, rgba(124,58,237,0.44), rgba(192,132,252,0.24), rgba(0,0,0,0))',
  };

  function renderVariantLayer() {
    if (variant === 'plasma') {
      return (
        <>
          <motion.div
            layout
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              willChange: 'transform, filter, opacity',
              mixBlendMode: 'screen',
              filter: 'blur(10px) contrast(150%)',
            }}
            animate={reduceMotion ? { opacity: [0.24, 0.44, 0.24] } : { opacity: [0.3, 0.72, 0.32] }}
            transition={{ duration: reduceMotion ? 2 : 1.6, ease: 'easeInOut', repeat: Infinity }}
          >
            {plasmaLayers.map((layer) => (
              <motion.span
                key={layer.id}
                className="absolute rounded-[999px]"
                style={{
                  left: layer.left,
                  top: `${24 + layer.id * 14}%`,
                  width: layer.width,
                  height: layer.height,
                  background: EMBER_PARTICLE_GRADIENT,
                  transform: 'translateX(-50%)',
                  willChange: 'transform, opacity',
                  filter: 'blur(6px)',
                }}
                animate={
                  reduceMotion
                    ? { y: 0, opacity: 0.24 }
                    : { y: [0, -12, 4, -8, 0], x: [0, (layer.id - 1.5) * 4, 0], opacity: [0.16, 0.42, 0.2, 0.36, 0.16] }
                }
                transition={{
                  duration: reduceMotion ? 2 : layer.duration,
                  delay: reduceMotion ? 0 : layer.delay,
                  ease: 'easeInOut',
                  repeat: Infinity,
                }}
              />
            ))}
          </motion.div>
          <motion.div
            layout
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              willChange: 'transform, opacity',
              background:
                'radial-gradient(220px 160px at var(--mouse-x) var(--mouse-y), rgba(255,196,120,0.6), rgba(255,80,0,0.28) 52%, rgba(255,80,0,0) 74%)',
              mixBlendMode: 'screen',
            }}
            animate={reduceMotion ? { opacity: [0.18, 0.26, 0.18] } : { opacity: [0.2, 0.42, 0.22] }}
            transition={{ duration: reduceMotion ? 2 : 1.8, ease: 'easeInOut', repeat: Infinity }}
          />
        </>
      );
    }

    if (variant === 'lightning') {
      return (
        <motion.div
          layout
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            willChange: 'transform, opacity, filter',
            filter: 'drop-shadow(0 0 8px #7dd3fc)',
            background:
              'conic-gradient(from 12deg, rgba(125,211,252,0) 0%, rgba(224,242,254,0.95) 0.08%, rgba(125,211,252,0) 0.18%, rgba(191,219,254,0.94) 12%, rgba(125,211,252,0) 12.08%, rgba(224,242,254,0.95) 24%, rgba(125,211,252,0) 24.1%, rgba(186,230,253,0.9) 38%, rgba(125,211,252,0) 38.08%, rgba(224,242,254,0.95) 52%, rgba(125,211,252,0) 52.08%, rgba(191,219,254,0.92) 66%, rgba(125,211,252,0) 66.08%, rgba(224,242,254,0.95) 82%, rgba(125,211,252,0) 82.08%, rgba(224,242,254,0.95) 94%, rgba(125,211,252,0) 94.08%, rgba(125,211,252,0) 100%)',
            mixBlendMode: 'screen',
          }}
          animate={
            reduceMotion
              ? { opacity: [0.22, 0.36, 0.22] }
              : { rotate: [0, 8, -3, 14, 2, 19, 0], opacity: [0.08, 0.9, 0.14, 0.78, 0.1, 0.95, 0.12] }
          }
          transition={{
            duration: reduceMotion ? 2 : 1.45,
            ease: reduceMotion ? 'easeInOut' : 'linear',
            repeat: Infinity,
          }}
        />
      );
    }

    if (variant === 'prism') {
      return (
        <>
          <motion.div
            layout
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              willChange: 'transform, opacity',
              backgroundImage: PRISM_GRADIENT,
              backgroundSize: '220% 220%',
              mixBlendMode: 'screen',
            }}
            animate={
              reduceMotion
                ? { opacity: [0.25, 0.4, 0.25] }
                : { backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'], opacity: [0.28, 0.58, 0.3] }
            }
            transition={{ duration: reduceMotion ? 2 : 8, ease: 'linear', repeat: Infinity }}
          />
          <motion.div
            layout
            aria-hidden
            className="pointer-events-none absolute -top-1/2 h-[220%] w-[30%]"
            style={{
              willChange: 'transform, opacity',
              left: '35%',
              background:
                'linear-gradient(115deg, rgba(255,255,255,0) 16%, rgba(255,255,255,0.74) 44%, rgba(255,255,255,0) 70%)',
              mixBlendMode: 'overlay',
              filter: 'blur(18px)',
              transform: 'rotate(28deg)',
            }}
            animate={reduceMotion ? { x: 0, opacity: [0.1, 0.2, 0.1] } : { x: rayShift, opacity: mouse.active ? 0.36 : 0.22 }}
            transition={{
              duration: reduceMotion ? 2 : 0.42,
              ease: 'easeOut',
              repeat: reduceMotion ? Infinity : 0,
            }}
          />
          <motion.div
            layout
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              willChange: 'transform, opacity',
              background:
                'radial-gradient(240px 180px at var(--mouse-x) var(--mouse-y), rgba(255,255,255,0.24), rgba(255,255,255,0) 62%)',
              mixBlendMode: 'screen',
            }}
            animate={reduceMotion ? { opacity: [0.12, 0.18, 0.12] } : { opacity: mouse.active ? 0.26 : 0.16 }}
            transition={{ duration: reduceMotion ? 2 : 0.36, ease: 'easeOut', repeat: reduceMotion ? Infinity : 0 }}
          />
        </>
      );
    }

    return null;
  }

  return (
    <motion.div
      ref={ref}
      layout
      className={`relative rounded-xl ${className}`}
      style={{ ...mouseVars, willChange: 'transform', transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
      initial={false}
      animate={
        reduceMotion
          ? { rotateX: 0, rotateY: 0, scale: 1, opacity: [0.88, 1, 0.88] }
          : { rotateX: tiltX, rotateY: tiltY, scale: mouse.active ? 1.01 : 1, opacity: 1 }
      }
      transition={{
        duration: reduceMotion ? 2 : 0.45,
        ease: 'easeInOut',
        repeat: reduceMotion ? Infinity : 0,
        type: reduceMotion ? 'tween' : 'spring',
        stiffness: reduceMotion ? undefined : 160,
        damping: reduceMotion ? undefined : 18,
        mass: reduceMotion ? undefined : 0.8,
      }}
      {...handlers}
    >
      <motion.div
        layout
        aria-hidden
        className="pointer-events-none absolute -inset-[10px] -z-10 rounded-[18px] blur-[30px]"
        style={{
          background: bloomBackgroundByVariant[variant],
          willChange: 'transform, opacity, filter',
        }}
        animate={reduceMotion ? { opacity: [0.2, 0.34, 0.2] } : { opacity: mouse.active ? 0.6 : 0.42, scale: [0.98, 1.04, 0.99] }}
        transition={{
          duration: reduceMotion ? 2 : 2.4,
          ease: 'easeInOut',
          repeat: Infinity,
        }}
      />

      <div className="relative grid overflow-hidden rounded-xl">
        {renderVariantLayer()}

        <div
          aria-hidden
          className="pointer-events-none absolute inset-[2px] bg-slate-950"
          style={{ borderRadius: 'calc(0.75rem - 2px)' }}
        />

        <motion.div
          layout
          className="relative z-10 grid place-items-stretch"
          style={{ transform: 'translateZ(10px)', backfaceVisibility: 'hidden' }}
        >
          {children}
        </motion.div>
      </div>
    </motion.div>
  );
}
