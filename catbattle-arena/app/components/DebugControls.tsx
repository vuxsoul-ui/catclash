'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

type Props = {
  onDebugChange: (enabled: boolean) => void;
  onRefresh: () => void;
  onReset: () => void;
};

const buttonBase =
  'h-9 rounded-full border px-3 text-[11px] font-semibold transition-colors';

export default function DebugControls({ onDebugChange, onRefresh, onReset }: Props) {
  const searchParams = useSearchParams();
  const debugMode = searchParams?.get('debug') === '1';

  useEffect(() => {
    onDebugChange(debugMode);
  }, [debugMode, onDebugChange]);

  if (!debugMode) return null;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onRefresh}
        className={`${buttonBase} rounded-full border-cyan-300/40 bg-cyan-500/10 text-cyan-100 hover:border-cyan-200/80`}
      >
        Refresh matches
      </button>
      <button
        type="button"
        onClick={onReset}
        className={`${buttonBase} rounded-full border-white/20 bg-white/10 text-white/90 hover:border-white/40`}
      >
        Reset votes
      </button>
    </div>
  );
}
