import React from 'react';

type SigilWidgetSize = 'compact' | 'default' | 'large' | 'shop';

type SigilWidgetProps = {
  balance: number | null;
  size?: SigilWidgetSize;
  className?: string;
};

function SigilGlyph() {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className="sigil-glyph"
      focusable="false"
    >
      <polygon
        points="16,2 17.8,13 28,8 19.6,15.2 28,22 17.8,19 16,30 14.2,19 4,22 12.4,15.2 4,8 14.2,13"
        fill="none"
        stroke="rgba(180,100,255,0.9)"
        strokeWidth="0.8"
      />
      <polygon
        points="16,4.6 17.2,12.2 25.2,8.8 19,14.3 25.2,19.6 17.2,17 16,24.6 14.8,17 6.8,19.6 13,14.3 6.8,8.8 14.8,12.2"
        fill="rgba(140,60,220,0.25)"
        stroke="rgba(210,150,255,0.7)"
        strokeWidth="0.6"
      />
      <polygon
        points="16,12 18,15.2 16,18.4 14,15.2"
        fill="rgba(200,140,255,0.6)"
        stroke="rgba(230,180,255,0.9)"
        strokeWidth="0.7"
      />
      <g opacity="0.3" stroke="rgba(200,160,255,0.7)" strokeWidth="0.5">
        <line x1="16" y1="6" x2="16" y2="26" />
        <line x1="6" y1="16" x2="26" y2="16" />
      </g>
    </svg>
  );
}

export default function SigilWidget({
  balance,
  size = 'default',
  className = '',
}: SigilWidgetProps) {
  const sizeClass =
    size === 'compact'
      ? 'sigil-widget--compact'
      : size === 'large'
        ? 'sigil-widget--large'
        : size === 'shop'
          ? 'sigil-widget--shop'
        : 'sigil-widget--default';

  return (
    <div className={`sigil-widget ${sizeClass} ${className}`}>
      <div className="sigil-row">
        <div className="sigil-icon">
          <span className="sigil-orbit" aria-hidden="true" />
          <SigilGlyph />
        </div>
        <div className="sigil-balance">
          {balance == null ? (
            <span className="sigil-number sigil-number--loading" />
          ) : (
            <span className="sigil-number">{balance.toLocaleString()}</span>
          )}
        </div>
      </div>
      <div className="sigil-label">SIGILS</div>
      <div className="sigil-divider" aria-hidden="true" />
    </div>
  );
}
