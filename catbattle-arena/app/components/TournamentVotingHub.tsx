'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, Swords, Target, ChevronDown, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import SigilIcon from './icons/SigilIcon';
import CatCardBack from './CatCardBack';
import { showGlobalToast } from '../lib/global-toast';
import { thumbUrlForCat } from '../lib/cat-images';
import { deriveTournamentMatchState, summarizeTournamentPlayable } from '../lib/tournament-state';

interface ArenaCat {
  id: string;
  name: string;
  image_url: string | null;
  rarity: string;
  level?: number;
  ability?: string | null;
  ability_description?: string | null;
  description?: string | null;
  lore?: string | null;
  tagline?: string | null;
  origin?: string | null;
  wins?: number;
  losses?: number;
  owner_username?: string | null;
  owner_guild?: 'sun' | 'moon' | null;
  equipped_skill_name?: string | null;
  equipped_skill_trigger_label?: string | null;
  stats?: { attack: number; defense: number; speed: number; charisma: number; chaos: number };
}

interface ArenaMatch {
  match_id: string;
  cat_a: ArenaCat;
  cat_b: ArenaCat;
  votes_a: number;
  votes_b: number;
  total_votes?: number;
  percent_a?: number;
  percent_b?: number;
  status: string;
  voting_locked?: boolean;
  vote_locks_at?: string | null;
  resolves_at?: string | null;
  winner_id?: string | null;
  is_close_match?: boolean;
  user_prediction?: { predicted_cat_id: string; bet_sigils: number } | null;
}

interface ArenaRound { round: number; matches: ArenaMatch[]; }
interface Arena {
  tournament_id: string;
  type: string;
  date: string;
  current_round: number;
  status: string;
  champion: ArenaCat | null;
  rounds: ArenaRound[];
}

interface HomeDashboardData {
  highlights: Array<{ id: string; title: string; subtitle: string; created_at: string }>;
}

type BracketOverviewMatch = {
  match_id: string;
  round: number;
  status: string;
  votes_a: number;
  votes_b: number;
  cat_a: { id: string; name: string; image_url: string | null };
  cat_b: { id: string; name: string; image_url: string | null };
};

type BracketOverviewPayload = {
  tournament: { round: number; champion: { name: string } | null } | null;
  matches: BracketOverviewMatch[];
};

type BracketQueuePayload = {
  currentRound: number;
  matches: ArenaMatch[];
};

type PulseStatus = {
  nextPulseAtUtc: string | null;
  voteLocksAtUtc: string | null;
  isPulseLocked: boolean;
};

type Segment = 'voting' | 'upcoming' | 'results';

type MatchVoteSnapshot = {
  votes_a: number;
  votes_b: number;
  total_votes: number;
  percent_a: number;
  percent_b: number;
};

function catImg(c: ArenaCat) {
  return thumbUrlForCat(c.id);
}

function isBye(m: ArenaMatch) {
  return m.cat_a.id === m.cat_b.id;
}

function rarityColor(r: string) {
  return ({
    Common: 'text-zinc-300',
    Rare: 'text-blue-300',
    Epic: 'text-purple-300',
    Legendary: 'text-amber-300',
    Mythic: 'text-rose-300',
    'God-Tier': 'text-pink-300',
  } as Record<string, string>)[r] || 'text-zinc-300';
}

function rarityTier(r: string) {
  const key = String(r || '').toLowerCase();
  if (key === 'rare') return 'rare';
  if (key === 'epic') return 'epic';
  if (key === 'legendary') return 'legendary';
  if (key === 'mythic') return 'mythic';
  return 'common';
}

function rarityRank(r: string) {
  const tier = rarityTier(r);
  if (tier === 'mythic') return 4;
  if (tier === 'legendary') return 3;
  if (tier === 'epic') return 2;
  if (tier === 'rare') return 1;
  return 0;
}

function statPower(c: ArenaCat): number {
  const s = c.stats || { attack: 0, defense: 0, speed: 0, charisma: 0, chaos: 0 };
  const rarityBoost = c.rarity === 'Mythic' ? 1.1 : c.rarity === 'Legendary' ? 1.08 : c.rarity === 'Epic' ? 1.05 : c.rarity === 'Rare' ? 1.03 : 1;
  return (s.attack * 1.25 + s.defense * 1.15 + s.speed * 1.2 + s.charisma * 0.9 + s.chaos * 1.1) * rarityBoost;
}

function formatPulseTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const sameYear = now.getFullYear() === date.getFullYear();
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date);
}

function pulseBoundaryMs(value?: string | null) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function spotlightEmptyCopy(segment: Segment) {
  if (segment === 'voting') return { title: 'No votable matchups right now.', subtitle: 'Current-round voting is either locked or waiting on the next bracket update.' };
  if (segment === 'upcoming') return { title: 'No upcoming matchups queued.', subtitle: 'Future rounds will stack here once the bracket advances.' };
  return { title: 'No completed matchups yet.', subtitle: 'Results will appear here after the first tournament battle closes.' };
}

function calcSnapshot(votesA: number, votesB: number): MatchVoteSnapshot {
  const total = Math.max(0, Number(votesA || 0) + Number(votesB || 0));
  const percentA = total > 0 ? Math.round((Number(votesA || 0) / total) * 100) : 50;
  return {
    votes_a: Number(votesA || 0),
    votes_b: Number(votesB || 0),
    total_votes: total,
    percent_a: percentA,
    percent_b: Math.max(0, 100 - percentA),
  };
}

function applySnapshotToArenas(arenas: Arena[], matchId: string, snapshot: MatchVoteSnapshot): Arena[] {
  return arenas.map((arena) => ({
    ...arena,
    rounds: (arena.rounds || []).map((round) => ({
      ...round,
      matches: (round.matches || []).map((match) => (
        match.match_id === matchId
          ? {
              ...match,
              votes_a: snapshot.votes_a,
              votes_b: snapshot.votes_b,
              total_votes: snapshot.total_votes,
              percent_a: snapshot.percent_a,
              percent_b: snapshot.percent_b,
            }
          : match
      )),
    })),
  }));
}

function clampRoundNumber(round: number | null | undefined, min: number, max: number) {
  const raw = Number(round || 0);
  if (!Number.isFinite(raw) || raw <= 0) return min;
  return Math.min(Math.max(raw, min), Math.max(min, max));
}

function TournamentBracket({
  arena,
  votedMatches,
  pulseLocked,
}: {
  arena: Arena | null;
  votedMatches: Record<string, string>;
  pulseLocked: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [overviewData, setOverviewData] = useState<BracketOverviewPayload | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      const tournamentId = String(arena?.tournament_id || '').trim();
      if (!tournamentId) {
        if (!cancelled) setOverviewData(null);
        return;
      }
      try {
        const res = await fetch(`/api/tournament/${tournamentId}/bracket`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && data?.ok) {
          setOverviewData({
            tournament: data.tournament || null,
            matches: Array.isArray(data.matches) ? data.matches : [],
          });
        }
      } catch {
        if (!cancelled) setOverviewData(null);
      }
    }

    void loadOverview();
    return () => {
      cancelled = true;
    };
  }, [arena?.tournament_id]);

  if (!arena || !Array.isArray(arena.rounds) || arena.rounds.length === 0) {
    return (
      <section className="rounded-[1.8rem] border border-white/[0.06] bg-white/[0.025] p-4 shadow-[0_16px_36px_rgba(0,0,0,0.22)]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/60">Bracket</p>
          <h3 className="mt-1 text-lg font-semibold text-white">Tournament Bracket</h3>
        </div>
        <p className="mt-3 text-sm text-white/55">Bracket data appears once the current tournament round is seeded.</p>
      </section>
    );
  }

  const bracketMatches = overviewData?.matches || [];
  const roundCount = overviewData ? new Set(bracketMatches.map((match) => Number(match.round || 1))).size : 0;
  const currentRoundNumber = overviewData?.tournament
    ? clampRoundNumber(Number(overviewData.tournament.round || 1), 1, Math.max(1, roundCount || 1))
    : null;
  const currentRound = bracketMatches.filter((match) => Number(match.round || 1) === currentRoundNumber);
  const overviewStates = useMemo(() => {
    if (!overviewData || currentRoundNumber === null) return [];
    return bracketMatches.map((match) => deriveTournamentMatchState({
      matchId: match.match_id,
      status: match.status,
      round: match.round,
      currentRound: currentRoundNumber,
      voted: !!votedMatches[match.match_id],
      pulseLocked,
      spotlightMatchId: null,
    }));
  }, [overviewData, currentRoundNumber, bracketMatches, votedMatches, pulseLocked]);
  const overviewStateById = useMemo(() => {
    return new Map(overviewStates.map((state) => [state.matchId, state]));
  }, [overviewStates]);
  const playableSummary = useMemo(() => summarizeTournamentPlayable(overviewStates), [overviewStates]);
  const quietResolvedCount = overviewStates.length > 0 ? overviewStates.filter((state) => state.isResolved).length : null;
  const featured = overviewData ? currentRound[0] || null : null;
  const currentRoundPairs = currentRound.slice(0, 3);
  const currentRoundLabel = currentRoundNumber !== null && currentRoundNumber > 0
    ? currentRoundNumber === roundCount
      ? 'Final'
      : `Round ${currentRoundNumber}`
    : '—';

  return (
    <section className="rounded-[1.8rem] border border-white/[0.06] bg-white/[0.025] p-4 shadow-[0_16px_36px_rgba(0,0,0,0.22)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/60">Bracket</p>
          <h3 className="mt-1 text-lg font-semibold text-white">Bracket Overview</h3>
          <p className="mt-1 text-xs text-white/55">
            {isExpanded ? 'Keep voting in the spotlight or open the full bracket map.' : 'Quick tournament snapshot.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/tournament/bracket"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.045] px-4 text-sm font-semibold text-white/88 transition hover:bg-white/[0.08]"
          >
            View Full Bracket
          </Link>
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? 'Collapse bracket overview' : 'Expand bracket overview'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.045] text-white/72 transition hover:bg-white/[0.08]"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/[0.05] bg-black/20 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Voted Matches</p>
            <p className="mt-1 text-lg font-semibold text-white">{playableSummary.votedCount}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.05] bg-black/20 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Open Matchups</p>
            <p className="mt-1 text-lg font-semibold text-white">{playableSummary.openCount}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.05] bg-black/20 px-4 py-3 sm:min-w-[220px]">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Current Round</p>
          <p className="mt-1 text-sm font-semibold text-white">{currentRoundLabel}</p>
          {overviewData?.tournament?.champion ? <p className="mt-1 text-xs text-amber-200/80">Champion: {overviewData.tournament.champion.name}</p> : null}
        </div>
      </div>
      {quietResolvedCount !== null ? (
        <p className="mt-2 text-[11px] text-white/45">
          {playableSummary.lockedRemainingCount > 0 ? `Locked right now: ${playableSummary.lockedRemainingCount} · ` : ''}
          Resolved this tournament: {quietResolvedCount}
        </p>
      ) : null}

      {isExpanded ? (
        <>
          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="rounded-2xl border border-white/[0.05] bg-black/20 px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Bracket Path</p>
                <p className="text-[10px] text-white/42">{roundCount} rounds</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {Array.from({ length: roundCount }, (_, index) => index + 1).map((round) => (
                  <div key={`overview-round-${round}`} className="flex min-w-[84px] flex-1 items-center gap-2">
                    <span
                      className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-[10px] font-semibold ${
                        currentRoundNumber !== null && round === currentRoundNumber
                          ? 'border-cyan-300/18 bg-cyan-500/10 text-cyan-100'
                          : currentRoundNumber !== null && round < currentRoundNumber
                            ? 'border-emerald-300/14 bg-emerald-500/10 text-emerald-100/80'
                            : 'border-white/[0.06] bg-white/[0.035] text-white/58'
                      }`}
                    >
                      R{round}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="h-1.5 overflow-hidden rounded-full border border-white/[0.05] bg-white/[0.05]">
                        <div
                          className={`h-full rounded-full ${currentRoundNumber !== null && round < currentRoundNumber ? 'bg-emerald-300/80' : currentRoundNumber !== null && round === currentRoundNumber ? 'bg-cyan-300/80' : 'bg-white/[0.12]'}`}
                          style={{ width: currentRoundNumber !== null && round < currentRoundNumber ? '100%' : currentRoundNumber !== null && round === currentRoundNumber ? '58%' : '22%' }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.05] bg-black/20 px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Current Lane</p>
                <p className="text-[10px] text-white/42">{currentRoundPairs.length || 0} visible</p>
              </div>
              <div className="mt-2 space-y-2">
                {currentRoundPairs.map((match) => (
                  <div key={`overview-node-${match.match_id}`} className="rounded-xl border border-white/[0.05] bg-white/[0.025] px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2 text-[10px] text-white/42">
                      <span>{overviewStateById.get(match.match_id)?.label || 'Locked'}</span>
                      <span>{(match.votes_a || 0) + (match.votes_b || 0)} votes</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      {[match.cat_a, match.cat_b].map((cat, idx) => (
                        <div key={cat.id} className="flex min-w-0 flex-1 items-center gap-2">
                          <div className="h-7 w-7 overflow-hidden rounded-lg border border-white/[0.05] bg-black/30">
                            <img
                              src={cat.image_url || '/cat-placeholder.svg'}
                              alt={cat.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                              decoding="async"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = '/cat-placeholder.svg';
                              }}
                            />
                          </div>
                          <span className={`truncate text-[11px] font-medium ${idx === 0 ? 'text-white/86' : 'text-white/72'}`}>{cat.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {featured ? (
            <div className="mt-3 rounded-2xl border border-white/[0.05] bg-black/20 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Featured pairing</p>
              <div className="mt-2 flex items-center justify-between gap-3 text-sm text-white/82">
                <span className="truncate">{featured.cat_a.name}</span>
                <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-white/38">VS</span>
                <span className="truncate text-right">{featured.cat_b.name}</span>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function findArenaMatch(arenas: Arena[], matchId: string) {
  return arenas
    .flatMap((arena) => arena.rounds || [])
    .flatMap((round) => round.matches || [])
    .find((match) => match.match_id === matchId) || null;
}

function advanceSpotlightIndex(activeList: ArenaMatch[], activeIndex: number, matchId: string) {
  if (activeList.length <= 1) return 0;
  const currentIdx = Math.max(0, activeList.findIndex((match) => match.match_id === matchId));
  const nextIdx = currentIdx >= 0 ? currentIdx : activeIndex;
  return Math.min(nextIdx, Math.max(0, activeList.length - 2));
}

function nextArenasFromLoad(data: any) {
  const arenas = Array.isArray(data?.arenas) ? (data.arenas as Arena[]) : [];
  return arenas;
}

type LoadOptions = {
  silent?: boolean;
  preserveVotedMatches?: Record<string, string> | null;
};

function SpotlightMatchCard({
  match,
  mode,
  pulseResumeAt,
  voted,
  isVoting,
  predictBusy,
  availableSigils,
  activeIndex,
  total,
  onVote,
  onPredict,
  onPrev,
  onNext,
}: {
  match: ArenaMatch;
  mode: Segment;
  pulseResumeAt?: string | null;
  voted: string | null;
  isVoting: boolean;
  predictBusy: boolean;
  availableSigils: number;
  activeIndex: number;
  total: number;
  onVote: (matchId: string, catId: string) => void;
  onPredict: (matchId: string, catId: string, bet: number) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const done = match.status === 'complete' || mode === 'results';
  const hasVoted = !!voted;
  const predictedCatId = match.user_prediction?.predicted_cat_id || null;
  const [bet, setBet] = useState(10);
  const [flippedSides, setFlippedSides] = useState<{ a: boolean; b: boolean }>({ a: false, b: false });
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const lastTapRef = useRef<{ a: number; b: number }>({ a: 0, b: 0 });

  const aPower = statPower(match.cat_a);
  const bPower = statPower(match.cat_b);
  const strongerA = aPower >= bPower;
  const edgePct = Math.min(35, Math.round((Math.abs(aPower - bPower) / Math.max(1, Math.max(aPower, bPower))) * 100));
  const snapshot = calcSnapshot(match.votes_a, match.votes_b);
  const pctA = snapshot.percent_a;
  const pctB = snapshot.percent_b;
  const tierA = rarityTier(match.cat_a.rarity);
  const tierB = rarityTier(match.cat_b.rarity);
  const reopenAtMs = pulseBoundaryMs(pulseResumeAt || match.resolves_at || match.vote_locks_at);
  const lockExpired = reopenAtMs !== null && Date.now() >= reopenAtMs;
  const votingLocked = mode === 'voting' && !lockExpired && Boolean(match.voting_locked);
  const canVote = mode === 'voting' && !done && !votingLocked && !hasVoted && !isVoting;
  const canPredict = mode === 'voting' && !done && !votingLocked;
  const lockCopy = lockExpired ? null : formatPulseTime(pulseResumeAt || match.resolves_at || match.vote_locks_at);
  const roundStatus = done
    ? match.winner_id
      ? `Winner: ${match.winner_id === match.cat_a.id ? match.cat_a.name : match.cat_b.name}`
      : 'Match closed'
    : votingLocked
      ? lockCopy
        ? `Voting reopens ${lockCopy}`
        : 'Voting locked for this pulse'
    : match.is_close_match
      ? 'Tight matchup'
      : 'Voting open';

  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)');
    const sync = () => setIsSmallScreen(media.matches);
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);

  useEffect(() => {
    setFlippedSides({ a: false, b: false });
    setBet(10);
  }, [match.match_id]);

  const aStatEdge = {
    label: edgePct <= 3 ? 'Stat edge: balanced' : `Stat edge: ${strongerA ? 'favored' : 'underdog'} +${edgePct}%`,
    tone: edgePct <= 3 ? 'neutral' as const : strongerA ? 'a' as const : 'neutral' as const,
  };

  const bStatEdge = {
    label: edgePct <= 3 ? 'Stat edge: balanced' : `Stat edge: ${strongerA ? 'underdog' : 'favored'} +${edgePct}%`,
    tone: edgePct <= 3 ? 'neutral' as const : strongerA ? 'neutral' as const : 'b' as const,
  };
  const edgeTone = edgePct <= 3 ? 'neutral' : strongerA ? 'a' : 'b';

  function toggleFlip(side: 'a' | 'b') {
    setFlippedSides((prev) => ({ ...prev, [side]: !prev[side] }));
  }

  function handleCardTouch(side: 'a' | 'b') {
    const now = Date.now();
    if (now - lastTapRef.current[side] < 280) {
      toggleFlip(side);
      lastTapRef.current[side] = 0;
      return;
    }
    lastTapRef.current[side] = now;
  }

  function renderActionStack(cat: ArenaCat, side: 'a' | 'b') {
    const votedForThisSide = voted === cat.id;
    const predictedForThisSide = predictedCatId === cat.id;
    const canPredictThisSide = canPredict && !predictedCatId && !predictBusy && bet <= availableSigils;
    return (
      <div className="mt-2 space-y-2">
        <button
          type="button"
          onClick={() => onVote(match.match_id, cat.id)}
          aria-label={`Vote for ${cat.name}`}
          disabled={!canVote}
          data-side={side}
          data-active={votedForThisSide ? 'true' : 'false'}
          className="tournament-vote-btn tournament-side-btn arena-vote-btn inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border text-[12px] font-semibold touch-manipulation disabled:opacity-50 active:scale-[0.97]"
        >
          <span className="tournament-side-dot inline-block h-1.5 w-1.5 rounded-full" />
          {isVoting && !voted ? 'Submitting…' : votedForThisSide ? `Voted ${side.toUpperCase()}` : canVote ? `Vote ${side.toUpperCase()}` : done ? 'Closed' : 'Locked'}
        </button>

        <button
          type="button"
          disabled={!canPredictThisSide}
          onClick={() => onPredict(match.match_id, cat.id, bet)}
          data-side={side}
          data-active={predictedForThisSide ? 'true' : 'false'}
          className="tournament-predict-btn tournament-side-btn inline-flex h-10 w-full items-center justify-center gap-1 rounded-xl border text-xs font-semibold disabled:opacity-40 active:scale-[0.97]"
        >
          {predictedForThisSide ? `Predicted ${side.toUpperCase()}` : `Predict ${side.toUpperCase()}`}
          <span className="tournament-side-meta inline-flex items-center gap-0.5 text-[10px]">
            +<SigilIcon className="h-3 w-3" />{bet}
          </span>
        </button>
      </div>
    );
  }

  function renderFront(cat: ArenaCat, side: 'a' | 'b') {
    const tier = side === 'a' ? tierA : tierB;
    const isLiveSide = flippedSides[side];
    const role = side === 'a' ? 'Challenger' : 'Defender';
    const votedForThisSide = voted === cat.id;
    const votedLabel =
      done && match.winner_id === cat.id
        ? 'Winner'
        : votedForThisSide
          ? `Voted ${side.toUpperCase()}`
          : canVote
            ? `Vote ${side.toUpperCase()}`
            : done
              ? 'Closed'
              : 'Waiting';
    const frameTone =
      side === 'a'
        ? 'from-blue-500/18 via-cyan-400/10 to-transparent'
        : 'from-rose-500/18 via-orange-400/10 to-transparent';

    return (
      <div
        onDoubleClick={() => toggleFlip(side)}
        onTouchEnd={() => handleCardTouch(side)}
        className={`tournament-fighter-card arena-flip-face arena-flip-front arena-fighter-pane arena-duel-card tier-${tier} relative rounded-[1.4rem] border border-white/7 bg-gradient-to-br ${frameTone} p-2 shadow-[0_18px_40px_rgba(0,0,0,0.32)]`}
      >
        <div className="pointer-events-none absolute inset-x-6 top-0 h-16 rounded-full bg-white/10 blur-3xl opacity-40" />
        <div className="relative z-[1] flex items-center justify-between gap-2">
          <span className={`rarity-badge rarity-badge--${tier} inline-flex rounded-full border px-2 py-1 text-[9px] font-semibold tracking-[0.08em] uppercase`}>
            {cat.rarity}
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/42">Double tap</span>
        </div>

        <div className="tournament-image-shell mt-2 rounded-[1.15rem] border border-white/7 bg-black/30 p-1">
          <div className={`tournament-image-frame arena-card-image arena-card-image--${tier} aspect-[16/10] w-full overflow-hidden rounded-[1rem] border border-white/7`}>
            <div className={`arena-card-shimmer arena-card-shimmer--${tier}`} />
            <img
              src={catImg(cat)}
              alt={cat.name}
              loading="lazy"
              decoding="async"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/cat-placeholder.svg';
              }}
              className="arena-card-photo h-full w-full object-cover"
            />
          </div>
        </div>

        <div className="relative z-[1] mt-2 min-w-0">
          <p className="truncate text-[15px] font-semibold text-white">{cat.name}</p>
          <p className={`mt-0.5 truncate text-[10px] uppercase tracking-[0.14em] ${rarityColor(cat.rarity)}`}>{role}</p>
        </div>

        <div data-side={side} className="tournament-subpanel tournament-subpanel--side relative z-[1] mt-2 flex items-center justify-between gap-2 rounded-xl border border-white/7 bg-black/24 px-3 py-2 text-[10px] text-white/72">
          <span>{side === 'a' ? pctA : pctB}% vote share</span>
          <span className={`${votedForThisSide ? 'text-white' : 'text-white/54'}`}>{votedLabel}</span>
        </div>

        {renderActionStack(cat, side)}

        {isLiveSide && isSmallScreen ? null : (
          <div className="pointer-events-none absolute inset-x-4 bottom-4 h-10 rounded-full bg-white/5 blur-2xl opacity-70" />
        )}
      </div>
    );
  }

  function renderBack(cat: ArenaCat, side: 'a' | 'b') {
    return (
      <div onDoubleClick={() => toggleFlip(side)} onTouchEnd={() => handleCardTouch(side)}>
        <CatCardBack
          cat={cat}
          role={side === 'a' ? 'Challenger' : 'Defender'}
          votes={Number(side === 'a' ? match.votes_a || 0 : match.votes_b || 0)}
          sharePct={side === 'a' ? pctA : pctB}
          statEdge={side === 'a' ? aStatEdge : bStatEdge}
          stacked={isSmallScreen}
          className={isSmallScreen ? 'min-h-[336px]' : ''}
          onClose={() => toggleFlip(side)}
        />
      </div>
    );
  }

  return (
    <div key={match.match_id} data-tier-a={tierA} data-tier-b={tierB} className="tournament-stage-shell relative overflow-hidden rounded-[2rem] border border-white/7 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.14),_transparent_32%),linear-gradient(180deg,rgba(12,16,26,0.94),rgba(6,8,14,0.98))] p-3 shadow-[0_24px_58px_rgba(0,0,0,0.42)] sm:p-4">
      <div className="pointer-events-none absolute inset-x-10 top-0 h-24 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-4 h-24 w-24 rounded-full bg-amber-400/10 blur-3xl" />

      <div className="tournament-stage-meta relative z-[1] flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/70">
            {mode === 'voting' ? 'Spotlight Match' : mode === 'upcoming' ? 'Up Next' : 'Finished Battle'}
          </p>
          <p className="mt-1 text-sm font-semibold text-white">{roundStatus}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Queue</p>
          <p className="mt-1 text-sm font-semibold text-white">{Math.min(total, activeIndex + 1)} / {Math.max(1, total)}</p>
        </div>
      </div>

      <div className="relative z-[1] mt-3 grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_36px_minmax(0,1fr)] sm:gap-4">
        <div className="min-w-0">
          <div className="arena-flip-scene min-h-[0]">
            <div className={`arena-flip-card ${!isSmallScreen && flippedSides.a ? 'is-flipped-desktop' : ''}`}>
              {flippedSides.a && isSmallScreen ? renderBack(match.cat_a, 'a') : renderFront(match.cat_a, 'a')}
              {!isSmallScreen ? renderBack(match.cat_a, 'a') : null}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center py-1 sm:pt-14">
          <div className="tournament-vs-pill rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1 text-[10px] font-semibold tracking-[0.16em] text-white/60">
            VS
          </div>
        </div>

        <div className="min-w-0">
          <div className="arena-flip-scene min-h-[0]">
            <div className={`arena-flip-card ${!isSmallScreen && flippedSides.b ? 'is-flipped-desktop' : ''}`}>
              {flippedSides.b && isSmallScreen ? renderBack(match.cat_b, 'b') : renderFront(match.cat_b, 'b')}
              {!isSmallScreen ? renderBack(match.cat_b, 'b') : null}
            </div>
          </div>
        </div>
      </div>

      <div className="tournament-helper-row relative z-[1] mt-3 flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-[10px] text-white/58">
        <span>
          {votingLocked
            ? (lockCopy ? `Voting is paused while this pulse resolves. It reopens ${lockCopy}.` : 'Voting is paused while this pulse resolves.')
            : 'Double tap either card to flip and inspect rarity, skill, and stat edge.'}
        </span>
        <span className="text-white/36">{votingLocked ? 'Watch the split. Results resolve soon.' : `Prediction bet: ${bet} sigils`}</span>
      </div>

      <div className="relative z-[1] mt-3 flex items-center justify-between text-[10px] text-white/68">
        <span data-tone={edgeTone} className="tournament-balance-chip inline-flex rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1">
          {edgePct <= 3 ? 'Balanced matchup' : `${strongerA ? match.cat_a.name : match.cat_b.name} has the stat edge`}
        </span>
        <span className="tabular-nums text-white/50">{pctA}% · {pctB}% · {Number(match.total_votes ?? (match.votes_a + match.votes_b))} votes</span>
      </div>

      <div className="tournament-share-bar relative z-[1] mt-1.5 h-1.5 overflow-hidden rounded-full border border-white/[0.06] bg-white/8">
        <div className="tournament-share-segment tournament-share-segment--a absolute left-0 top-0 h-full transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, pctA))}%` }} />
        <div className="tournament-share-segment tournament-share-segment--b absolute right-0 top-0 h-full transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, pctB))}%` }} />
        <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/30" />
      </div>

      <div className="tournament-predict-panel relative z-[1] mt-3 rounded-2xl border border-white/[0.06] bg-black/[0.2] p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/42">Prediction Bet</p>
            <p className="mt-1 text-xs text-white/56">
              {predictedCatId
                ? 'Prediction locked for this battle.'
                : votingLocked
                  ? (lockCopy ? `Predictions reopen ${lockCopy}.` : 'Predictions reopen when the next live window starts.')
                  : canPredict
                    ? 'Pick a sigil amount, then predict from either fighter card.'
                    : 'Predictions reopen when the next live matchup appears.'}
            </p>
          </div>
          {(predictedCatId || match.user_prediction) ? (
            <span className="tournament-lock-chip inline-flex items-center gap-1 rounded-full border border-cyan-300/22 bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-100">
              Locked +<SigilIcon className="h-3 w-3" />{match.user_prediction?.bet_sigils || bet}
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {[5, 10, 15, 20].map((chip) => (
            <button
              type="button"
              key={`${match.match_id}-${chip}`}
              disabled={!canPredict || chip > availableSigils || !!predictedCatId}
              onClick={() => setBet(chip)}
              className={`tournament-chip-btn h-9 rounded-full border px-3 text-xs font-semibold ${bet === chip ? 'border-amber-300/35 text-amber-200 bg-amber-500/14' : 'border-white/10 text-white/70 bg-white/[0.04]'} disabled:opacity-40 active:scale-[0.97]`}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      <div className="tournament-queue-row relative z-[1] mt-3 flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
        <button
          type="button"
          onClick={onPrev}
          disabled={activeIndex <= 0}
          className="tournament-queue-btn inline-flex h-10 items-center justify-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 text-xs font-semibold text-white/80 disabled:opacity-35 active:scale-[0.97]"
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </button>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Battle Queue</p>
          <p className="mt-1 text-xs text-white/62">{total > 1 ? `${total - activeIndex - 1} waiting after this` : 'Last battle in view'}</p>
        </div>
        <button
          type="button"
          onClick={onNext}
          disabled={activeIndex >= total - 1}
          className="tournament-queue-btn inline-flex h-10 items-center justify-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 text-xs font-semibold text-white/80 disabled:opacity-35 active:scale-[0.97]"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}


export default function TournamentPage() {
  const [loading, setLoading] = useState(true);
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [queueMatches, setQueueMatches] = useState<ArenaMatch[]>([]);
  const [bracketQueue, setBracketQueue] = useState<BracketQueuePayload | null>(null);
  const [votedMatches, setVotedMatches] = useState<Record<string, string>>({});
  const [votingMatch, setVotingMatch] = useState<string | null>(null);
  const [predictBusyMatch, setPredictBusyMatch] = useState<string | null>(null);

  const [pulseStatus, setPulseStatus] = useState<PulseStatus | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [sigils, setSigils] = useState(0);
  const [predictionStreak, setPredictionStreak] = useState(0);
  const [dashboard, setDashboard] = useState<HomeDashboardData | null>(null);
  const [segment, setSegment] = useState<Segment>('voting');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadPulseStatus() {
      try {
        const res = await fetch('/api/home/status', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && data?.ok) {
          setPulseStatus({
            nextPulseAtUtc: data.nextPulseAtUtc || null,
            voteLocksAtUtc: data.voteLocksAtUtc || null,
            isPulseLocked: !!data.isPulseLocked,
          });
        }
      } catch {
        if (!cancelled) setPulseStatus(null);
      }
    }
    void loadPulseStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const tickNow = () => {
      setNowTs(Date.now());
    };
    tickNow();
    const id = window.setInterval(tickNow, 1000);
    return () => window.clearInterval(id);
  }, []);

  async function load(options: LoadOptions = {}) {
    if (!options.silent) setLoading(true);
    try {
      const [res, me, home] = await Promise.all([
        fetch('/api/tournament/active', { cache: 'no-store' }),
        fetch('/api/me', { cache: 'no-store' }),
        fetch('/api/home/dashboard', { cache: 'no-store' }),
      ]);
      const data = await res.json().catch(() => ({}));
      const meData = await me.json().catch(() => ({}));
      const homeData = await home.json().catch(() => ({}));
      const activeArenas = nextArenasFromLoad(data);
      const activeTournamentId = String(activeArenas?.[0]?.tournament_id || '').trim();
      const bracketData = activeTournamentId
        ? await fetch(`/api/tournament/${activeTournamentId}/bracket`, { cache: 'no-store' })
            .then((r) => r.json().catch(() => ({})))
            .catch(() => ({}))
        : null;
      const bracketMatches = Array.isArray(bracketData?.matches) ? (bracketData.matches as Array<any>) : [];
      const mappedBracketMatches: ArenaMatch[] = bracketMatches
        .map((match) => {
          const catA = match?.cat_a;
          const catB = match?.cat_b;
          if (!catA?.id || !catB?.id) return null;
          const snapshot = calcSnapshot(Number(match?.votes_a || 0), Number(match?.votes_b || 0));
          return {
            match_id: String(match.match_id || ''),
            status: String(match.status || 'active'),
            votes_a: Number(match.votes_a || 0),
            votes_b: Number(match.votes_b || 0),
            total_votes: snapshot.total_votes,
            percent_a: snapshot.percent_a,
            percent_b: snapshot.percent_b,
            winner_id: match.winner_id ? String(match.winner_id) : null,
            is_close_match: Math.abs(Number(match.votes_a || 0) - Number(match.votes_b || 0)) <= 2,
            cat_a: {
              id: String(catA.id),
              name: String(catA.name || 'Unknown'),
              image_url: String(catA.image_url || '') || null,
              rarity: String(catA.rarity || 'Common'),
            },
            cat_b: {
              id: String(catB.id),
              name: String(catB.name || 'Unknown'),
              image_url: String(catB.image_url || '') || null,
              rarity: String(catB.rarity || 'Common'),
            },
          } as ArenaMatch;
        })
        .filter((match): match is ArenaMatch => !!match && !!match.match_id);

      const preservedVotes = options.preserveVotedMatches;
      setArenas(activeArenas);
      setQueueMatches(mappedBracketMatches);
      setBracketQueue(
        mappedBracketMatches.length > 0
          ? {
              currentRound: Math.max(1, Number(bracketData?.tournament?.round || 1)),
              matches: mappedBracketMatches,
            }
          : null
      );
      if (!preservedVotes) {
        setVotedMatches(data.voted_matches || {});
      }
      setSigils(meData?.data?.progress?.sigils || 0);
      setPredictionStreak(meData?.data?.prediction_streak || data?.prediction_meta?.current_streak || 0);
      if (home.ok && homeData?.ok) {
        setDashboard({
          highlights: homeData.highlights || [],
        });
      }
    } finally {
      if (!options.silent) setLoading(false);
    }
  }

  function applyMatchSnapshot(matchId: string, snapshot: MatchVoteSnapshot) {
    setArenas((prev) => applySnapshotToArenas(prev, matchId, snapshot));
    setQueueMatches((prev) => prev.map((match) => (
      match.match_id === matchId
        ? {
            ...match,
            votes_a: snapshot.votes_a,
            votes_b: snapshot.votes_b,
            total_votes: snapshot.total_votes,
            percent_a: snapshot.percent_a,
            percent_b: snapshot.percent_b,
          }
        : match
    )));
  }

  async function refreshPulseStatus() {
    try {
      const res = await fetch('/api/home/status', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setPulseStatus({
          nextPulseAtUtc: data.nextPulseAtUtc || null,
          voteLocksAtUtc: data.voteLocksAtUtc || null,
          isPulseLocked: !!data.isPulseLocked,
        });
      }
    } catch {}
  }

  async function handleVote(matchId: string, catId: string) {
    if (votingMatch || votedMatches[matchId]) return;
    const arenaMatch = findArenaMatch(arenas, matchId) || queueMatches.find((m) => m.match_id === matchId) || null;
    const originalSnapshot = arenaMatch
      ? calcSnapshot(arenaMatch.votes_a, arenaMatch.votes_b)
      : null;
    const optimisticSnapshot = arenaMatch
      ? calcSnapshot(
          arenaMatch.votes_a + (catId === arenaMatch.cat_a.id ? 1 : 0),
          arenaMatch.votes_b + (catId === arenaMatch.cat_b.id ? 1 : 0)
        )
      : null;
    setVotingMatch(matchId);
    if (optimisticSnapshot) applyMatchSnapshot(matchId, optimisticSnapshot);
    try {
      const r = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: matchId, voted_for: catId }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) {
        const msg = data?.error || 'Vote failed';
        if (originalSnapshot) applyMatchSnapshot(matchId, originalSnapshot);
        if (msg.toLowerCase().includes('locked')) {
          setVotedMatches((p) => {
            const next = { ...p };
            delete next[matchId];
            return next;
          });
          const lockCopy = formatPulseTime(pulseStatus?.nextPulseAtUtc || data?.resolves_at || data?.vote_locks_at);
          showGlobalToast(lockCopy ? `Voting reopens ${lockCopy}` : 'Voting is locked for this pulse', 2600);
          void load({ silent: true });
        } else if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('duplicate')) {
          void load({ silent: true });
        } else {
          setVotedMatches((p) => {
            const next = { ...p };
            delete next[matchId];
            return next;
          });
          void load({ silent: true });
          showGlobalToast(msg, 2200);
        }
      } else {
        const nextIndex = advanceSpotlightIndex(activeList, activeIndex, matchId);
        // Briefly hold the current card so the submit state is visible,
        // then advance smoothly after we commit the vote locally.
        await new Promise((resolve) => window.setTimeout(resolve, 160));
        setVotedMatches((prev) => ({ ...prev, [matchId]: catId }));
        setActiveIndex(nextIndex);
        showGlobalToast('Vote recorded', 2200);
      }
    } catch {
      if (originalSnapshot) applyMatchSnapshot(matchId, originalSnapshot);
      setVotedMatches((p) => {
        const next = { ...p };
        delete next[matchId];
        return next;
      });
      void load({ silent: true });
      showGlobalToast('Network error', 2200);
    }
    setVotingMatch(null);
  }

  async function handlePredict(matchId: string, catId: string, bet: number) {
    if (predictBusyMatch) return;
    setPredictBusyMatch(matchId);
    try {
      const r = await fetch('/api/match/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: matchId, predicted_cat_id: catId, bet }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data?.ok) {
        if (String(data?.error || '').toLowerCase().includes('locked')) {
          const lockCopy = formatPulseTime(pulseStatus?.nextPulseAtUtc || data?.resolves_at || data?.vote_locks_at);
          showGlobalToast(lockCopy ? `Predictions reopen ${lockCopy}` : 'Predictions are locked for this pulse', 2600);
          void load({ silent: true });
        } else {
          showGlobalToast(data?.error || 'Prediction failed', 2200);
        }
      } else {
        setSigils(data.sigils_after ?? sigils);
        setPredictionStreak(data.current_streak ?? predictionStreak);
        showGlobalToast(`Prediction locked (-${bet})`, 2200);
        void load({ silent: true });
      }
    } catch {
      showGlobalToast('Network error', 2200);
    } finally {
      setPredictBusyMatch(null);
    }
  }

  const primaryArena = useMemo(() => {
    const rookie = arenas.find((a) => a.type === 'rookie');
    return rookie || arenas[0] || null;
  }, [arenas]);

  const pulseResumeAtMs = pulseBoundaryMs(pulseStatus?.nextPulseAtUtc || null);
  const pulseBoundaryPassed = pulseResumeAtMs !== null && nowTs >= pulseResumeAtMs;
  const pulseLocked = false;
  const pulseResumeLabel = pulseBoundaryPassed ? null : formatPulseTime(pulseStatus?.nextPulseAtUtc || null);

  const arenaView = useMemo(() => {
    if (!primaryArena) {
      return {
        voting: [] as ArenaMatch[],
        upcoming: [] as ArenaMatch[],
        results: [] as ArenaMatch[],
        summary: {
          playableCount: 0,
          votedCount: 0,
          remainingCount: 0,
          openCount: 0,
          lockedRemainingCount: 0,
          allRemainingLocked: false,
        },
        votableMatchIds: [] as string[],
      };
    }
    const allMatches = primaryArena.rounds
      .flatMap((round) => (round.matches || []).map((match) => ({ match, round: round.round })))
      .filter(({ match }) => !isBye(match));
    const withState = allMatches.map(({ match, round }) => ({
      match,
      state: deriveTournamentMatchState({
        matchId: match.match_id,
        status: match.status,
        round: Number(round || primaryArena.current_round),
        currentRound: primaryArena.current_round,
        voted: !!votedMatches[match.match_id],
        pulseLocked,
        spotlightMatchId: null,
      }),
    }));
    const voting = withState.filter((entry) => entry.state.state === 'votable').map((entry) => entry.match);
    const upcoming = withState.filter((entry) => entry.state.state === 'locked').map((entry) => entry.match);
    const results = withState.filter((entry) => entry.state.state === 'resolved').map((entry) => entry.match);
    return {
      voting,
      upcoming,
      results,
      summary: summarizeTournamentPlayable(withState.map((entry) => entry.state)),
      votableMatchIds: withState.filter((entry) => entry.state.state === 'votable').map((entry) => entry.match.match_id),
    };
  }, [primaryArena, votedMatches, pulseLocked]);

  const spotlightQueueVoting = useMemo(() => {
    const sourceMatches = (bracketQueue?.matches || queueMatches || []);
    const sourceRound = Math.max(1, Number(bracketQueue?.currentRound || primaryArena?.current_round || 1));
    return sourceMatches.filter((match) => {
      const id = String(match?.match_id || '');
      if (!id || isBye(match)) return false;
      if (votedMatches[id]) return false;
      const roundFromArena = (primaryArena?.rounds || []).find((round) =>
        (round.matches || []).some((entry) => String(entry.match_id || '') === id)
      )?.round;
      const state = deriveTournamentMatchState({
        matchId: id,
        status: String(match?.status || ''),
        round: Number(roundFromArena || sourceRound || 1),
        currentRound: sourceRound,
        voted: false,
        pulseLocked,
        spotlightMatchId: null,
      });
      return state.state === 'votable';
    });
  }, [bracketQueue?.currentRound, bracketQueue?.matches, primaryArena?.current_round, primaryArena?.rounds, pulseLocked, queueMatches, votedMatches]);

  const availableSegments = useMemo(() => {
    const segments: Segment[] = ['voting'];
    if (arenaView.upcoming.length > 0) segments.push('upcoming');
    if (arenaView.results.length > 0) segments.push('results');
    return segments;
  }, [arenaView.upcoming.length, arenaView.results.length]);

  const activeList = segment === 'voting'
    ? (spotlightQueueVoting.length > 0 ? spotlightQueueVoting : arenaView.voting)
    : segment === 'upcoming'
      ? arenaView.upcoming
      : arenaView.results;
  const activeMatch = activeList[Math.min(activeIndex, Math.max(0, activeList.length - 1))] || null;
  const isEmptyVoting = segment === 'voting' && !activeMatch;
  const hasRemainingMatches = arenaView.summary.remainingCount > 0;
  const hasOpenMatches = arenaView.summary.openCount > 0;
  const allRemainingLocked = arenaView.summary.allRemainingLocked;

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (!primaryArena) return;

    const derivedVotableIds = arenaView.votableMatchIds;
    const renderedVotingCount = arenaView.voting.length;
    if (derivedVotableIds.length !== renderedVotingCount) {
      console.warn('[TOURNAMENT_STATE_MISMATCH]', {
        votableCount: derivedVotableIds.length,
        votableMatchIds: derivedVotableIds,
        renderedSpotlightCount: renderedVotingCount,
      });
      return;
    }

    console.debug('[TOURNAMENT_STATE_DEBUG]', {
      votableCount: derivedVotableIds.length,
      votableMatchIds: derivedVotableIds,
      renderedSpotlightCount: renderedVotingCount,
    });
  }, [primaryArena, arenaView.votableMatchIds, arenaView.voting.length]);

  useEffect(() => {
    setActiveIndex(0);
  }, [segment]);

  useEffect(() => {
    if (availableSegments.includes(segment)) return;
    setSegment('voting');
  }, [availableSegments, segment]);

  useEffect(() => {
    setActiveIndex((prev) => {
      if (activeList.length === 0) return 0;
      return Math.min(prev, activeList.length - 1);
    });
  }, [activeList.length]);

  useEffect(() => {
    const targetMs = pulseBoundaryMs(pulseStatus?.nextPulseAtUtc || null);
    if (targetMs === null) return;
    const delay = targetMs - Date.now();
    const refresh = () => {
      void refreshPulseStatus();
      void load({ silent: true });
    };
    if (delay <= 0) {
      refresh();
      return;
    }
    const timeoutId = window.setTimeout(refresh, Math.max(250, delay + 250));
    return () => window.clearTimeout(timeoutId);
  }, [pulseStatus?.nextPulseAtUtc]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08090d] text-white flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-white/50" />
      </div>
    );
  }

  const emptyCopy = spotlightEmptyCopy(segment);

  return (
    <div className="min-h-screen bg-[#08090d] px-4 pb-8 pt-4 sm:pt-5 text-white">
      <div className={`mx-auto max-w-3xl ${isEmptyVoting ? 'space-y-2.5' : 'space-y-3.5'}`}>
        <section className="tournament-spotlight-shell rounded-[2rem] border border-white/[0.06] bg-white/[0.025] p-3 shadow-[0_16px_36px_rgba(0,0,0,0.28)] sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/60">Tournament Spotlight</p>
              <h2 className="mt-1 text-lg font-semibold">{primaryArena?.type === 'rookie' ? 'Rookie Tournament' : 'Daily Tournament'}</h2>
            </div>
            <span className={`tournament-round-pill shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${primaryArena ? 'border-white/[0.08] bg-white/[0.05] text-white/80' : 'border-white/[0.05] bg-white/[0.03] text-white/40'}`}>
              {primaryArena ? `Round ${primaryArena.current_round}` : 'No active round'}
            </span>
          </div>

          <div className={`mb-3 grid gap-2 ${availableSegments.length === 1 ? 'grid-cols-1' : availableSegments.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {availableSegments.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setSegment(s)}
                className={`tournament-segment-btn h-10 rounded-full border px-2 text-[11px] font-semibold capitalize transition-colors ${segment === s ? 'border-white/[0.08] bg-white/[0.12] text-white shadow-[0_8px_20px_rgba(0,0,0,0.18)]' : 'border-transparent bg-white/[0.04] text-white/72 hover:bg-white/[0.07]'}`}
              >
                {s === 'voting' ? 'Voting Now' : s}
              </button>
            ))}
          </div>

          {activeMatch ? (
            <SpotlightMatchCard
              key={activeMatch.match_id}
              match={activeMatch}
              mode={segment}
              pulseResumeAt={pulseStatus?.nextPulseAtUtc || null}
              voted={votedMatches[activeMatch.match_id] || null}
              isVoting={votingMatch === activeMatch.match_id}
              predictBusy={predictBusyMatch === activeMatch.match_id}
              availableSigils={sigils}
              activeIndex={activeIndex}
              total={activeList.length}
              onVote={handleVote}
              onPredict={handlePredict}
              onPrev={() => setActiveIndex((prev) => Math.max(0, prev - 1))}
              onNext={() => setActiveIndex((prev) => Math.min(activeList.length - 1, prev + 1))}
            />
          ) : (
            <div className="tournament-empty-state rounded-[1.6rem] border border-white/[0.06] bg-white/[0.02] p-8 text-center">
              <Target className={`mx-auto mb-2 h-8 w-8 ${segment === 'voting' && pulseLocked ? 'text-amber-300/70' : 'text-white/40'}`} />
              <p className="text-sm font-semibold text-white/78">
                {segment === 'voting' && pulseLocked ? 'Voting Paused' : emptyCopy.title}
              </p>
              <p className="mt-1 text-xs text-white/48">
                {segment === 'voting' && pulseLocked
                  ? 'The current pulse is resolving. New featured matches unlock when the next pulse begins.'
                  : segment === 'voting'
                    ? !hasOpenMatches && hasRemainingMatches && allRemainingLocked
                      ? 'All remaining current-round matches are locked right now.'
                      : 'No open current-round matches are available right now.'
                    : emptyCopy.subtitle}
              </p>
              {segment === 'voting' && pulseResumeLabel ? (
                <p className="mt-3 text-xs text-white/58">Next voting window: {pulseResumeLabel}</p>
              ) : null}
              {segment === 'voting' ? (
                <Link
                  href="/tournament/bracket"
                  className="mt-4 inline-flex h-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.045] px-4 text-sm font-semibold text-white/88 transition hover:bg-white/[0.08]"
                >
                  View Bracket
                </Link>
              ) : null}
            </div>
          )}
        </section>

        <div className={isEmptyVoting ? 'opacity-90' : ''}>
          <TournamentBracket arena={primaryArena} votedMatches={votedMatches} pulseLocked={pulseLocked} />
        </div>

        <details className={`tournament-info-module rounded-2xl border border-white/[0.05] bg-white/[0.03] ${isEmptyVoting ? 'p-2.5 opacity-90' : 'p-3'}`}>
          <summary className="flex h-11 cursor-pointer items-center justify-between rounded-xl px-2 text-sm font-semibold">
            Tournament Highlights
            <ChevronRight className="h-4 w-4 text-white/50" />
          </summary>
          <div className="space-y-2 pt-2">
            {(dashboard?.highlights || []).slice(0, 8).map((h) => (
              <div key={h.id} className="tournament-detail-card rounded-xl bg-white/[0.03] p-2.5">
                <p className="text-sm font-medium">{h.title}</p>
                <p className="mt-0.5 text-xs text-white/60">{h.subtitle}</p>
              </div>
            ))}
            {!(dashboard?.highlights || []).length && <p className="px-1 text-xs text-white/55">No highlights yet. Battles are still warming up.</p>}
          </div>
        </details>

        <div className={`tournament-info-module rounded-2xl border border-white/[0.05] bg-[linear-gradient(135deg,rgba(109,40,217,0.08),rgba(56,189,248,0.04))] text-center shadow-[0_14px_32px_rgba(0,0,0,0.18)] ${isEmptyVoting ? 'p-2.5 opacity-90' : 'p-3'}`}>
          <div className="tournament-status-pill inline-flex items-center gap-1 rounded-full border border-violet-300/16 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-100/80">
            <Sparkles className="h-3.5 w-3.5" />
            Secondary Mode
          </div>
          <p className="mt-2 text-sm text-white/70">Want a deeper ranked climb after the bracket? Whisker Arena is still here as a separate beta ladder.</p>
          <Link href="/arena" className="tournament-secondary-link mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-violet-300/16 bg-violet-500/10 px-4 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/16">
            <Swords className="h-4 w-4" />
            Try Whisker Arena (Beta)
          </Link>
        </div>
      </div>
    </div>
  );
}
