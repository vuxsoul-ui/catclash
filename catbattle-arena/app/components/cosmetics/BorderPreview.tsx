'use client';

import ElementalBorder, { type ElementalVariant } from './ElementalBorder';

export default function BorderPreview({
  fxClass,
  compact = false,
}: {
  fxClass?: string;
  compact?: boolean;
}) {
  const normalizedClass = String(fxClass || '').trim();
  const hasNamedBorderClass =
    normalizedClass.startsWith('fx-border-') ||
    normalizedClass.startsWith('cosm-border-');

  function mapVariant(input?: string): ElementalVariant | null {
    const normalized = String(input || '').toLowerCase();
    if (normalized.includes('flame')) return 'plasma';
    if (normalized.includes('lightning')) return 'lightning';
    if (normalized.includes('holographic') || normalized.includes('prism')) return 'prism';
    if (normalized.includes('void') || normalized.includes('shadow')) return 'void';
    if (normalized.includes('royal-violet') || normalized.includes('violet') || normalized.includes('royal')) return 'royal';
    return null;
  }

  const variant = hasNamedBorderClass ? null : mapVariant(fxClass);
  function renderSurface(extraClassName = '') {
    return (
      <div
        aria-hidden
        className={`h-full w-full rounded-[10px] overflow-visible border-preview-surface ${extraClassName}`}
      />
    );
  }

  return (
    <div className={`borderPreview border-preview-shell ${compact ? 'h-[72px] isCompact' : 'h-28'} rounded-[10px] p-0 overflow-hidden`}>
      {variant ? (
        <ElementalBorder variant={variant} className="h-full rounded-[11px]">
          {renderSurface()}
        </ElementalBorder>
      ) : (
        renderSurface(normalizedClass || 'cosm-border-default')
      )}
    </div>
  );
}
