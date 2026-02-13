'use client';

/**
 * TimeSince Component
 *
 * Displays elapsed time between a start and optional end time.
 * Updates in real-time when no end time is provided.
 */

import React, { memo, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/** Format milliseconds to human-readable duration */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;

  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;

  const totalMinutes = totalSeconds / 60;
  if (totalMinutes < 60) {
    const minutes = Math.floor(totalMinutes);
    const seconds = Math.round(totalSeconds % 60);
    return `${minutes}m${seconds}s`;
  }

  const totalHours = totalMinutes / 60;
  const hours = Math.floor(totalHours);
  const minutes = Math.floor(totalMinutes % 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${hours}h${minutes}m${seconds}s`;
}

/** Get smart update interval based on elapsed time */
function getSmartInterval(ms: number): number {
  if (ms < 1000) return 20; // Update every 20ms for ms display
  if (ms < 60_000) return 100; // Update every 100ms for < 1m
  if (ms < 3_600_000) return 1000; // Update every second for < 1h
  return 60_000; // Update every minute for >= 1h
}

export interface TimeSinceProps {
  /** Start time (Date, timestamp, or ISO string) */
  start: string | number | Date | undefined;
  /** Optional end time - if not provided, shows live elapsed time */
  end?: string | number | Date | undefined;
  /** Additional CSS classes */
  className?: string;
  /** Wrap the time in parentheses */
  parentheses?: boolean;
}

export const TimeSince = memo(function TimeSince({
  start,
  end,
  className,
  parentheses = false,
}: TimeSinceProps) {
  const [now, setNow] = useState(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Don't update if end is provided (static display)
    if (end) return;

    function update() {
      setNow(Date.now());
    }

    const startTime = start ? new Date(start).getTime() : 0;
    const endTime = end ? new Date(end).getTime() : now;
    const diff = Math.max(0, endTime - startTime);
    const interval = getSmartInterval(diff);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(update, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [start, end, now]);

  if (!start) return <span className={className}>-</span>;

  const startTime = new Date(start).getTime();
  const endTime = end ? new Date(end).getTime() : now;

  if (isNaN(startTime) || isNaN(endTime)) {
    return <span className={className}>?</span>;
  }

  const diff = Math.max(0, endTime - startTime);

  if (diff === 0) return <span className={className}></span>;

  const formatted = formatDuration(diff);

  return (
    <span className={cn('text-xs', className)}>
      {parentheses ? `(${formatted})` : formatted}
    </span>
  );
});
