'use client';

import * as React from 'react';
import { cn } from '../lib/cn';

type LoadingStateProps = {
  message?: string;
  icon?: string;
  fullPage?: boolean;
  compact?: boolean;
  className?: string;
  children?: React.ReactNode;
  phrases?: string[];
};

export function LoadingState({
  message = 'Loading...',
  icon = '✨',
  fullPage = false,
  compact = false,
  className,
  children,
  phrases = [
    'Finding worthy opponents...',
    'Balancing the matchup...',
    'Summoning contenders...',
    'Locking in the arena...',
  ],
}: LoadingStateProps) {
  const [phraseIndex, setPhraseIndex] = React.useState(0);

  React.useEffect(() => {
    if (phrases.length <= 1) return;
    const id = window.setInterval(() => {
      setPhraseIndex((current) => (current + 1) % phrases.length);
    }, 1250);
    return () => window.clearInterval(id);
  }, [phrases]);

  const activePhrase = phrases[phraseIndex] || 'Preparing the next clash...';

  const content = (
    <div
      className={cn(
        'mx-auto flex w-full max-w-md flex-col items-center justify-center text-center',
        compact ? 'gap-3' : 'gap-4'
      )}
    >
      <div
        className={cn(
          'relative grid place-items-center rounded-full border border-cyan-300/25 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.18),rgba(14,116,144,0.08)_58%,transparent_100%)] text-cyan-100 shadow-[0_14px_36px_rgba(6,182,212,0.12)]',
          compact ? 'h-14 w-14 text-2xl' : 'h-20 w-20 text-4xl'
        )}
      >
        <span className="pointer-events-none absolute inset-[10%] rounded-full border border-cyan-300/20 animate-[spin_5s_linear_infinite]" aria-hidden="true" />
        <span className="pointer-events-none absolute inset-[22%] rounded-full border border-white/10 animate-[spin_3.8s_linear_infinite_reverse]" aria-hidden="true" />
        <span className="pointer-events-none absolute h-2.5 w-2.5 -translate-y-[140%] rounded-full bg-cyan-300/80 shadow-[0_0_14px_rgba(34,211,238,0.45)] animate-[pulse_1.8s_ease-in-out_infinite]" aria-hidden="true" />
        <span className="relative animate-[pulse_1.9s_ease-in-out_infinite] [text-shadow:0_0_18px_rgba(34,211,238,0.16)]" aria-hidden="true">{icon}</span>
      </div>
      <div className="w-full space-y-2">
        <p className={cn('text-cyan-100', compact ? 'text-sm font-semibold' : 'text-base font-semibold')}>{message}</p>
        <p className={cn('min-h-[1.25rem] text-white/68 transition-opacity duration-300', compact ? 'text-xs' : 'text-sm')}>
          {activePhrase}
        </p>
        <div className={cn('mx-auto overflow-hidden rounded-full border border-white/8 bg-white/[0.05]', compact ? 'h-1 w-40' : 'h-1.5 w-52')}>
          <div className="h-full w-1/2 rounded-full bg-[linear-gradient(90deg,rgba(34,211,238,0.88),rgba(250,204,21,0.72),rgba(52,211,153,0.8))] animate-[loadingSweep_1.6s_ease-in-out_infinite]" />
        </div>
        <p className={cn('leading-relaxed text-white/46', compact ? 'text-[11px]' : 'text-sm')}>
          The arena is setting the stage.
        </p>
      </div>
      {children}
    </div>
  );

  if (fullPage) {
    return (
      <div className={cn('min-h-screen bg-[radial-gradient(circle_at_top,rgba(8,47,73,0.26),transparent_34%),radial-gradient(circle_at_bottom,rgba(20,83,45,0.16),transparent_30%),linear-gradient(180deg,#030712,#02040a)] px-4 text-white', className)}>
        <div className="flex min-h-screen items-center justify-center">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-2xl border border-cyan-300/15 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.1),transparent_34%),linear-gradient(180deg,rgba(10,22,34,0.82),rgba(4,10,18,0.95))] px-4 py-10 text-white shadow-[0_18px_48px_rgba(2,8,24,0.36)]', className)}>
      {content}
    </div>
  );
}
