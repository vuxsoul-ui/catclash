'use client';

import type { ReactNode } from 'react';

type RoyalVioletBorderProps = {
  children: ReactNode;
  className?: string;
  radiusClassName?: string;
  thickness?: number;
};

export default function RoyalVioletBorder({
  children,
  className = '',
  radiusClassName = 'rounded-2xl',
  thickness = 2,
}: RoyalVioletBorderProps) {
  const frameThickness = Math.max(1, thickness);

  return (
    <div
      className={`relative isolate overflow-hidden border ${radiusClassName} ${className}`}
      style={{
        padding: `${frameThickness}px`,
        borderColor: 'rgba(140,80,255,0.35)',
        backgroundColor: '#0d0618',
        boxShadow:
          'inset 0 0 30px rgba(120,50,220,0.4), inset 0 0 8px rgba(160,80,255,0.25), 0 0 20px rgba(100,40,200,0.3), 0 0 40px rgba(80,20,160,0.15)',
      }}
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 ${radiusClassName} rv-royal-breath`}
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, rgba(110,50,200,0.55) 0%, rgba(110,50,200,0) 35%), radial-gradient(ellipse at 50% 50%, rgba(78,28,140,0.5) 0%, rgba(42,14,78,0.82) 66%, rgba(13,6,24,1) 100%), radial-gradient(ellipse at 30% 40%, rgba(150,80,255,0.2) 0%, rgba(150,80,255,0) 44%), radial-gradient(ellipse at 70% 60%, rgba(150,80,255,0.2) 0%, rgba(150,80,255,0) 44%), radial-gradient(ellipse at 50% 50%, rgba(13,6,24,0.82) 68%, rgba(13,6,24,1) 100%)',
        }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute h-[4px] w-[4px] rounded-full rv-royal-particle-1"
        style={{ left: '20%', top: '34%', background: 'rgba(170,110,255,0.62)', filter: 'blur(3px)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute h-[5px] w-[5px] rounded-full rv-royal-particle-2"
        style={{ left: '34%', top: '58%', background: 'rgba(170,110,255,0.56)', filter: 'blur(2px)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute h-[3px] w-[3px] rounded-full rv-royal-particle-3"
        style={{ left: '48%', top: '42%', background: 'rgba(180,120,255,0.66)', filter: 'blur(2px)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute h-[4px] w-[4px] rounded-full rv-royal-particle-4"
        style={{ left: '62%', top: '62%', background: 'rgba(160,92,255,0.52)', filter: 'blur(3px)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute h-[5px] w-[5px] rounded-full rv-royal-particle-5"
        style={{ left: '74%', top: '36%', background: 'rgba(180,120,255,0.58)', filter: 'blur(4px)' }}
      />

      <div
        aria-hidden
        className={`pointer-events-none absolute inset-[1px] ${radiusClassName}`}
        style={{
          boxShadow: 'inset 0 0 10px rgba(150,80,255,0.2)',
          background: 'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.03), rgba(255,255,255,0) 60%)',
        }}
      />

      <div className={`relative z-10 border border-white/10 bg-slate-950/62 ${radiusClassName}`} style={{ margin: frameThickness }}>
        {children}
      </div>
    </div>
  );
}
