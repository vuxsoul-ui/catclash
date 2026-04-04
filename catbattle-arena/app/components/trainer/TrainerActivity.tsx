'use client';

import { useMemo, useState } from 'react';
import TrainerEmptyState from './TrainerEmptyState';

export interface TrainerActivityItem {
  id: string;
  text: string;
  timestamp: string;
  icon: string;
}

interface TrainerActivityProps {
  items: TrainerActivityItem[];
}

export default function TrainerActivity({ items }: TrainerActivityProps) {
  const [visibleCount, setVisibleCount] = useState(10);
  const visibleItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);

  if (items.length === 0) {
    return <TrainerEmptyState icon="🌌" title="No activity yet" subtitle="Your history will appear here once you start voting!" />;
  }

  return (
    <div className="space-y-3">
      {visibleItems.map((item) => (
        <article key={item.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
          <p className="truncate text-sm text-white"><span aria-hidden className="mr-1">{item.icon}</span>{item.text}</p>
          <time className="mt-1 block text-xs text-white/50" dateTime={new Date(item.timestamp).toISOString()}>
            {new Date(item.timestamp).toLocaleString()}
          </time>
        </article>
      ))}
      {visibleCount < items.length ? (
        <button
          type="button"
          onClick={() => setVisibleCount((prev) => prev + 10)}
          className="h-10 rounded-xl border border-white/20 bg-white/[0.04] px-4 text-sm font-semibold text-white/85 hover:bg-white/[0.08]"
        >
          Load More
        </button>
      ) : null}
    </div>
  );
}
