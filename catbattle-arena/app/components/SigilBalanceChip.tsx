'use client';

import SigilWidget from './SigilWidget';

type SigilBalanceChipProps = {
  balance: number | null;
  size?: 'sm' | 'md';
  onClick?: () => void;
  className?: string;
};

export default function SigilBalanceChip({
  balance,
  size = 'sm',
  onClick,
  className = '',
}: SigilBalanceChipProps) {
  const widgetSize = size === 'md' ? 'default' : 'compact';

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`sigil-widget-button ${className}`}>
        <SigilWidget balance={balance} size={widgetSize} />
      </button>
    );
  }

  return <SigilWidget balance={balance} size={widgetSize} className={className} />;
}
