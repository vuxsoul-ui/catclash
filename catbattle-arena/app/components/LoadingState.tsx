'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
  message = 'Arena Warmup',
  icon = 'CC',
  fullPage = false,
  compact = false,
  className,
  children,
  phrases = ['WARMING...', 'ARMING...', 'ENTERING...'],
}: LoadingStateProps) {
  const words = React.useMemo(() => {
    if (!phrases?.length) return ['WARMING...', 'ARMING...', 'ENTERING...'];
    return phrases.slice(0, 3);
  }, [phrases]);
  const [phraseIndex, setPhraseIndex] = React.useState(0);

  React.useEffect(() => {
    if (words.length <= 1) return;
    const id = window.setInterval(() => {
      setPhraseIndex((current) => (current + 1) % words.length);
    }, 850);
    return () => window.clearInterval(id);
  }, [words]);

  const activeWord = words[phraseIndex] || 'WARMING...';

  const content = (
    <div
      className={cn(
        'mx-auto flex w-full max-w-md flex-col items-center justify-center text-center',
        compact ? 'gap-3' : 'gap-5'
      )}
    >
      <div className="arena-warmup-mesh pointer-events-none absolute inset-0" />
      <motion.div
        className={cn(
          'relative grid place-items-center rounded-full border border-violet-300/28 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.26),rgba(6,12,24,0.2)_62%,transparent_100%)] text-white shadow-[0_16px_34px_rgba(34,211,238,0.12)]',
          compact ? 'h-16 w-16' : 'h-20 w-20'
        )}
        animate={{ scale: [1, 1.04, 1], opacity: [0.94, 1, 0.94] }}
        transition={{ duration: 1.9, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="pointer-events-none absolute inset-[12%] rounded-full border border-cyan-300/18" aria-hidden="true" />
        <span className="pointer-events-none absolute inset-[24%] rounded-full border border-white/10" aria-hidden="true" />
        <span className="relative text-xl font-black tracking-[0.16em] [text-shadow:0_0_14px_rgba(34,211,238,0.24)]" aria-hidden="true">
          {String(icon || 'CC').slice(0, 2).toUpperCase()}
        </span>
      </motion.div>
      <div className="w-full space-y-2">
        <p className="sr-only">{message}</p>
        <div className={cn('min-h-[1.25rem] text-white/80', compact ? 'text-xs' : 'text-sm')}>
          <AnimatePresence mode="wait">
            <motion.span
              key={activeWord}
              initial={{ opacity: 0, y: 6, filter: 'blur(2px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -4, filter: 'blur(1.5px)' }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="inline-block font-bold tracking-[0.18em]"
            >
              {activeWord}
            </motion.span>
          </AnimatePresence>
        </div>
        <div className={cn('mx-auto arena-warmup-track', compact ? 'w-40' : 'w-56')}>
          <div className="arena-warmup-fill">
            <span className="arena-warmup-head" />
          </div>
        </div>
      </div>
      {children}
    </div>
  );

  if (fullPage) {
    return (
      <div className={cn('relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#030711,#050912)] px-4 text-white', className)}>
        <div className="flex min-h-screen items-center justify-center">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('relative overflow-hidden rounded-2xl border border-violet-300/16 bg-[linear-gradient(180deg,rgba(8,12,24,0.86),rgba(5,8,16,0.95))] px-4 py-10 text-white shadow-[0_18px_48px_rgba(2,8,24,0.36)]', className)}>
      {content}
    </div>
  );
}
