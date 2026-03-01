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
  const cue =
    fxClass?.includes('lightning') ? 'Electric' :
    fxClass?.includes('flame') ? 'Ember' :
    fxClass?.includes('void') || fxClass?.includes('shadow') ? 'Void' :
    fxClass?.includes('prism') ? 'Prism' :
    fxClass?.includes('violet') || fxClass?.includes('royal') ? 'Royal' :
    fxClass?.includes('galaxy') ? 'Galaxy' :
    'Border';
  function renderRail(extraClassName = '') {
    return (
      <div className={`borderFrame h-full rounded-lg ${extraClassName}`}>
        <span className="previewNameplate" aria-hidden>
          Preview Cat
        </span>
        <div className="avatarStub" />
        <span className="previewCue" aria-hidden>{cue}</span>
      </div>
    );
  }

  return (
    <div className={`borderPreview ${compact ? 'h-16 isCompact' : 'h-28'} rounded-xl border border-white/10 bg-black/35 p-2`}>
      {variant ? (
        <ElementalBorder variant={variant} className="h-full rounded-lg">
          {renderRail()}
        </ElementalBorder>
      ) : (
        renderRail(fxClass || 'cosm-border-default')
      )}
    </div>
  );
}
