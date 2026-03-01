'use client';

import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export default function CosmeticPreviewSheet({
  open,
  title,
  subtitle,
  status,
  children,
  actions,
  onClose,
}: {
  open: boolean;
  title: string;
  subtitle?: string | null;
  status?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[140]" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-black/55" onClick={onClose} aria-label="Close preview" />
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border border-white/15 border-b-0 bg-neutral-950/96 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-sm font-bold text-white">{title}</p>
            {subtitle ? <p className="text-xs text-white/60 mt-0.5">{subtitle}</p> : null}
          </div>
          <button className="h-8 w-8 rounded-full border border-white/15 bg-white/5 inline-flex items-center justify-center" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {status ? <div className="mb-3">{status}</div> : null}
        <div className="mb-3">{children}</div>
        {actions ? <div className="grid grid-cols-2 gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
