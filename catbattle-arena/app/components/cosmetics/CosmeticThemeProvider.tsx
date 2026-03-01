'use client';

import type { ReactNode } from 'react';
import { resolveCosmeticEffect } from '../../_lib/cosmetics/effectsRegistry';

export default function CosmeticThemeProvider({
  colorSlug,
  className = '',
  children,
}: {
  colorSlug?: string | null;
  className?: string;
  children: ReactNode;
}) {
  const effect = resolveCosmeticEffect({ slug: colorSlug || undefined, category: 'cat_color' });
  return <div className={`${effect.apply.className || 'cosm-theme-default'} ${className}`}>{children}</div>;
}
