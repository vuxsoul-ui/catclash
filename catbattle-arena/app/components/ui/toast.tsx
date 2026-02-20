'use client';

import { cn } from '../../lib/cn';
import type { ReactNode } from 'react';

export function ToastHost({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('global-toast-host', className)} aria-live="polite" aria-atomic="true">{children}</div>;
}

export function Toast({ className, children }: { className?: string; children: ReactNode }) {
  return <div role="status" className={cn('global-toast-bubble', className)}>{children}</div>;
}
