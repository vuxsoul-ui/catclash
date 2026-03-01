'use client';

import type { ReactNode } from 'react';
import { cosmeticBorderClassFromSlug } from '../../_lib/cosmetics/effectsRegistry';
import ElementalBorder, { type ElementalVariant } from './ElementalBorder';

function mapElementalVariant(borderSlug?: string | null): ElementalVariant | null {
  const slug = String(borderSlug || '').toLowerCase();
  if (slug === 'border-flame' || slug === 'border-ember-gold' || slug === 'border-inferno') return 'plasma';
  if (slug === 'border-lightning' || slug === 'border-thunder') return 'lightning';
  if (slug === 'border-holographic' || slug === 'holographic-border' || slug === 'border-holo' || slug === 'border-prism-shift') return 'prism';
  if (slug === 'border-void-drift' || slug === 'border-shadow' || slug === 'border-shadow-drift' || slug === 'border-shadow-veil' || slug === 'border-void') return 'void';
  if (slug === 'border-royal-violet') return 'royal';
  return null;
}

export default function CosmeticFrame({
  borderSlug,
  className = '',
  children,
}: {
  borderSlug?: string | null;
  className?: string;
  children: ReactNode;
}) {
  const variant = mapElementalVariant(borderSlug);
  if (variant) {
    return (
      <ElementalBorder variant={variant} className={`rounded-2xl ${className}`}>
        {children}
      </ElementalBorder>
    );
  }

  const effectClass = cosmeticBorderClassFromSlug(borderSlug);
  return (
    <div className={`relative rounded-2xl border ${effectClass} ${className}`}>
      <div className="relative z-10">{children}</div>
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl" />
    </div>
  );
}
