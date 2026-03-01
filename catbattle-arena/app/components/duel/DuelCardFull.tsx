'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Share2 } from 'lucide-react';
import type { DuelRowData } from './types';

function percent(a: number, b: number): [number, number] {
  const total = a + b;
  if (!total) return [50, 50];
  return [Math.round((a / total) * 100), Math.round((b / total) * 100)];
}

const DUEL_XP_KEY = 'cc_duel_xp_v1';

function xpNeededForLevel(level: number): number {
  return 100 + level * 25;
}

function deriveLevelProgress(totalXp: number): { level: number; current: number; needed: number } {
  let xp = Math.max(0, totalXp);
  let level = 1;
  let needed = xpNeededForLevel(level);
  while (xp >= needed) {
    xp -= needed;
    level += 1;
    needed = xpNeededForLevel(level);
  }
  return { level, current: xp, needed };
}

export default function DuelCardFull({
  duel,
  meId,
  busy,
  onVote,
  onShare,
}: {
  duel: DuelRowData;
  meId: string;
  busy: boolean;
  onVote: (duelId: string, catId: string) => Promise<boolean>;
  onShare: (duelId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pendingVote, setPendingVote] = useState<'A' | 'B' | null>(null);
  const [voteSubmitted, setVoteSubmitted] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [duelShownAt, setDuelShownAt] = useState<number>(Date.now());
  const [voteStreak, setVoteStreak] = useState(0);
  const [combo, setCombo] = useState(0);
  const [xpTotal, setXpTotal] = useState(0);
  const [xpGainPop, setXpGainPop] = useState<number | null>(null);
  const [streakPulse, setStreakPulse] = useState(false);
  const [comboPulse, setComboPulse] = useState(false);
  const voteInFlightRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const votesA = Number(duel.votes?.cat_a || 0);
  const votesB = Number(duel.votes?.cat_b || 0);
  const [pctA, pctB] = useMemo(() => percent(votesA, votesB), [votesA, votesB]);
  const localPctA = pendingVote === 'A' ? 62 : pendingVote === 'B' ? 38 : pctA;
  const localPctB = pendingVote === 'A' ? 38 : pendingVote === 'B' ? 62 : pctB;
  const canVote =
    duel.status === 'voting' &&
    !duel.votes?.user_vote_cat_id &&
    meId !== duel.challenger_user_id &&
    meId !== duel.challenged_user_id;
  const voteLocked = !!pendingVote || busy;
  const levelProgress = useMemo(() => deriveLevelProgress(xpTotal), [xpTotal]);

  useEffect(() => {
    setPendingVote(null);
    setVoteSubmitted(false);
    setVoteError(null);
    setDuelShownAt(Date.now());
  }, [duel.id, duel.votes?.user_vote_cat_id, duel.status]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(DUEL_XP_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      setVoteStreak(Math.max(0, Number(parsed.streak || 0)));
      setCombo(Math.max(0, Number(parsed.combo || 0)));
      setXpTotal(Math.max(0, Number(parsed.xp || 0)));
    } catch {
      // ignore localStorage parse errors
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        DUEL_XP_KEY,
        JSON.stringify({ streak: voteStreak, combo, xp: xpTotal })
      );
    } catch {
      // ignore localStorage write errors
    }
  }, [combo, voteStreak, xpTotal]);

  useEffect(() => {
    if (!xpGainPop) return;
    const id = window.setTimeout(() => setXpGainPop(null), 1300);
    timersRef.current.push(Number(id));
    return () => window.clearTimeout(id);
  }, [xpGainPop]);

  useEffect(() => {
    if (combo <= 0) return;
    const id = window.setTimeout(() => setCombo((prev) => Math.max(0, prev - 1)), 2000);
    timersRef.current.push(Number(id));
    return () => window.clearTimeout(id);
  }, [combo]);

  useEffect(() => {
    return () => {
      voteInFlightRef.current = false;
      for (const timer of timersRef.current) window.clearTimeout(timer);
      timersRef.current = [];
    };
  }, []);

  async function handleVote(side: 'A' | 'B', catId: string | null | undefined) {
    if (!catId || !canVote || voteLocked || voteInFlightRef.current) return;
    voteInFlightRef.current = true;
    setPendingVote(side);
    setVoteSubmitted(false);
    setVoteError(null);
    try {
      const ok = await onVote(duel.id, catId);
      if (ok) {
        const elapsedMs = Math.max(0, Date.now() - duelShownAt);
        const comboGain = elapsedMs < 3000 ? 2 : elapsedMs < 6000 ? 1 : 0;
        const nextCombo = comboGain > 0 ? combo + comboGain : Math.max(0, combo - 1);
        const nextStreak = voteStreak + 1;
        const xpGain = 5 + nextCombo + Math.min(nextStreak, 10);
        setCombo(nextCombo);
        setVoteStreak(nextStreak);
        setXpTotal((prev) => prev + xpGain);
        setXpGainPop(xpGain);
        setStreakPulse(true);
        setComboPulse(comboGain > 0);
        const streakTimer = window.setTimeout(() => setStreakPulse(false), 240);
        const comboTimer = window.setTimeout(() => setComboPulse(false), 240);
        timersRef.current.push(Number(streakTimer), Number(comboTimer));
        setVoteSubmitted(true);
        return;
      }
      setPendingVote(null);
      setVoteSubmitted(false);
      setVoteError('Vote failed — try again');
    } finally {
      voteInFlightRef.current = false;
    }
  }

  return (
    <article className="rounded-xl border border-white/12 bg-white/[0.035] p-3.5">
      <div className="grid grid-cols-2 gap-2.5">
        {[{ cat: duel.challenger_cat, user: duel.challenger_username, side: 'a' }, { cat: duel.challenged_cat, user: duel.challenged_username, side: 'b' }].map(({ cat, user, side }) => (
          <div key={side} className="rounded-lg border border-white/12 bg-black/25 p-2">
            <div className="flex items-center gap-2">
              <img
                src={cat?.image_url || '/cat-placeholder.svg'}
                alt={cat?.name || 'Cat'}
                width={40}
                height={40}
                className="h-10 w-10 rounded-lg object-cover border border-white/20"
                loading="lazy"
                decoding="async"
              />
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-white truncate">{cat?.name || 'Unknown'}</p>
                <p className="text-[10px] text-white/60 truncate">{user}</p>
                <p className="text-[9px] text-white/45 truncate">{cat?.rarity || 'Common'}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-white/10 bg-black/25 p-2.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${streakPulse ? 'scale-105' : 'scale-100'} transition-transform duration-200 border-orange-300/35 bg-orange-500/15 text-orange-100`}
          >
            🔥 Streak: {voteStreak}
          </span>
          {combo >= 2 ? (
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${comboPulse ? 'scale-105' : 'scale-100'} transition-transform duration-200 border-cyan-300/35 bg-cyan-500/15 text-cyan-100`}
            >
              ⚡ Combo x{combo}
            </span>
          ) : (
            <span className="text-[10px] text-white/45">Lv {levelProgress.level}</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => void handleVote('A', duel.challenger_cat?.id)}
            disabled={!canVote || voteLocked || !duel.challenger_cat?.id}
            className={`h-11 rounded-lg text-[12px] font-bold disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/70 touch-manipulation transition-all duration-500 ${pendingVote === 'A' ? 'bg-orange-500/35 text-orange-50 ring-2 ring-orange-300/70 shadow-[0_0_18px_rgba(251,146,60,0.45)]' : pendingVote === 'B' ? 'bg-orange-500/10 text-orange-100/70' : 'bg-orange-500/20 text-orange-100'}`}
          >
            {pendingVote === 'A' && !voteSubmitted ? 'Submitting…' : 'Vote A'}
          </button>
          <button
            onClick={() => void handleVote('B', duel.challenged_cat?.id)}
            disabled={!canVote || voteLocked || !duel.challenged_cat?.id}
            className={`h-11 rounded-lg text-[12px] font-bold disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 touch-manipulation transition-all duration-500 ${pendingVote === 'B' ? 'bg-cyan-500/35 text-cyan-50 ring-2 ring-cyan-300/70 shadow-[0_0_18px_rgba(34,211,238,0.45)]' : pendingVote === 'A' ? 'bg-cyan-500/10 text-cyan-100/70' : 'bg-cyan-500/20 text-cyan-100'}`}
          >
            {pendingVote === 'B' && !voteSubmitted ? 'Submitting…' : 'Vote B'}
          </button>
        </div>
        <div className="mt-2 h-2 rounded-full overflow-hidden bg-white/10 flex">
          <div className={`bg-orange-400/90 transition-all duration-700 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] ${pendingVote === 'A' ? 'shadow-[0_0_14px_rgba(251,146,60,0.75)]' : ''}`} style={{ width: `${localPctA}%` }} />
          <div className={`bg-cyan-400/90 transition-all duration-700 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] ${pendingVote === 'B' ? 'shadow-[0_0_14px_rgba(34,211,238,0.75)]' : ''}`} style={{ width: `${localPctB}%` }} />
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-white/65 min-h-[14px]">
          <span>{votesA} votes</span>
          <span>
            {pendingVote ? (
              <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 ${pendingVote === 'A' ? 'border-orange-300/45 bg-orange-500/20 text-orange-100' : 'border-cyan-300/45 bg-cyan-500/20 text-cyan-100'}`}>
                +1 {pendingVote}
              </span>
            ) : `${Number(duel.votes?.total || 0)} total`}
          </span>
          <span>{votesB} votes</span>
        </div>
        {voteSubmitted && (
          <p className="mt-1 text-[10px] text-emerald-200">Voted ✅</p>
        )}
        {xpGainPop != null && (
          <p className="mt-1 text-[10px] text-emerald-200 animate-pulse">+{xpGainPop} XP</p>
        )}
        {voteError && (
          <p className="mt-1 text-[10px] text-red-300">{voteError}</p>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="h-10 px-3 rounded-lg border border-white/15 bg-white/5 text-[11px] font-semibold text-white/85 inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 touch-manipulation"
        >
          Details
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={() => onShare(duel.id)}
          className="h-10 px-3 rounded-lg bg-white text-black text-[11px] font-bold inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 touch-manipulation"
        >
          <Share2 className="w-3.5 h-3.5" />
          Share
        </button>
      </div>

      {expanded && (
        <div className="mt-2 rounded-lg border border-white/10 bg-black/20 p-2.5 text-[11px] text-white/70 space-y-1">
          <p>Status: <span className="text-white/90 capitalize">{String(duel.status || 'voting')}</span></p>
          <p>Challenger: <span className="text-white/90">{duel.challenger_username}</span></p>
          <p>Challenged: <span className="text-white/90">{duel.challenged_username}</span></p>
        </div>
      )}
    </article>
  );
}
