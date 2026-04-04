'use client';

import TrainerEmptyState from './TrainerEmptyState';

export interface TrainerCat {
  id: string;
  name: string;
  rarity: string;
  level: number;
  image_url: string | null;
  wins: number;
  losses: number;
  battles_fought: number;
  fan_count?: number;
}

interface TrainerMyCatsProps {
  cats: TrainerCat[];
  onSubmitCat: () => void;
  onSelectCat: (cat: TrainerCat) => void;
}

function rarityTone(rarity: string) {
  const map: Record<string, string> = {
    Common: 'text-zinc-200 border-zinc-300/30',
    Rare: 'text-blue-200 border-blue-300/30',
    Epic: 'text-purple-200 border-purple-300/30',
    Legendary: 'text-amber-200 border-amber-300/40',
    Mythic: 'text-rose-200 border-rose-300/40',
    'God-Tier': 'text-cyan-200 border-cyan-300/40',
  };
  return map[rarity] || map.Common;
}

export default function TrainerMyCats({ cats, onSubmitCat, onSelectCat }: TrainerMyCatsProps) {
  if (cats.length === 0) {
    return (
      <TrainerEmptyState
        icon="🐱"
        title="Your Arena is Empty"
        subtitle="Submit your first cat to enter the tournament."
        ctaLabel="Submit Your Cat"
        onCtaClick={onSubmitCat}
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
      {cats.map((cat) => {
        const matches = Math.max(0, Number(cat.wins || 0) + Number(cat.losses || 0));
        const winRate = matches > 0 ? Math.round((Number(cat.wins || 0) / matches) * 100) : 0;
        const progressVotes = Math.max(0, Number(cat.fan_count || cat.battles_fought || 0));
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelectCat(cat)}
            className="group relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.03] text-left shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition duration-150 hover:scale-[1.03] hover:border-white/20"
          >
            <img src={cat.image_url || '/cat-placeholder.svg'} alt={cat.name} className="h-40 w-full object-cover sm:h-44" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pb-2.5 pt-7">
              <div className="mb-1 flex items-center justify-between gap-1 text-[10px]">
                <span className={`rounded-full border bg-black/50 px-2 py-0.5 uppercase tracking-[0.16em] ${rarityTone(cat.rarity)}`}>{cat.rarity}</span>
                <span className="rounded-full border border-white/20 bg-black/55 px-2 py-0.5 text-white/85">Lv {cat.level}</span>
              </div>
              <p className="block min-w-0 truncate text-lg font-black text-white drop-shadow-md leading-tight">{cat.name}</p>
              <div className="mt-1 flex items-center justify-between text-[11px] text-white/70">
                <span>{progressVotes} votes</span>
                <span>{winRate}% win</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
