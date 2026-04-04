'use client';

import { Flame, Clock, Gift } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const MILESTONES = [1, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90];

function getNextMilestone(count: number): { next: number; prev: number } {
  for (const m of MILESTONES) {
    if (count < m) return { next: m, prev: MILESTONES[MILESTONES.indexOf(m) - 1] || 0 };
  }
  return { next: 90, prev: 60 };
}

function getReturnCopy(streakCount: number, votesToday: number): { heading: string; sub: string } {
  if (streakCount === 0) {
    return { heading: 'Start your streak', sub: 'Vote 5 times today to ignite your flame' };
  }
  if (votesToday >= 5) {
    return { heading: 'Daily complete', sub: 'Return tomorrow to keep the flame burning' };
  }
  const remaining = Math.max(0, 5 - votesToday);
  if (streakCount >= 7) {
    return { heading: 'Master burner', sub: `${remaining} more to maintain your ${streakCount}-day empire` };
  }
  if (streakCount >= 3) {
    return { heading: 'Building momentum', sub: `${remaining} more to keep your ${streakCount}-day streak alive` };
  }
  return { heading: 'Keep it burning', sub: `${remaining} more votes to maintain your streak` };
}

export default function DailyProgression({
  streakCount,
  votesToday = 0,
  compact = false,
  reactionTick = 0,
}: {
  streakCount: number;
  votesToday?: number;
  compact?: boolean;
  reactionTick?: number;
}) {
  const milestone = useMemo(() => getNextMilestone(streakCount), [streakCount]);
  const dailyProgress = Math.min(100, (votesToday / 5) * 100);
  const dailyComplete = votesToday >= 5;

  const copy = getReturnCopy(streakCount, votesToday);
  const remainingVotes = Math.max(0, 5 - votesToday);
  const [justReacted, setJustReacted] = useState(false);

  useEffect(() => {
    if (!reactionTick) return;
    setJustReacted(true);
    const id = window.setTimeout(() => setJustReacted(false), 720);
    return () => window.clearTimeout(id);
  }, [reactionTick]);

  if (compact) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 py-2.5">
        <div className="flex items-center gap-3">
          <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${
            streakCount > 0 ? 'bg-orange-500/20' : 'bg-white/10'
          }`}>
            <Flame className={`w-4 h-4 ${streakCount > 0 ? 'text-orange-300' : 'text-white/40'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-white/70">{copy.heading}</p>
            <p className="text-[10px] text-white/45 truncate">{copy.sub}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-white">{streakCount}</p>
            <p className="text-[9px] text-white/40">days</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-white/[0.05] bg-[radial-gradient(circle_at_top,rgba(251,146,60,0.08),transparent_40%),linear-gradient(135deg,rgba(51,65,85,0.2),rgba(15,23,42,0.4),rgba(2,6,23,0.6))] px-4 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.2)] backdrop-blur-sm transition-[transform,box-shadow,border-color] duration-300 ${justReacted ? 'border-orange-300/12 shadow-[0_14px_34px_rgba(0,0,0,0.22),0_0_18px_rgba(251,146,60,0.1)] scale-[1.01]' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-200/55">Your momentum</p>
          <p className="mt-1 text-lg font-black text-white">Keep it burning</p>
          <p className="mt-1 text-[11px] text-white/52">{copy.sub}</p>
        </div>
        <div className="text-right leading-none">
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">Next</p>
          <p className="mt-1 text-sm font-bold text-white/88">Day {milestone.next}</p>
        </div>
      </div>

      <div className="mt-3.5 flex items-center justify-center gap-5 rounded-[1.2rem] border border-white/[0.04] bg-black/20 px-4 py-3">
        <div className="relative flex h-20 w-20 items-center justify-center">
          <div className={`absolute inset-0 rounded-full bg-gradient-to-br from-orange-500/30 to-red-500/15 blur-2xl animate-pulse transition-opacity duration-300 ${justReacted ? 'opacity-100' : 'opacity-80'}`} style={{ animationDuration: '3s' }} />
          <div className="absolute inset-[12px] rounded-full border border-orange-400/20 animate-spin" style={{ animationDuration: '8s' }} />
          <div className={`relative text-4xl animate-bounce transition-transform duration-300 ${justReacted ? 'scale-[1.08]' : ''}`} style={{ animationDuration: '1.5s' }}>🔥</div>
          <div className="absolute right-2 top-1 h-2.5 w-2.5 rounded-full bg-orange-300/90 animate-pulse" style={{ animationDuration: '1.15s' }} />
          <div className="absolute bottom-3 left-3 h-2 w-2 rounded-full bg-red-300/80 animate-pulse" style={{ animationDuration: '1.7s' }} />
        </div>
        <div className="min-w-[96px] text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/42">Current streak</p>
          <p className="mt-1 text-4xl font-black leading-none text-orange-200">{streakCount}</p>
          <p className="mt-1 text-[10px] text-orange-100/55">days in a row</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto] items-center gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">Votes Today</span>
            <span className={`text-[11px] font-bold ${dailyComplete ? 'text-emerald-300' : 'text-white/85'}`}>{votesToday}/5</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                dailyComplete ? 'bg-emerald-400' : 'bg-gradient-to-r from-cyan-400 to-blue-400'
              } ${justReacted && !dailyComplete ? 'brightness-110' : ''}`}
              style={{ width: `${dailyProgress}%` }}
            />
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.04] bg-white/[0.03] px-3 py-2 text-right leading-tight">
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/40">Milestone</p>
          <p className="text-xs font-bold text-orange-200">Day {milestone.next}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[10px] text-white/50">
        <div className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          <span>Resets tonight</span>
        </div>
        {dailyComplete ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-2 py-0.5 text-emerald-100">
            <Gift className="h-3.5 w-3.5 text-emerald-300" />
            Complete
          </span>
        ) : (
          <span className="font-semibold text-white/65">{remainingVotes} more to maintain streak</span>
        )}
      </div>
    </div>
  );
}
