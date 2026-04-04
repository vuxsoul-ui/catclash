'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Flame, ArrowRight } from 'lucide-react';
import SigilIcon from './icons/SigilIcon';

export type MatchResultRevealProps = {
  visible: boolean;
  outcome: 'WIN' | 'LOSS';
  sigilsEarned?: number;
  streakCount?: number; // current streak count (not change)
  streakChange?: number; // positive = gained, negative = lost
  boosted?: boolean; // whether user had a boost/prediction on this match
  nextMilestone?: { nextDay: number; daysRemaining: number };
  onClose?: () => void;
  onContinue?: () => void;
};

export default function MatchResultReveal({
  visible,
  outcome,
  sigilsEarned = 0,
  streakCount = 0,
  streakChange = 0,
  boosted = false,
  nextMilestone,
  onClose,
  onContinue,
}: MatchResultRevealProps) {
  const [localVisible, setLocalVisible] = useState(visible);

  useEffect(() => {
    if (visible) {
      setLocalVisible(true);
      const timer = setTimeout(() => {
        setLocalVisible(false);
        onContinue?.();
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [visible, onContinue]);

  const isWin = outcome === 'WIN';
  const hasSigils = sigilsEarned > 0;
  const hasStreakGain = streakChange > 0;
  const hasStreakLoss = streakChange < 0;
  const hasBoost = boosted && hasSigils;
  const hasStreak = streakCount > 0;

  // Win: emerald/teal glow with stronger saturation
  // Loss: cooler slate with subtle warmth (not cold/depressing)
  const winGlow = 'drop-shadow-[0_0_28px_rgba(16,185,129,0.5)] drop-shadow-[0_0_48px_rgba(20,184,166,0.25)]';
  const lossGlow = 'drop-shadow-[0_0_16px_rgba(148,163,184,0.2)]';

  // Contextual copy - tighter, more game-like
  const outcomeLabel = isWin ? 'VICTORY' : 'DEFEAT';
  const contextualText = useMemo(() => {
    if (isWin) {
      if (hasBoost) return 'Boost paid off';
      if (hasStreakGain && streakCount >= 5) return `Streak burning at ${streakCount}`;
      if (hasStreakGain) return 'Streak growing';
      return 'Your pick landed';
    }
    if (hasBoost) return 'Boost missed';
    if (hasStreakLoss && streakCount <= 2) return 'Flame flickering';
    if (hasStreakLoss) return 'Streak broken';
    return 'Back to the arena';
  }, [isWin, hasBoost, hasStreakGain, hasStreakLoss, streakCount]);

  const handleTap = () => {
    setLocalVisible(false);
    onContinue?.();
  };

  return (
    <AnimatePresence>
      {localVisible ? (
        <>
          {/* Backdrop - subtle dim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-[1400]"
            onClick={handleTap}
          />

          {/* Reveal Card */}
          <motion.div
            initial={{ opacity: 0, y: isWin ? 32 : 24, scale: 0.94 }}
            animate={{ opacity: 1, y: isWin ? 0 : 4, scale: 1 }}
            exit={{ opacity: 0, y: isWin ? -16 : 20, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26, mass: 0.8 }}
            className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+80px)] z-[1401] flex justify-center px-4 pointer-events-auto"
            onClick={handleTap}
          >
            <div
              className={`relative w-full max-w-[340px] overflow-hidden rounded-3xl border backdrop-blur-md shadow-[0_20px_40px_rgba(0,0,0,0.5)] ${
                isWin
                  ? 'border-emerald-400/40 bg-gradient-to-br from-emerald-500/25 via-teal-500/14 to-cyan-500/12'
                  : 'border-slate-400/35 bg-gradient-to-br from-slate-500/22 via-zinc-500/14 to-gray-500/12'
              }`}
            >
              {/* Shine effect on win - more pronounced */}
              {isWin && (
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
                  className="absolute inset-y-0 -left-1/3 w-1/3 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)]"
                />
              )}

              <div className="p-4">
                {/* Outcome Header - stronger hierarchy */}
                <div className="flex items-center justify-center gap-3 mb-1">
                  {isWin ? (
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.05 }}
                      className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/30 border-2 border-emerald-400/60 shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                    >
                      <Trophy className="w-6 h-6 text-emerald-100 drop-shadow-[0_0_8px_rgba(134,239,175,0.6)]" />
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 22, delay: 0.05 }}
                      className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-500/25 border border-slate-400/40"
                    >
                      <span className="text-lg font-black text-slate-300">vs</span>
                    </motion.div>
                  )}
                  <motion.div className="flex flex-col items-center">
                    <motion.span
                      initial={{ opacity: 0, y: isWin ? 8 : 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 }}
                      className={`text-[32px] font-black tracking-wide leading-none ${
                        isWin ? 'text-emerald-50' : 'text-slate-100'
                      } ${isWin ? winGlow : lossGlow}`}
                    >
                      {outcomeLabel}
                    </motion.span>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.14 }}
                      className="text-[11px] text-center text-white/55 mt-0.5"
                    >
                      {contextualText}
                    </motion.p>
                  </motion.div>
                </div>

                {/* Rewards Row - clearer value prop */}
                {(hasSigils || hasStreakGain || hasStreakLoss || hasStreak) && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.18 }}
                    className="flex flex-wrap items-center justify-center gap-2 pt-2 mt-2 border-t border-white/10"
                  >
                    {hasSigils && (
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${
                        hasBoost
                          ? 'bg-amber-500/20 border-amber-300/50 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                          : 'bg-amber-500/15 border-amber-400/30'
                      }`}>
                        <SigilIcon className={`w-4 h-4 ${hasBoost ? 'text-amber-200' : 'text-amber-300'}`} />
                        <span className={`text-sm font-bold ${hasBoost ? 'text-amber-50' : 'text-amber-100'}`}>
                          +{sigilsEarned}
                        </span>
                      </div>
                    )}

                    {hasStreakGain && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/20 border border-orange-400/35 shadow-[0_0_12px_rgba(249,115,22,0.2)]">
                        <Flame className="w-4 h-4 text-orange-200 animate-pulse" />
                        <span className="text-sm font-bold text-orange-50">+{streakChange}</span>
                      </div>
                    )}

                    {hasStreakLoss && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-500/15 border border-slate-400/30">
                        <Flame className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-bold text-slate-300">{streakChange}</span>
                      </div>
                    )}

                    {/* Current streak display - always show when active */}
                    {hasStreak && !hasStreakGain && !hasStreakLoss && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-400/25">
                        <Flame className="w-4 h-4 text-orange-300" />
                        <span className="text-sm font-bold text-orange-100">{streakCount} day streak</span>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Milestone Progress - return motivation */}
                {nextMilestone && nextMilestone.daysRemaining > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.22 }}
                    className="mt-2.5 pt-2 border-t border-white/8"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-white/45">
                        {isWin ? 'Keep the flame burning' : 'Return to rebuild'}
                      </span>
                      <span className="text-[10px] font-semibold text-white/60">
                        {nextMilestone.daysRemaining} day{nextMilestone.daysRemaining > 1 ? 's' : ''} to {nextMilestone.nextDay}
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* Continue CTA - stronger pull */}
                <motion.button
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ delay: 0.26 }}
                  onClick={handleTap}
                  className="w-full mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 px-4 py-2.5 transition-all active:scale-[0.98]"
                >
                  <span className="text-[12px] font-bold text-white tracking-[0.08em] uppercase">
                    {isWin ? 'Keep the streak alive' : 'Jump back in'}
                  </span>
                  <motion.span
                    initial={{ x: 0 }}
                    animate={{ x: [0, 4, 0] }}
                    transition={{ delay: 0.4, duration: 0.8, repeat: Infinity, repeatType: 'reverse' }}
                  >
                    <ArrowRight className="w-4 h-4 text-white/70" />
                  </motion.span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
