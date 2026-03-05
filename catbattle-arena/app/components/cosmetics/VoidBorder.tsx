'use client';

import type { ReactNode } from 'react';

type VoidBorderProps = {
  children: ReactNode;
  className?: string;
  radiusClassName?: string;
  thickness?: number;
};

export default function VoidBorder({
  children,
  className = '',
  radiusClassName = 'rounded-2xl',
  thickness = 2,
}: VoidBorderProps) {
  const frameThickness = Math.max(1, thickness);

  return (
    <div
      className={`relative isolate overflow-hidden border ${radiusClassName} ${className}`}
      style={{
        padding: `${frameThickness}px`,
        borderColor: 'rgba(100,60,200,0.3)',
        backgroundColor: '#050310',
        boxShadow:
          'inset 0 0 30px rgba(60,20,160,0.45), inset 0 0 10px rgba(90,40,200,0.25), 0 0 20px rgba(40,10,120,0.3), 0 0 50px rgba(20,5,80,0.15)',
      }}
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 ${radiusClassName} rv-void-drift`}
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, rgba(50,20,140,0.5) 0%, rgba(50,20,140,0) 40%), radial-gradient(ellipse at 50% 50%, rgba(20,8,42,0.62) 0%, rgba(12,6,26,0.9) 66%, rgba(5,3,16,1) 100%), radial-gradient(ellipse at 25% 35%, rgba(80,40,180,0.18) 0%, rgba(80,40,180,0) 46%), radial-gradient(ellipse at 75% 65%, rgba(80,40,180,0.18) 0%, rgba(80,40,180,0) 46%), radial-gradient(ellipse at 50% 50%, rgba(5,3,16,0.88) 70%, rgba(5,3,16,1) 100%)',
        }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute h-[4px] w-[4px] rounded-full rv-void-particle-1"
        style={{ left: '18%', top: '30%', background: 'rgba(74,48,138,0.44)', filter: 'blur(4px)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute h-[5px] w-[5px] rounded-full rv-void-particle-2"
        style={{ left: '33%', top: '61%', background: 'rgba(72,46,132,0.36)', filter: 'blur(5px)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute h-[3px] w-[3px] rounded-full rv-void-particle-3"
        style={{ left: '49%', top: '42%', background: 'rgba(82,54,150,0.5)', filter: 'blur(3px)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute h-[4px] w-[4px] rounded-full rv-void-particle-4"
        style={{ left: '64%', top: '66%', background: 'rgba(70,42,126,0.34)', filter: 'blur(4px)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute h-[5px] w-[5px] rounded-full rv-void-particle-5"
        style={{ left: '78%', top: '34%', background: 'rgba(78,50,146,0.4)', filter: 'blur(5px)' }}
      />

      <div
        aria-hidden
        className={`pointer-events-none absolute inset-[1px] ${radiusClassName}`}
        style={{
          boxShadow: 'inset 0 0 10px rgba(90,40,200,0.2)',
          background: 'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.02), rgba(255,255,255,0) 62%)',
        }}
      />

      <div className={`relative z-10 border border-white/10 bg-[#050310]/72 ${radiusClassName}`} style={{ margin: frameThickness }}>
        {children}
      </div>
    </div>
  );
}
