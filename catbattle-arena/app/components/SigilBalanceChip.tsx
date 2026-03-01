'use client';

import SigilIcon from './icons/SigilIcon';

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
  const isMd = size === 'md';
  const containerClass = `${isMd ? 'h-10 px-3.5' : 'h-8 px-2.5'} rounded-full border border-cyan-400/25 bg-cyan-500/10 text-cyan-100 inline-flex items-center gap-1.5 backdrop-blur`;
  const iconClass = isMd ? 'w-4 h-4' : 'w-3.5 h-3.5';
  const valueClass = isMd ? 'text-sm font-extrabold' : 'text-xs font-bold';
  const labelClass = isMd ? 'text-[10px]' : 'text-[9px]';
  const clickableClass = onClick ? 'cursor-pointer hover:bg-cyan-500/15 transition-colors' : '';

  const content = (
    <>
      <SigilIcon className={iconClass} glow />
      {balance == null ? (
        <span className={`${isMd ? 'w-12 h-3' : 'w-9 h-2.5'} rounded bg-white/20 animate-pulse`} />
      ) : (
        <span className={valueClass}>{balance.toLocaleString()}</span>
      )}
      <span className={`${labelClass} text-white/55`}>Sigils</span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${containerClass} ${clickableClass} ${className}`}>
        {content}
      </button>
    );
  }

  return <div className={`${containerClass} ${className}`}>{content}</div>;
}
