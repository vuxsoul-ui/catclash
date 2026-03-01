import React from 'react';

export default function SigilIcon({
  className = 'w-4 h-4',
  glow = false,
}: {
  className?: string;
  glow?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`${className} ${glow ? 'sigil-aura' : ''}`}
    >
      <defs>
        <linearGradient id="sigil_ring" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22d3ee" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
        <linearGradient id="sigil_glyph" x1="8" y1="6" x2="16" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.96" />
          <stop offset="1" stopColor="#67e8f9" stopOpacity="0.96" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="8.75" stroke="url(#sigil_ring)" strokeOpacity="0.95" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="6.2" className="stroke-cyan-200/45" strokeWidth="0.9" />
      <path d="M10.2 5.9V8.1M13.8 15.9V18.1" className="stroke-cyan-100/90" strokeWidth="1.15" strokeLinecap="round" />
      <path
        d="M14.7 8.2C14.7 7.2 13.8 6.4 12.3 6.4C10.8 6.4 9.8 7.2 9.8 8.2C9.8 9.2 10.6 9.8 12.2 10.1C13.9 10.4 14.7 11.1 14.7 12.2C14.7 13.4 13.7 14.2 12.1 14.2C10.6 14.2 9.6 13.4 9.6 12.2"
        stroke="url(#sigil_glyph)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="0.7" className="fill-cyan-100/95" />
    </svg>
  );
}
