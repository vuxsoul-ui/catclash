'use client';

import { KeyboardEvent, useMemo } from 'react';

export type TrainerTab = 'overview' | 'cats' | 'activity';

interface TrainerTabsProps {
  activeTab: TrainerTab;
  onTabChange: (tab: TrainerTab) => void;
}

const TABS: Array<{ key: TrainerTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'cats', label: 'My Cats' },
  { key: 'activity', label: 'Activity' },
];

export default function TrainerTabs({ activeTab, onTabChange }: TrainerTabsProps) {
  const activeIndex = useMemo(() => Math.max(0, TABS.findIndex((tab) => tab.key === activeTab)), [activeTab]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Enter') return;
    if (e.key === 'Enter') {
      onTabChange(TABS[activeIndex].key);
      return;
    }
    e.preventDefault();
    const delta = e.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (activeIndex + delta + TABS.length) % TABS.length;
    onTabChange(TABS[nextIndex].key);
  }

  return (
    <div role="tablist" aria-label="Trainer sections" onKeyDown={onKeyDown} className="relative mb-6 grid grid-cols-3 border-b border-white/10">
      <div
        className="pointer-events-none absolute bottom-0 h-1.5 w-1/3 rounded-full bg-gradient-to-r from-purple-400 to-pink-500 transition-transform duration-300"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />
      {TABS.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={`relative z-10 inline-flex h-11 items-center justify-center px-1 text-sm font-semibold transition-all duration-200 sm:h-12 sm:text-base ${isActive ? 'text-white drop-shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
