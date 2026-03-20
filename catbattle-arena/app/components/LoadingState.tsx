'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/cn';

type LoadingStateProps = {
  message?: string;
  icon?: string;
  fullPage?: boolean;
  compact?: boolean;
  className?: string;
  children?: React.ReactNode;
};

export function LoadingState({
  message = 'Loading...',
  icon = '✨',
  fullPage = false,
  compact = false,
  className,
  children,
}: LoadingStateProps) {
  const content = (
    <div
      className={cn(
        'mx-auto flex w-full max-w-md flex-col items-center justify-center text-center',
        compact ? 'gap-3' : 'gap-4'
      )}
    >
      <div
        className={cn(
          'grid place-items-center rounded-full border border-cyan-300/25 bg-cyan-400/10 text-cyan-100 shadow-[0_14px_36px_rgba(6,182,212,0.12)]',
          compact ? 'h-14 w-14 text-2xl' : 'h-20 w-20 text-4xl'
        )}
      >
        <span className="animate-bounce" aria-hidden="true">{icon}</span>
      </div>
      <div className="space-y-1">
        <div className="inline-flex items-center gap-2 text-cyan-100">
          <Loader2 className={cn('animate-spin text-cyan-300', compact ? 'h-4 w-4' : 'h-5 w-5')} />
          <p className={cn(compact ? 'text-sm font-semibold' : 'text-base font-semibold')}>{message}</p>
        </div>
        <p className={cn('leading-relaxed text-white/50', compact ? 'text-xs' : 'text-sm')}>
          The arena is setting the stage.
        </p>
      </div>
      {children}
    </div>
  );

  if (fullPage) {
    return (
      <div className={cn('min-h-screen bg-black px-4 text-white', className)}>
        <div className="flex min-h-screen items-center justify-center">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-2xl border border-cyan-300/15 bg-[linear-gradient(180deg,rgba(10,22,34,0.82),rgba(4,10,18,0.95))] px-4 py-10 text-white shadow-[0_18px_48px_rgba(2,8,24,0.36)]', className)}>
      {content}
    </div>
  );
}
