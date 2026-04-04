'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Flame } from 'lucide-react';
import { useRouter } from 'next/navigation';

type FlameState = 'active' | 'fading' | 'expired';

export type ArenaFlame = {
  dayCount: number;
  state: FlameState;
  qualifiesToday: boolean;
  todayProgress: {
    votesToday: number;
    predictionsToday: number;
    catsToday: number;
  };
  fadingExpiresAt: string | null;
  secondsRemaining: number | null;
  nextMilestone: {
    nextDay: number;
    daysRemaining: number;
  };
};

type ArenaFlameCardProps = {
  flame: ArenaFlame | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onNavigateAction?: (action: 'vote' | 'predict' | 'submit') => void;
  className?: string;
  compact?: boolean;
  starterTasks?: Array<{
    key: string;
    title: string;
    done: boolean;
    cta?: string | null;
  }>;
  onStarterTaskAction?: (key: string) => void;
};

function formatHms(totalSeconds: number): string {
  const t = Math.max(0, totalSeconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ArenaFlameCard({
  flame,
  loading = false,
  error = null,
  onRetry,
  onNavigateAction,
  className = '',
  compact = false,
  starterTasks = [],
  onStarterTaskAction,
}: ArenaFlameCardProps) {
  const router = useRouter();
  const [localSeconds, setLocalSeconds] = useState<number | null>(flame?.secondsRemaining ?? null);
  const [localState, setLocalState] = useState<FlameState>(flame?.state || 'active');

  useEffect(() => {
    setLocalSeconds(flame?.secondsRemaining ?? null);
    setLocalState(flame?.state || 'active');
  }, [flame?.secondsRemaining, flame?.state]);

  useEffect(() => {
    if (localState !== 'fading' || localSeconds == null) return;
    const id = setInterval(() => {
      setLocalSeconds((prev) => {
        const next = Math.max(0, Number(prev || 0) - 1);
        if (next <= 0) {
          setLocalState('expired');
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [localState, localSeconds]);

  if (loading) {
    return (
      <div className={`rounded-2xl border border-white/10 bg-white/[0.04] ${compact ? 'p-3 min-h-[210px]' : 'p-4 min-h-[232px]'} animate-pulse ${className}`}>
        <div className="h-4 w-28 rounded bg-white/15 mb-3" />
        <div className="h-10 w-20 rounded bg-white/20 mb-2" />
        <div className="h-3 w-44 rounded bg-white/10 mb-3" />
        <div className="h-2 w-full rounded bg-white/10 mb-3" />
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="h-8 rounded bg-white/10" />
          <div className="h-8 rounded bg-white/10" />
          <div className="h-8 rounded bg-white/10" />
        </div>
        <div className="h-10 rounded-xl bg-white/10" />
      </div>
    );
  }

  if (error || !flame) {
    return (
      <div className={`rounded-2xl border border-red-400/25 bg-red-500/10 ${compact ? 'p-3 min-h-[210px]' : 'p-4 min-h-[232px]'} ${className}`}>
        <p className="text-sm font-bold text-red-100">Arena Flame unavailable</p>
        <p className="text-xs text-red-100/75 mt-1">Could not load your flame status.</p>
        <button
          onClick={onRetry}
          className="mt-3 h-10 px-4 rounded-xl bg-white/10 border border-white/20 text-sm font-semibold text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  const viewState: FlameState = localState;
  const dayNumber = viewState === 'expired' ? 1 : Math.max(1, Number(flame.dayCount || 1));
  const votesToday = Number(flame.todayProgress?.votesToday || 0);
  const predictionsToday = Number(flame.todayProgress?.predictionsToday || 0);
  const catsToday = Number(flame.todayProgress?.catsToday || 0);
  const nextMilestone = Math.max(1, Number(flame.nextMilestone?.nextDay || 1));
  const milestoneProgress = Math.max(0, Math.min(1, dayNumber / nextMilestone));

  const toneClass = useMemo(() => {
    if (viewState === 'fading') return 'border-red-400/35 bg-gradient-to-br from-red-500/15 to-orange-500/10';
    if (viewState === 'expired') return 'border-zinc-400/30 bg-gradient-to-br from-zinc-700/20 to-zinc-900/20';
    if (flame.qualifiesToday) return 'border-emerald-300/25 bg-gradient-to-br from-emerald-500/12 to-cyan-500/10';
    return 'border-orange-300/25 bg-gradient-to-br from-orange-500/12 to-amber-500/10';
  }, [viewState, flame.qualifiesToday]);

  const navigateAction = (action: 'vote' | 'predict' | 'submit') => {
    if (onNavigateAction) {
      onNavigateAction(action);
      return;
    }
    if (action === 'submit') {
      router.push('/submit');
      return;
    }
    router.push('/arena');
  };
  const goVote = () => navigateAction('vote');
  const goPredict = () => navigateAction('predict');
  const goSubmit = () => navigateAction('submit');
  const nextNeededAction: 'vote' | 'predict' | 'submit' =
    votesToday < 5 ? 'vote' : predictionsToday < 1 ? 'predict' : catsToday < 1 ? 'submit' : 'vote';
  const starterTasksRemaining = starterTasks.filter((task) => !task.done);
  const showStarterTasks = starterTasksRemaining.length > 0 && dayNumber <= 3;

  let statusText = 'Your flame needs fuel.';
  let helperText = 'Complete any one today:';
  let primaryCta = 'Fuel the Flame';
  let primaryAction = () => navigateAction(nextNeededAction);
  let secondaryText: string | null = '5 votes, 1 prediction, or 1 submit.';
  let countdownText: string | null = null;
  let showChips = true;
  let showSecondaryButton = false;

  if (viewState === 'fading') {
    statusText = 'Your flame is fading.';
    countdownText = `Save it in ${formatHms(localSeconds || 0)}`;
    helperText = 'Complete any one today:';
    primaryCta = 'Reignite Flame';
    primaryAction = () => navigateAction(nextNeededAction);
    secondaryText = null;
    showChips = false;
  } else if (viewState === 'expired') {
    statusText = 'Flame went out.';
    helperText = 'Reignite today.';
    primaryCta = 'Ignite Flame';
    primaryAction = () => navigateAction(nextNeededAction);
    secondaryText = null;
    showChips = false;
  } else if (flame.qualifiesToday) {
    statusText = 'Flame fueled.';
    helperText = `Next reward in ${Math.max(0, Number(flame.nextMilestone?.daysRemaining || 0))} days.`;
    primaryCta = 'Keep Playing';
    primaryAction = goVote;
    secondaryText = null;
    showChips = false;
    showSecondaryButton = true;
  }

  return (
    <div className={`relative group rounded-3xl overflow-hidden ${className}`}>
      {/* Background glow layer (hover effect) - heavily reduced */}
      <div className="absolute -inset-1 bg-gradient-to-br from-orange-500/15 via-red-500/8 to-amber-600/12 rounded-3xl blur-sm sm:blur-md opacity-0 group-hover:opacity-100 transition-all duration-500" />

      {/* Content layer - dark neutral base */}
      <div className={`relative z-10 bg-[#0d1116] border border-orange-500/15 rounded-3xl p-4 shadow-xl sm:shadow-2xl sm:shadow-black/20 ${compact ? 'min-h-[240px]' : 'min-h-[280px]'}`}>
        {/* Header with icon + title */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-bold text-white/90 inline-flex items-center gap-1.5">
            <div className="relative">
              <div className={`absolute inset-0 bg-orange-500/12 rounded-full blur-sm ${viewState === 'active' ? 'animate-pulse' : ''}`} style={{animationDuration: '2s'}} />
              <Flame className={`relative w-5 h-5 ${viewState === 'fading' ? 'text-red-300/80 animate-pulse' : viewState === 'active' ? 'text-orange-300/80 flame-flicker' : 'text-zinc-400'}`} />
            </div>
            Arena Flame
          </div>
          <div className="px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-400/25 text-xs font-bold text-orange-200/70">
            Day {dayNumber}
          </div>
        </div>

        {/* Big day counter - restrained gradient */}
        <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-200 via-amber-200 to-red-300 mt-1">Day {dayNumber}</p>

        {/* Vote count summary */}
        <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-white/5 border border-white/8 px-2 py-1">
          <span className="text-[10px] font-semibold text-white/70">Votes today</span>
          <span className={`text-[10px] font-black ${votesToday >= 5 ? 'text-emerald-300' : 'text-orange-200'}`}>{votesToday}/5</span>
        </div>

        {/* Status text */}
        {!compact && <p className="text-xs text-orange-200/60 mt-1">{statusText}</p>}
        {countdownText ? (
          <p className="text-xs text-red-200/70 mt-1 font-semibold">{countdownText}</p>
        ) : (
          <p className="text-[11px] text-white/50 mt-1">{compact ? `Next milestone: Day ${nextMilestone}` : helperText}</p>
        )}

        {/* Milestone progress */}
        <div className="mt-3 space-y-1.5">
          <div className="flex justify-between items-center text-xs text-gray-400">
            <span>Next Milestone</span>
            <span className="text-orange-200/60 font-bold">Day {nextMilestone}</span>
          </div>
          <div className="h-2 bg-white/8 rounded-full overflow-hidden border border-white/5">
            <div className="h-full bg-gradient-to-r from-orange-400 via-amber-400 to-emerald-300 rounded-full transition-all duration-300" style={{ width: `${milestoneProgress * 100}%` }} />
          </div>
        </div>

        {/* Task chips */}
        {showChips && (
          <div className={`grid mt-3 ${compact ? 'grid-cols-1 gap-1.5' : 'grid-cols-3 gap-2'}`}>
            <button
              onClick={goVote}
              className="arena-flame-task-row min-w-0 rounded-lg bg-white/4 border border-orange-500/12 hover:bg-white/8 font-semibold text-white/85 transition-all h-8 text-[11px] px-2 text-left flex items-center gap-2"
            >
              <div className={`w-4 h-4 rounded-full flex items-center justify-center ${votesToday >= 5 ? 'bg-orange-500/70' : 'bg-white/15'}`}>
                {votesToday >= 5 ? <Check className="w-2.5 h-2.5 text-white" /> : <span className="w-1.5 h-1.5 rounded-full bg-white/50" />}
              </div>
              <span className="truncate flex-1">Vote ({votesToday}/5)</span>
            </button>
            <button
              onClick={goPredict}
              className="arena-flame-task-row min-w-0 rounded-lg bg-white/4 border border-orange-500/12 hover:bg-white/8 font-semibold text-white/85 transition-all h-8 text-[11px] px-2 text-left flex items-center gap-2"
            >
              <div className={`w-4 h-4 rounded-full flex items-center justify-center ${predictionsToday >= 1 ? 'bg-orange-500/70' : 'bg-white/15'}`}>
                {predictionsToday >= 1 ? <Check className="w-2.5 h-2.5 text-white" /> : <span className="w-1.5 h-1.5 rounded-full bg-white/50" />}
              </div>
              <span className="truncate flex-1">Predict ({predictionsToday}/1)</span>
            </button>
            <button
              onClick={goSubmit}
              className="arena-flame-task-row min-w-0 rounded-lg bg-white/4 border border-orange-500/12 hover:bg-white/8 font-semibold text-white/85 transition-all h-8 text-[11px] px-2 text-left flex items-center gap-2"
            >
              <div className={`w-4 h-4 rounded-full flex items-center justify-center ${catsToday >= 1 ? 'bg-orange-500/70' : 'bg-white/15'}`}>
                {catsToday >= 1 ? <Check className="w-2.5 h-2.5 text-white" /> : <span className="w-1.5 h-1.5 rounded-full bg-white/50" />}
              </div>
              <span className="truncate flex-1">{compact ? `Submit (${catsToday}/1)` : `Submit (${catsToday}/1)`}</span>
            </button>
          </div>
        )}

        {/* Starter Tasks */}
        {showStarterTasks ? (
          <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.03] p-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">Starter Tasks</p>
            <div className="mt-1.5 space-y-1.5">
              {starterTasksRemaining.slice(0, 3).map((task) => (
                <div key={task.key} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-white/75 truncate">{task.title}</span>
                  {task.cta && onStarterTaskAction ? (
                    <button
                      type="button"
                      onClick={() => onStarterTaskAction(task.key)}
                      data-testid={`starter-quest-cta-${task.key}`}
                      className="h-7 shrink-0 rounded-full border border-white/12 bg-white/8 px-2.5 text-[10px] font-semibold text-white/80 hover:bg-white/12 transition-colors"
                    >
                      {task.cta}
                    </button>
                  ) : (
                    <span className="text-[10px] text-white/40">Tracked</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Primary CTA button - crisp, minimal glow */}
        <div className="mt-3">
          <button
            onClick={primaryAction}
            className={`w-full rounded-xl bg-orange-500/80 text-black font-extrabold active:scale-95 transition-all duration-150 hover:bg-orange-500/90 shadow-[0_4px_12px_rgba(0,0,0,0.15)] ${compact ? 'h-10 text-sm' : 'h-11 text-base'}`}
          >
            🔥 {primaryCta}
          </button>
        </div>

        {/* Secondary button */}
        {showSecondaryButton && (
          <button
            onClick={() => router.push('/gallery?tab=my-cats')}
            className="mt-2 h-10 w-full rounded-xl bg-white/10 border border-white/20 text-white text-sm font-semibold hover:bg-white/15 transition-colors"
          >
            View My Cats
          </button>
        )}

        {!compact && secondaryText && <p className="text-[11px] text-white/55 mt-2">{secondaryText}</p>}
      </div>
    </div>
  );
}
