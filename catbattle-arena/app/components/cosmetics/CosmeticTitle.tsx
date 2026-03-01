'use client';

import { resolveCosmeticEffect } from '../../_lib/cosmetics/effectsRegistry';

export default function CosmeticTitle({
  title,
  titleSlug,
  className = '',
}: {
  title: string;
  titleSlug?: string | null;
  className?: string;
}) {
  const effect = resolveCosmeticEffect({ slug: titleSlug || undefined, category: 'cat_title' });
  return <span className={`${effect.apply.className || ''} ${effect.textClassName || 'text-yellow-300'} ${className}`}>{title}</span>;
}
