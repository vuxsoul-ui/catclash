'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { AlertCircle, ArrowLeft, RefreshCw, Swords } from 'lucide-react';

type DataLoadErrorProps = {
  title: string;
  message: string;
  onRetry?: () => void;
  showRetryButton?: boolean;
  retryLabel?: string;
  icon?: ReactNode;
  backHref?: string;
  backLabel?: string;
  fullPage?: boolean;
};

export function DataLoadError({
  title,
  message,
  onRetry,
  showRetryButton = true,
  retryLabel = 'Try Again',
  icon,
  backHref = '/',
  backLabel = 'Back to Home',
  fullPage = true,
}: DataLoadErrorProps) {
  const shellClass = fullPage
    ? 'min-h-screen bg-black text-white flex items-center justify-center px-4'
    : 'rounded-3xl border border-amber-300/18 bg-[linear-gradient(180deg,rgba(251,191,36,0.08),rgba(255,255,255,0.03))] p-5 text-white';

  return (
    <div className={shellClass}>
      <div className="w-full max-w-md overflow-hidden rounded-[1.75rem] border border-white/10 bg-[radial-gradient(120%_120%_at_50%_0%,rgba(34,211,238,0.1),rgba(8,10,18,0.94)_52%,rgba(0,0,0,1)_100%)] p-6 text-center shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-500/10 text-amber-200">
          {icon || <AlertCircle className="h-8 w-8 opacity-85" />}
        </div>
        <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/58">
          <Swords className="h-3 w-3 text-cyan-300/80" />
          CatClash Status
        </div>
        <h2 className="mt-4 text-2xl font-black tracking-tight text-white">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-white/68">{message}</p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {showRetryButton && onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-400/12 px-4 text-sm font-semibold text-cyan-100 transition-colors hover:bg-cyan-400/18"
            >
              <RefreshCw className="h-4 w-4" />
              {retryLabel}
            </button>
          ) : null}
          <Link
            href={backHref}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-4 text-sm font-semibold text-white/86 transition-colors hover:bg-white/[0.07]"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
