'use client';

import ElementalBorder, { type ElementalVariant } from './ElementalBorder';

export default function BorderPreview({
  fxClass,
  compact = false,
}: {
  fxClass?: string;
  compact?: boolean;
}) {
  function mapVariant(input?: string): ElementalVariant | null {
    const normalized = String(input || '').toLowerCase();
    if (normalized.includes('flame')) return 'plasma';
    if (normalized.includes('lightning')) return 'lightning';
    if (normalized.includes('holographic') || normalized.includes('prism')) return 'prism';
    if (normalized.includes('void') || normalized.includes('shadow')) return 'void';
    if (normalized.includes('royal-violet') || normalized.includes('violet') || normalized.includes('royal')) return 'royal';
    return null;
  }

  const variant = mapVariant(fxClass);
  function renderSurface(extraClassName = '') {
    return (
      <div
        aria-hidden
        className={`h-full w-full rounded-lg border border-white/10 bg-slate-950/50 ${extraClassName}`}
      />
    );
  }

  return (
    <div className={`borderPreview ${compact ? 'h-16 isCompact' : 'h-28'} rounded-xl border border-white/10 bg-black/35 p-2`}>
      {variant ? (
        <ElementalBorder variant={variant} className="h-full rounded-lg">
          {renderSurface()}
        </ElementalBorder>
      ) : (
        renderSurface(fxClass || 'cosm-border-default')
      )}
    </div>
  );
}
