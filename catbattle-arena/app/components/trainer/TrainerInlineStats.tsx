'use client';

interface TrainerInlineStatsProps {
  catsCount: number;
  votesCount: number;
  accuracy: number;
  streak: number;
}

export default function TrainerInlineStats({ catsCount, votesCount, accuracy, streak }: TrainerInlineStatsProps) {
  const items = [
    { icon: '🐱', label: 'Collection', value: catsCount.toLocaleString(), sublabel: 'cats', tone: 'text-white' },
    { icon: '⚔️', label: 'Influence', value: votesCount.toLocaleString(), sublabel: 'votes', tone: 'text-white' },
    { icon: '🎯', label: 'Accuracy', value: `${Math.max(0, Math.min(100, accuracy))}%`, sublabel: 'correct', tone: 'text-cyan-200' },
    { icon: '🔥', label: 'Commitment', value: streak.toLocaleString(), sublabel: 'days', tone: 'text-orange-200' },
  ];

  return (
    <div className="mb-4 grid grid-cols-4 gap-2 rounded-b-2xl border-x border-b border-white/[0.05] bg-[linear-gradient(180deg,rgba(11,14,28,0.92),rgba(9,12,24,0.97))] px-3 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:mb-5 sm:gap-3 sm:px-4 sm:py-4">
      {items.map((item) => (
        <div key={item.label} className="group flex min-w-0 flex-col items-center gap-0.5 rounded-lg px-1.5 py-1">
          <span className="text-lg sm:text-xl transition-transform duration-200 group-hover:scale-105" aria-hidden>{item.icon}</span>
          <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.09em] text-white/55">{item.label}</span>
          <span className={`text-[26px] leading-none sm:text-3xl font-black tabular-nums ${item.tone}`}>{item.value}</span>
          <span className="text-[10px] uppercase tracking-[0.09em] text-white/40">{item.sublabel}</span>
        </div>
      ))}
    </div>
  );
}
