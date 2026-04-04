'use client';

import { useEffect, useState } from 'react';

interface TrainerHeroProps {
  username: string;
  avatarUrl: string | null;
  rarity: string;
  streak: number;
  sigils: number;
  rank: number;
  canEditProfile?: boolean;
  onChangeAvatar?: () => void;
  onSubmitCat: () => void;
  onViewMyCats: () => void;
}

function rarityBorder(rarity: string) {
  const map: Record<string, string> = {
    Common: 'border-zinc-300/40',
    Rare: 'border-blue-300/60',
    Epic: 'border-purple-300/60',
    Legendary: 'border-amber-300/70',
    Mythic: 'border-rose-300/70',
    'God-Tier': 'border-cyan-300/80',
  };
  return map[rarity] || map.Common;
}

function useCountUp(target: number, durationMs = 500) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const safeTarget = Math.max(0, Number(target || 0));
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(safeTarget * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

export default function TrainerHero({
  username,
  avatarUrl,
  rarity,
  streak,
  sigils,
  rank,
  canEditProfile = false,
  onChangeAvatar,
  onSubmitCat,
  onViewMyCats,
}: TrainerHeroProps) {
  const animatedStreak = useCountUp(streak);
  const animatedSigils = useCountUp(sigils);
  const animatedRank = useCountUp(rank);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  return (
    <section className="relative mb-0 overflow-hidden rounded-t-3xl border border-white/[0.05] bg-[radial-gradient(120%_120%_at_10%_0%,rgba(99,102,241,0.22)_0%,rgba(10,12,24,0.92)_48%,rgba(6,8,18,0.96)_100%)] p-5 shadow-[0_16px_34px_rgba(4,8,24,0.55)] backdrop-blur-sm sm:mb-0 sm:p-6">
      <div className="absolute -top-24 -left-20 h-56 w-56 rounded-full bg-cyan-400/8 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-28 -right-20 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#0b1022] to-transparent pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
        <div className="relative flex-shrink-0">
          <div className={`relative h-[84px] w-[84px] overflow-hidden rounded-2xl border-2 ${rarityBorder(rarity)} bg-gradient-to-br from-white/10 to-black/50 shadow-lg sm:h-[92px] sm:w-[92px]`}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={`Trainer avatar for ${username}`} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cyan-500/20 to-violet-500/25 text-4xl font-black text-white/90 sm:text-5xl">
                {username.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-3xl sm:text-4xl font-black tracking-tight text-white drop-shadow-lg">{username}</h1>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500/25 to-red-500/25 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative inline-flex items-center gap-1.5 rounded-full border border-orange-400/30 bg-orange-400/10 px-2.5 py-1 text-xs font-bold text-white">
                <span className={streak > 0 && !reducedMotion ? 'animate-pulse' : ''}>🔥</span>
                <span className="text-orange-300">{animatedStreak}</span>
              </div>
            </div>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-500/25 to-amber-500/25 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative inline-flex items-center gap-1.5 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-2.5 py-1 text-xs font-bold text-white">
                <span>⚡</span>
                <span className="text-yellow-300">{animatedSigils.toLocaleString()}</span>
              </div>
            </div>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500/25 to-pink-500/25 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-400/10 px-2.5 py-1 text-xs font-bold text-white">
                <span>🏆</span>
                <span className="text-purple-300">Rank {animatedRank}</span>
              </div>
            </div>
            {canEditProfile ? (
              <button
                type="button"
                onClick={onChangeAvatar}
                className="inline-flex h-7 items-center rounded-full border border-white/15 bg-white/[0.03] px-2.5 text-[11px] font-semibold text-white/80 hover:bg-white/[0.08]"
              >
                Change Avatar
              </button>
            ) : null}
          </div>

          <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:flex sm:gap-2.5">
            <button
              type="button"
              onClick={onSubmitCat}
              className="group relative"
            >
              <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-yellow-400/35 to-amber-400/35 blur-md opacity-0 transition-all duration-200 group-hover:opacity-100 group-active:opacity-60" />
              <div className="relative inline-flex h-10 w-full items-center justify-center rounded-xl bg-gradient-to-b from-yellow-400 to-yellow-500 px-3.5 text-sm font-bold tracking-wide text-black shadow-lg shadow-yellow-500/25 transition-all duration-150 group-hover:shadow-xl group-hover:shadow-yellow-400/40 group-active:scale-95">
                Submit Cat
              </div>
            </button>
            <button
              type="button"
              onClick={onViewMyCats}
              className="group relative"
            >
              <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-cyan-500/15 to-violet-500/20 blur-md opacity-0 transition-all duration-200 group-hover:opacity-100" />
              <div className="relative inline-flex h-10 w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] px-3.5 text-sm font-bold text-white transition-all duration-150 group-hover:border-white/25 group-hover:bg-white/[0.08] group-active:scale-95">
                View Cats
              </div>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
