'use client';

import { useEffect, useMemo, useState } from 'react';
import { Flame } from 'lucide-react';
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
  className?: string;
  compact?: boolean;
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
  className = '',
  compact = false,
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

  const goVote = () => router.push('/arena?focus=vote');
  const goPredict = () => router.push('/arena?focus=predict');
  const goSubmit = () => router.push('/submit');

  let statusText = 'Your flame needs fuel.';
  let helperText = 'Do one today to keep it alive:';
  let primaryCta = 'Fuel the Flame';
  let primaryAction = goVote;
  let secondaryText: string | null = 'Fastest: vote 5 times.';
  let countdownText: string | null = null;
  let showChips = true;
  let showSecondaryButton = false;

  if (viewState === 'fading') {
    statusText = 'Your flame is fading.';
    countdownText = `Save it in ${formatHms(localSeconds || 0)}`;
    helperText = 'Vote 5 times or place 1 prediction.';
    primaryCta = 'Reignite Flame';
    primaryAction = goVote;
    secondaryText = null;
    showChips = false;
  } else if (viewState === 'expired') {
    statusText = 'Flame went out.';
    helperText = 'Reignite today to start a new run.';
    primaryCta = 'Ignite Flame';
    primaryAction = goVote;
    secondaryText = null;
    showChips = false;
  } else if (flame.qualifiesToday) {
    statusText = 'Flame fueled. Keep the heat up.';
    helperText = `Next reward in ${Math.max(0, Number(flame.nextMilestone?.daysRemaining || 0))} days.`;
    primaryCta = 'Keep Playing';
    primaryAction = goVote;
    secondaryText = null;
    showChips = false;
    showSecondaryButton = true;
  }

  return (
    <div className={`rounded-2xl border ${compact ? 'p-3 min-h-[210px]' : 'p-4 min-h-[232px]'} shadow-[0_12px_34px_rgba(0,0,0,0.28)] ${toneClass} ${className}`}>
      <p className="text-sm font-bold text-white/95 inline-flex items-center gap-1.5">
        <Flame className={`w-4 h-4 ${viewState === 'fading' ? 'text-red-300 animate-pulse' : viewState === 'active' ? 'text-orange-300 flame-flicker' : 'text-zinc-400'}`} />
        Arena Flame
      </p>
      <p className={`${compact ? 'text-2xl' : 'text-3xl'} font-extrabold text-white mt-1`}>Day {dayNumber}</p>
      {!compact && <p className="text-xs text-white/80 mt-1">{statusText}</p>}
      {countdownText ? (
        <p className="text-xs text-red-200 mt-1 font-semibold">{countdownText}</p>
      ) : (
        <p className="text-[11px] text-white/60 mt-1">{compact ? `Next milestone: Day ${nextMilestone}` : helperText}</p>
      )}

      <div className="mt-3">
        <div className="h-1.5 rounded-full bg-black/35 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-orange-300 via-amber-300 to-emerald-300 transition-all duration-300" style={{ width: `${milestoneProgress * 100}%` }} />
        </div>
        <p className="text-[10px] text-white/60 mt-1">Next milestone: Day {nextMilestone}</p>
      </div>

      {showChips && (
        <div className="grid grid-cols-3 gap-2 mt-3">
          <button onClick={goVote} className="h-9 rounded-lg bg-white/10 border border-white/15 text-[11px] font-semibold text-white/90">
            Vote ({votesToday}/5)
          </button>
          <button onClick={goPredict} className="h-9 rounded-lg bg-white/10 border border-white/15 text-[11px] font-semibold text-white/90">
            Predict ({predictionsToday}/1)
          </button>
          <button onClick={goSubmit} className="h-9 rounded-lg bg-white/10 border border-white/15 text-[11px] font-semibold text-white/90">
            Submit / Adopt ({catsToday}/1)
          </button>
        </div>
      )}

      <button
        onClick={primaryAction}
        className={`mt-3 ${compact ? 'h-10' : 'h-11'} w-full rounded-xl bg-white text-black text-sm font-extrabold active:scale-[0.99] transition-transform`}
      >
        {primaryCta}
      </button>

      {showSecondaryButton && (
        <button
          onClick={() => router.push('/gallery?tab=my-cats')}
          className="mt-2 h-10 w-full rounded-xl bg-white/10 border border-white/20 text-white text-sm font-semibold"
        >
          View My Cats
        </button>
      )}

      {!compact && secondaryText && <p className="text-[11px] text-white/55 mt-2">{secondaryText}</p>}
    </div>
  );
}
