'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';

type RarityTone = 'common' | 'rare' | 'epic' | 'legendary';

function rarityTone(rarity: string | null | undefined): RarityTone {
  const key = String(rarity || '').toLowerCase();
  if (key.includes('legendary') || key.includes('mythic') || key.includes('god')) return 'legendary';
  if (key.includes('epic')) return 'epic';
  if (key.includes('rare')) return 'rare';
  return 'common';
}

function toneClasses(tone: RarityTone) {
  if (tone === 'rare') return 'border-cyan-300/35 text-cyan-100';
  if (tone === 'epic') return 'border-violet-300/35 text-violet-100';
  if (tone === 'legendary') return 'border-amber-300/40 text-amber-100';
  return 'border-slate-200/28 text-slate-100';
}

export default function VoteConfirmToast({
  visible,
  rarity,
  pulseTick = 0,
  boostAmount,
  streakBonus,
  extraLine,
}: {
  visible: boolean;
  rarity?: string | null;
  pulseTick?: number;
  boostAmount?: number | null;
  streakBonus?: number | null;
  extraLine?: string | null;
}) {
  const tone = rarityTone(rarity);
  const toneClass = toneClasses(tone);
  const hasBoost = boostAmount && boostAmount > 0;
  const hasStreak = streakBonus && streakBonus > 0;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+74px)] z-[1300] flex justify-center px-4">
      <AnimatePresence mode="wait">
        {visible ? (
          <motion.div
            key={`vote-confirm-toast-${pulseTick}`}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25, mass: 0.8 }}
            className={`relative w-full max-w-[320px] overflow-hidden rounded-2xl border bg-slate-900/80 px-3.5 py-2.5 shadow-[0_12px_28px_rgba(0,0,0,0.34)] backdrop-blur-md ${toneClass}`}
          >
            <motion.span
              className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.16),transparent)]"
              initial={{ x: '-120%' }}
              animate={{ x: '420%' }}
              transition={{ duration: 0.52, ease: 'easeOut' }}
            />
            <motion.div
              animate={pulseTick ? { scale: [1, 1.02, 1] } : { scale: 1 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative"
            >
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/8">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-extrabold tracking-[0.16em] text-white">
                    {hasBoost ? 'VOTE + BOOST LOCKED' : 'VOTE LOCKED'}
                  </span>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/90">
                      +1 Flame
                    </span>
                    {hasBoost && (
                      <span className="inline-flex items-center rounded bg-amber-500/20 border border-amber-400/30 px-1.5 py-0.5 text-[10px] font-semibold text-amber-100">
                        +{boostAmount} boost
                      </span>
                    )}
                    {hasStreak && (
                      <span className="inline-flex items-center rounded bg-orange-500/20 border border-orange-400/30 px-1.5 py-0.5 text-[10px] font-semibold text-orange-100">
                        +{streakBonus}% streak
                      </span>
                    )}
                  </div>
                  {extraLine ? (
                    <span className="mt-1 block text-[10px] font-semibold text-emerald-100/90">
                      {extraLine}
                    </span>
                  ) : null}
                </span>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
