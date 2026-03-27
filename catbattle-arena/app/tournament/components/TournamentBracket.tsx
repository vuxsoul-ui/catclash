'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, TouchEvent } from 'react';
import Link from 'next/link';
import { CheckCircle2, ChevronDown, ChevronLeft, Clock3, Sparkles, Target, Trophy, X } from 'lucide-react';
import { deriveTournamentMatchState, summarizeTournamentPlayable } from '../../lib/tournament-state';
import { LoadingState } from '../../components/LoadingState';

type BracketCat = {
  id: string;
  name: string;
  rarity: string;
  image_url: string | null;
};

type BracketMatch = {
  match_id: string;
  round: number;
  status: string;
  winner_id: string | null;
  votes_a: number;
  votes_b: number;
  total_votes: number;
  cat_a: BracketCat;
  cat_b: BracketCat;
};

type BracketTournament = {
  id: string;
  round: number;
  champion: BracketCat | null;
};

function rarityTier(rarity: string) {
  const key = String(rarity || '').toLowerCase();
  if (key === 'rare') return 'rare';
  if (key === 'epic') return 'epic';
  if (key === 'legendary') return 'legendary';
  if (key === 'mythic') return 'mythic';
  return 'common';
}

function calcSnapshot(votesA: number, votesB: number) {
  const total = Math.max(0, Number(votesA || 0) + Number(votesB || 0));
  const percentA = total > 0 ? Math.round((Number(votesA || 0) / total) * 100) : 50;
  return {
    total,
    percentA,
    percentB: Math.max(0, 100 - percentA),
  };
}

function roundLabel(round: number, totalRounds: number) {
  if (round === totalRounds) return 'Final';
  if (round === totalRounds - 1) return 'Semifinal';
  if (round === totalRounds - 2) return 'Quarterfinal';
  return `Round ${round}`;
}

function BracketShell({
  children,
  eyebrow = 'Bracket',
  title = 'Tournament Bracket',
  subtitle = 'Follow the tournament path, inspect matchups, and jump back to voting when the next spotlight is live.',
}: {
  children: ReactNode;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="tournament-bracket-page space-y-4">
      <section className="rounded-[1.8rem] border border-white/[0.06] bg-white/[0.025] p-4 shadow-[0_16px_36px_rgba(0,0,0,0.22)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/60">{eyebrow}</p>
            <h1 className="mt-1 text-xl font-semibold text-white">{title}</h1>
            <p className="mt-1 text-sm text-white/55">{subtitle}</p>
          </div>
          <Link
            href="/tournament"
            className="inline-flex h-10 items-center justify-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.045] px-4 text-sm font-semibold text-white/88 transition hover:bg-white/[0.08]"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Voting
          </Link>
        </div>
      </section>

      {children}
    </div>
  );
}

export default function TournamentBracket() {
  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<BracketTournament | null>(null);
  const [matches, setMatches] = useState<BracketMatch[]>([]);
  const [votedMatches, setVotedMatches] = useState<Record<string, string>>({});
  const [pulseLocked, setPulseLocked] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [votingMatchId, setVotingMatchId] = useState<string | null>(null);
  const [voteNotice, setVoteNotice] = useState<'a' | 'b' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedRounds, setExpandedRounds] = useState<Record<number, boolean>>({});
  const roundRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const initialFocusDone = useRef(false);
  const swipeStartY = useRef<number | null>(null);
  const [sheetOffset, setSheetOffset] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadBracket() {
      setLoading(true);
      setError(null);
      try {
        const activeRes = await fetch('/api/tournament/active', { cache: 'no-store' });
        if (!activeRes.ok) {
          throw new Error(`Failed to load active tournament (${activeRes.status})`);
        }
        const activeData = await activeRes.json().catch(() => ({}));
        const primaryArena = Array.isArray(activeData?.arenas) ? activeData.arenas[0] : null;
        const tournamentId = String(primaryArena?.tournament_id || '').trim();
        if (!tournamentId) {
          if (!cancelled) {
            setTournament(null);
            setMatches([]);
            setVotedMatches({});
          }
          return;
        }

        const bracketRes = await fetch(`/api/tournament/${tournamentId}/bracket`, { cache: 'no-store' });
        const bracketData = await bracketRes.json().catch(() => ({}));
        if (!bracketRes.ok || !bracketData?.ok) {
          throw new Error(bracketData?.error || 'Failed to load bracket');
        }

        if (!cancelled) {
          const nextMatches = Array.isArray(bracketData.matches) ? bracketData.matches : [];
          const nextTournament =
            bracketData?.tournament && typeof bracketData.tournament === 'object'
              ? (bracketData.tournament as BracketTournament)
              : null;
          const bracketRound = Number(bracketData.tournament?.round || activeData?.arenas?.[0]?.current_round || 1);
          const activeArena = Array.isArray(activeData?.arenas) ? activeData.arenas[0] : null;
          const activeRoundMatches = (activeArena?.rounds || []).find((round: { round: number; matches: BracketMatch[] }) => round.round === bracketRound)?.matches || [];
          const nextPulseLocked = activeRoundMatches.some((match: any) => !!match.voting_locked);
          const liveMatchId =
            nextMatches.find(
              (match: BracketMatch) =>
                match.round === bracketRound &&
                deriveTournamentMatchState({
                  matchId: match.match_id,
                  status: match.status,
                  round: match.round,
                  currentRound: bracketRound,
                  voted: false,
                  pulseLocked: nextPulseLocked,
                  spotlightMatchId: null,
                }).state === 'votable'
            )?.match_id ||
            null;

          setTournament(nextTournament?.id ? nextTournament : null);
          setMatches(nextMatches);
          setVotedMatches(activeData?.voted_matches || {});
          setPulseLocked(nextPulseLocked);
          setSelectedMatchId((prev) => prev || liveMatchId || nextMatches[0]?.match_id || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load bracket');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadBracket();
    return () => {
      cancelled = true;
    };
  }, []);

  const rounds = useMemo(() => {
    const grouped = new Map<number, BracketMatch[]>();
    for (const match of matches) {
      const existing = grouped.get(match.round) || [];
      existing.push(match);
      grouped.set(match.round, existing);
    }
    return Array.from(grouped.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([round, roundMatches]) => ({
        round,
        matches: roundMatches,
        groups: roundMatches.reduce<BracketMatch[][]>((acc, match, index) => {
          const bucket = Math.floor(index / 2);
          if (!acc[bucket]) acc[bucket] = [];
          acc[bucket].push(match);
          return acc;
        }, []),
      }));
  }, [matches]);

  const totalRounds = rounds.length;
  const currentRound = tournament
    ? Math.min(Math.max(Number(tournament.round || 1), 1), Math.max(1, totalRounds || 1))
    : 1;
  const currentSpotlightMatchId = matches.find((match) => deriveTournamentMatchState({
    matchId: match.match_id,
    status: match.status,
    round: match.round,
    currentRound,
    voted: !!votedMatches[match.match_id],
    pulseLocked,
    spotlightMatchId: null,
  }).state === 'votable')?.match_id || null;

  const derivedStates = useMemo(() => {
    return matches.map((match) => deriveTournamentMatchState({
      matchId: match.match_id,
      status: match.status,
      round: match.round,
      currentRound,
      voted: !!votedMatches[match.match_id],
      pulseLocked,
      spotlightMatchId: currentSpotlightMatchId,
    }));
  }, [matches, currentRound, votedMatches, currentSpotlightMatchId, pulseLocked]);
  const playableSummary = useMemo(() => summarizeTournamentPlayable(derivedStates), [derivedStates]);
  const resolvedCount = useMemo(() => derivedStates.filter((state) => state.isResolved).length, [derivedStates]);
  const selectedMatch =
    matches.find((match) => match.match_id === selectedMatchId) ||
    matches.find((match) => match.match_id === currentSpotlightMatchId) ||
    matches[0] ||
    null;

  const currentRoundMatches = rounds.find((entry) => entry.round === currentRound)?.matches || [];

  useEffect(() => {
    if (loading || initialFocusDone.current || rounds.length === 0) return;
    const targetRound = roundRefs.current[currentRound];
    if (targetRound) {
      targetRound.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
      initialFocusDone.current = true;
    }
  }, [loading, rounds, currentRound]);

  useEffect(() => {
    if (!matches.length) {
      if (selectedMatchId !== null) setSelectedMatchId(null);
      return;
    }
    const selectedStillExists = selectedMatchId ? matches.some((match) => match.match_id === selectedMatchId) : false;
    if (selectedStillExists) return;
    const fallbackMatchId = currentSpotlightMatchId || matches[0]?.match_id || null;
    if (fallbackMatchId && fallbackMatchId !== selectedMatchId) {
      setSelectedMatchId(fallbackMatchId);
    }
  }, [matches, selectedMatchId, currentSpotlightMatchId]);

  useEffect(() => {
    if (!rounds.length) return;
    setExpandedRounds((prev) => {
      const next: Record<number, boolean> = {};
      for (const roundData of rounds) {
        next[roundData.round] = prev[roundData.round] ?? (roundData.round === currentRound);
      }
      return next;
    });
  }, [rounds, currentRound]);

  useEffect(() => {
    if (!sheetOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [sheetOpen]);

  useEffect(() => {
    if (!sheetOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSheetOpen(false);
        setSheetOffset(0);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sheetOpen]);

  function updateMatchSnapshot(matchId: string, votesA: number, votesB: number) {
    setMatches((prev) =>
      prev.map((match) =>
        match.match_id === matchId
          ? {
              ...match,
              votes_a: votesA,
              votes_b: votesB,
              total_votes: Math.max(0, votesA + votesB),
            }
          : match
      )
    );
  }

  function selectMatch(matchId: string, scrollIntoView = false) {
    setSelectedMatchId(matchId);
    setSheetOpen(true);
    setSheetOffset(0);
    if (scrollIntoView) return;
  }

  function closeSheet() {
    setSheetOpen(false);
    setSheetOffset(0);
    setVoteNotice(null);
  }

  async function handleVote(matchId: string, catId: string) {
    if (votingMatchId || votedMatches[matchId]) return;
    const currentMatch = matches.find((match) => match.match_id === matchId);
    if (!currentMatch) return;

    const originalVotesA = Number(currentMatch.votes_a || 0);
    const originalVotesB = Number(currentMatch.votes_b || 0);
    const nextVotesA = originalVotesA + (catId === currentMatch.cat_a.id ? 1 : 0);
    const nextVotesB = originalVotesB + (catId === currentMatch.cat_b.id ? 1 : 0);

    setVotingMatchId(matchId);
    setVoteNotice(catId === currentMatch.cat_a.id ? 'a' : 'b');
    updateMatchSnapshot(matchId, nextVotesA, nextVotesB);
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(12);
    }

    try {
      const response = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: matchId, voted_for: catId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        updateMatchSnapshot(matchId, originalVotesA, originalVotesB);
        if (
          String(data?.error || '').toLowerCase().includes('already') ||
          String(data?.error || '').toLowerCase().includes('duplicate')
        ) {
          setVotedMatches((prev) => ({ ...prev, [matchId]: catId }));
        }
        setVoteNotice(null);
        return;
      }

      setVotedMatches((prev) => ({ ...prev, [matchId]: catId }));
      window.setTimeout(() => setVoteNotice(null), 1400);
    } catch {
      updateMatchSnapshot(matchId, originalVotesA, originalVotesB);
      setVoteNotice(null);
    } finally {
      setVotingMatchId(null);
    }
  }

  function handleSheetTouchStart(event: TouchEvent<HTMLElement>) {
    swipeStartY.current = event.touches[0]?.clientY ?? null;
  }

  function handleSheetTouchMove(event: TouchEvent<HTMLElement>) {
    if (swipeStartY.current == null) return;
    const nextOffset = Math.max(0, (event.touches[0]?.clientY ?? swipeStartY.current) - swipeStartY.current);
    setSheetOffset(nextOffset);
  }

  function handleSheetTouchEnd() {
    if (sheetOffset > 96) {
      closeSheet();
    } else {
      setSheetOffset(0);
    }
    swipeStartY.current = null;
  }

  function jumpToCurrentRound() {
    roundRefs.current[currentRound]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }

  function focusActiveMatch() {
    if (!currentSpotlightMatchId) return;
    selectMatch(currentSpotlightMatchId, false);
    const activeMatch = matches.find((match) => match.match_id === currentSpotlightMatchId);
    if (activeMatch) {
      setExpandedRounds((prev) => ({ ...prev, [activeMatch.round]: true }));
    }
  }

  if (loading) {
    return (
      <BracketShell subtitle="Loading the current tournament path and bracket summary.">
        <LoadingState
          message="Loading bracket..."
          icon="🗺️"
          className="rounded-[1.8rem] border border-white/[0.06] bg-white/[0.025] p-6 shadow-[0_16px_36px_rgba(0,0,0,0.22)]"
          phrases={[
            'Tracing the bracket path...',
            'Finding the live round...',
            'Marking the spotlight match...',
            'Locking in the arena...'
          ]}
        />
      </BracketShell>
    );
  }

  if (error) {
    return (
      <BracketShell subtitle="The bracket shell is loaded, but the tournament map could not be prepared.">
        <section className="rounded-[1.8rem] border border-white/[0.06] bg-white/[0.025] p-5 text-center shadow-[0_16px_36px_rgba(0,0,0,0.22)]">
          <p className="text-sm font-semibold text-white/80">Bracket unavailable</p>
          <p className="mt-1 text-sm text-white/55">{error}</p>
        </section>
      </BracketShell>
    );
  }

  if (!tournament || rounds.length === 0) {
    return (
      <BracketShell subtitle="There is no active seeded bracket to render right now, but the bracket route is available.">
        <section className="rounded-[1.8rem] border border-white/[0.06] bg-white/[0.025] p-5 text-center shadow-[0_16px_36px_rgba(0,0,0,0.22)]">
          <p className="text-sm font-semibold text-white/80">No bracket available yet.</p>
          <p className="mt-1 text-sm text-white/55">The next tournament bracket will appear here once matches are seeded.</p>
        </section>
      </BracketShell>
    );
  }

  return (
    <BracketShell title="Tournament Bracket" subtitle="Follow the path round by round, inspect any node, and jump back to the spotlight when you want to vote.">
      <section className="rounded-[1.8rem] border border-white/[0.06] bg-white/[0.025] p-4 shadow-[0_16px_36px_rgba(0,0,0,0.22)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/60">Overview</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Current Round Focus</h2>
            <p className="mt-1 text-sm text-white/55">Track progress and jump to the active lane quickly.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-cyan-300/12 bg-cyan-500/[0.08] px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.16em] text-cyan-100/60">Voted Matches</p>
              <p className="mt-1 text-lg font-semibold text-white">{playableSummary.votedCount}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/38">Open Matchups</p>
              <p className="mt-1 text-lg font-semibold text-white">{playableSummary.openCount}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={jumpToCurrentRound}
              className="inline-flex h-9 items-center justify-center gap-1 rounded-full border border-cyan-300/18 bg-cyan-500/10 px-3 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-500/16"
            >
              <Target className="h-3.5 w-3.5" />
              Jump to Current Round
            </button>
            {currentSpotlightMatchId ? (
              <button
                type="button"
                onClick={focusActiveMatch}
                className="inline-flex h-9 items-center justify-center gap-1 rounded-full border border-amber-300/16 bg-amber-500/10 px-3 text-[11px] font-semibold text-amber-100 transition hover:bg-amber-500/16"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Focus Active Match
              </button>
            ) : null}
          </div>
        </div>
        <p className="mt-2 text-[11px] text-white/45">
          {playableSummary.lockedRemainingCount > 0 ? `Locked right now: ${playableSummary.lockedRemainingCount} · ` : ''}
          Resolved this tournament: {resolvedCount}
        </p>

        <div className="mt-4 rounded-2xl border border-white/[0.06] bg-black/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/38">Tournament Progress</p>
              <p className="mt-1 text-sm font-semibold text-white">{roundLabel(currentRound, totalRounds)}</p>
            </div>
            {tournament.champion ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/18 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-100">
                <Trophy className="h-3.5 w-3.5" />
                {tournament.champion.name}
              </span>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {Array.from({ length: totalRounds }, (_, index) => index + 1).map((round) => (
              <div key={`progress-${round}`} className="flex min-w-[88px] flex-1 items-center gap-2">
                <span
                  className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-[10px] font-semibold ${
                    round === currentRound
                      ? 'border-cyan-300/18 bg-cyan-500/12 text-cyan-100'
                      : round < currentRound
                        ? 'border-emerald-300/14 bg-emerald-500/10 text-emerald-100/80'
                        : 'border-white/[0.06] bg-white/[0.04] text-white/58'
                  }`}
                >
                  R{round}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10px] uppercase tracking-[0.12em] text-white/38">{roundLabel(round, totalRounds)}</p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full border border-white/[0.05] bg-white/[0.05]">
                    <div
                      className={`h-full rounded-full ${
                        round < currentRound
                          ? 'bg-emerald-300/80'
                          : round === currentRound
                            ? 'bg-cyan-300/80'
                            : 'bg-white/[0.12]'
                      }`}
                      style={{ width: round < currentRound ? '100%' : round === currentRound ? '58%' : '22%' }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4">
        <section className="rounded-[1.8rem] border border-white/[0.06] bg-white/[0.025] p-4 shadow-[0_16px_36px_rgba(0,0,0,0.22)]">
          <div className="mb-3">
            <p className="text-sm font-semibold text-white">Bracket Progression</p>
            <p className="mt-1 text-xs text-white/55">
              Scan round by round, expand what you need, and tap any matchup to inspect the full details.
            </p>
          </div>

          <div className="space-y-3">
            {rounds.map((roundData) => {
              const isCurrent = roundData.round === currentRound;
              const isExpanded = expandedRounds[roundData.round] ?? isCurrent;
              return (
                <div
                  key={`round-${roundData.round}`}
                  ref={(node) => {
                    roundRefs.current[roundData.round] = node;
                  }}
                  className={`rounded-2xl border ${isCurrent ? 'border-cyan-300/16 bg-cyan-500/[0.04]' : 'border-white/[0.05] bg-black/20'}`}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedRounds((prev) => ({ ...prev, [roundData.round]: !isExpanded }))}
                    className="tournament-bracket-round-toggle flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                    aria-expanded={isExpanded}
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-white/38">{roundLabel(roundData.round, totalRounds)}</p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {isCurrent ? 'Current round' : roundData.round < currentRound ? 'Completed round' : 'Upcoming round'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-white/62">
                        {roundData.matches.length} matchups
                      </span>
                      <ChevronDown className={`h-4 w-4 text-white/58 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {isExpanded ? (
                    <div className="space-y-2 border-t border-white/[0.05] px-3 pb-3 pt-2">
                      {roundData.matches.map((match) => {
                        const snapshot = calcSnapshot(match.votes_a, match.votes_b);
                        const tierA = rarityTier(match.cat_a.rarity);
                        const tierB = rarityTier(match.cat_b.rarity);
                        const votedForThisMatch = !!votedMatches[match.match_id];
                        const state = deriveTournamentMatchState({
                          matchId: match.match_id,
                          status: match.status,
                          round: match.round,
                          currentRound,
                          voted: votedForThisMatch,
                          pulseLocked,
                          spotlightMatchId: currentSpotlightMatchId,
                        });
                        const selected = match.match_id === selectedMatchId;
                        const winnerA = match.winner_id === match.cat_a.id;
                        const winnerB = match.winner_id === match.cat_b.id;
                        return (
                          <button
                            type="button"
                            key={match.match_id}
                            onClick={() => selectMatch(match.match_id, false)}
                            data-tier-a={tierA}
                            data-tier-b={tierB}
                            data-state={state.state}
                            data-selected={selected ? 'true' : 'false'}
                            aria-pressed={selected}
                            className={`tournament-bracket-card tournament-bracket-node tournament-bracket-node--compact w-full rounded-[1.1rem] border px-3 py-3 text-left ${
                              state.state === 'votable'
                                ? 'is-active border-cyan-300/18 bg-cyan-500/[0.06]'
                                : state.state === 'voted'
                                  ? 'border-emerald-300/18 bg-emerald-500/[0.05]'
                                  : state.state === 'resolved'
                                    ? 'border-emerald-300/14 bg-emerald-500/[0.04]'
                                    : 'border-white/[0.06] bg-white/[0.02]'
                            } ${selected ? 'ring-1 ring-white/18' : ''}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                    state.state === 'votable'
                                      ? 'border-cyan-300/18 bg-cyan-500/12 text-cyan-100'
                                      : state.state === 'voted'
                                        ? 'border-emerald-300/18 bg-emerald-500/10 text-emerald-100'
                                        : state.state === 'resolved'
                                          ? 'border-emerald-300/16 bg-emerald-500/10 text-emerald-100/85'
                                          : 'border-white/[0.08] bg-black/20 text-white/55'
                                  }`}
                                >
                                  {state.label}
                                </span>
                                {state.isSpotlight ? (
                                  <span className="rounded-full border border-amber-300/16 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                                    Spotlight
                                  </span>
                                ) : null}
                              </div>
                              <span className="text-[10px] text-white/42">{snapshot.total} votes</span>
                            </div>

                            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                              <div className={`min-w-0 ${match.winner_id && !winnerA ? 'opacity-55' : ''}`}>
                                <p className={`truncate text-sm font-semibold ${winnerA ? 'text-white' : 'text-white/84'}`}>{match.cat_a.name}</p>
                              </div>
                              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/38">VS</div>
                              <div className={`min-w-0 text-right ${match.winner_id && !winnerB ? 'opacity-55' : ''}`}>
                                <p className={`truncate text-sm font-semibold ${winnerB ? 'text-white' : 'text-white/84'}`}>{match.cat_b.name}</p>
                              </div>
                            </div>

                            <div className="mt-2 flex items-center justify-between text-[10px] text-white/46">
                              <span>{snapshot.percentA}%</span>
                              <span>{snapshot.percentB}%</span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full border border-white/[0.06] bg-white/[0.06]">
                              <div className="flex h-full w-full">
                                <div className="tournament-bracket-segment tournament-bracket-segment--a" style={{ width: `${snapshot.percentA}%` }} />
                                <div className="tournament-bracket-segment tournament-bracket-segment--b" style={{ width: `${snapshot.percentB}%` }} />
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {selectedMatch && sheetOpen ? (
        <div className="tournament-bracket-sheet-backdrop" onClick={closeSheet} aria-hidden="true">
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`Match details for ${selectedMatch.cat_a.name} versus ${selectedMatch.cat_b.name}`}
            data-tier-a={rarityTier(selectedMatch.cat_a.rarity)}
            data-tier-b={rarityTier(selectedMatch.cat_b.rarity)}
            className="tournament-bracket-card tournament-bracket-detail tournament-bracket-sheet is-active"
            style={{ transform: `translateY(${sheetOffset}px)` }}
            onClick={(event) => event.stopPropagation()}
            onTouchStart={handleSheetTouchStart}
            onTouchMove={handleSheetTouchMove}
            onTouchEnd={handleSheetTouchEnd}
          >
            {(() => {
              const snapshot = calcSnapshot(selectedMatch.votes_a, selectedMatch.votes_b);
              const state = deriveTournamentMatchState({
                matchId: selectedMatch.match_id,
                status: selectedMatch.status,
                round: selectedMatch.round,
                currentRound,
                voted: !!votedMatches[selectedMatch.match_id],
                pulseLocked,
                spotlightMatchId: currentSpotlightMatchId,
              });
              const votedCatId = votedMatches[selectedMatch.match_id] || null;
              const canVote = state.state === 'votable' && !votedCatId && votingMatchId !== selectedMatch.match_id;
              return (
                <>
                  <div className="tournament-bracket-sheet-handle-wrap">
                    <div className="tournament-bracket-sheet-handle" />
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/60">Selected Match</p>
                      <h2 className="mt-1 text-lg font-semibold text-white">
                        {selectedMatch.cat_a.name} vs {selectedMatch.cat_b.name}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={closeSheet}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-black/20 text-white/74 transition hover:bg-white/[0.06]"
                      aria-label="Close selected match"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 rounded-2xl border border-white/[0.06] bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/42">Vote Split</p>
                      <span className="text-[11px] text-white/52">{snapshot.total} total votes</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-white/52">
                      <span>{snapshot.percentA}%</span>
                      <span>{snapshot.percentB}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full border border-white/[0.06] bg-white/[0.05]">
                      <div className="flex h-full w-full">
                        <div className="tournament-bracket-segment tournament-bracket-segment--a transition-[width] duration-300" style={{ width: `${snapshot.percentA}%` }} />
                        <div className="tournament-bracket-segment tournament-bracket-segment--b transition-[width] duration-300" style={{ width: `${snapshot.percentB}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                        state.state === 'votable'
                          ? 'border-cyan-300/18 bg-cyan-500/12 text-cyan-100'
                          : state.state === 'voted'
                            ? 'border-emerald-300/18 bg-emerald-500/10 text-emerald-100'
                            : state.state === 'resolved'
                              ? 'border-emerald-300/16 bg-emerald-500/10 text-emerald-100/85'
                              : 'border-white/[0.08] bg-black/20 text-white/62'
                      }`}
                    >
                      {state.label}
                    </span>
                    <span className="rounded-full border border-white/[0.08] bg-black/20 px-3 py-1 text-[11px] font-semibold text-white/72">
                      {roundLabel(selectedMatch.round, totalRounds)}
                    </span>
                    {votedCatId ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/18 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-100">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Vote locked
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {[
                      {
                        key: 'a' as const,
                        cat: selectedMatch.cat_a,
                        votes: selectedMatch.votes_a,
                        percent: snapshot.percentA,
                        winner: selectedMatch.winner_id === selectedMatch.cat_a.id,
                        dimmed: !!selectedMatch.winner_id && selectedMatch.winner_id !== selectedMatch.cat_a.id,
                      },
                      {
                        key: 'b' as const,
                        cat: selectedMatch.cat_b,
                        votes: selectedMatch.votes_b,
                        percent: snapshot.percentB,
                        winner: selectedMatch.winner_id === selectedMatch.cat_b.id,
                        dimmed: !!selectedMatch.winner_id && selectedMatch.winner_id !== selectedMatch.cat_b.id,
                      },
                    ].map((entry) => {
                      const isVoted = votedCatId === entry.cat.id || voteNotice === entry.key;
                      const isOtherDimmed = (voteNotice === 'a' && entry.key === 'b') || (voteNotice === 'b' && entry.key === 'a');
                      return (
                        <button
                          type="button"
                          key={entry.cat.id}
                          disabled={!canVote}
                          onClick={() => handleVote(selectedMatch.match_id, entry.cat.id)}
                          className={`tournament-bracket-fighter tournament-bracket-sheet-card rounded-2xl border border-white/[0.06] bg-black/20 p-3 text-left transition ${
                            canVote ? 'cursor-pointer active:scale-[0.985]' : 'cursor-default'
                          } ${entry.winner ? 'ring-1 ring-emerald-300/20' : ''} ${
                            isVoted ? 'scale-[1.01] border-cyan-300/18 bg-cyan-500/[0.08]' : ''
                          } ${isOtherDimmed || entry.dimmed ? 'opacity-60' : ''}`}
                        >
                          <div className="aspect-[4/3] overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03]">
                            <img
                              src={entry.cat.image_url || '/cat-placeholder.svg'}
                              alt={entry.cat.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                              decoding="async"
                              onError={(event) => {
                                (event.currentTarget as HTMLImageElement).src = '/cat-placeholder.svg';
                              }}
                            />
                          </div>
                          <div className="mt-3">
                            <p className="text-sm font-semibold text-white">{entry.cat.name}</p>
                            <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/42">{entry.cat.rarity}</p>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-xs text-white/52">
                            <span>{entry.votes} votes</span>
                            <span>{entry.percent}%</span>
                          </div>
                          {entry.winner ? (
                            <span className="mt-3 inline-flex items-center gap-1 rounded-full border border-emerald-300/18 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-100">
                              <Trophy className="h-3.5 w-3.5" />
                              Winner
                            </span>
                          ) : null}
                          {isVoted ? (
                            <span className="mt-3 inline-flex rounded-full border border-cyan-300/18 bg-cyan-500/12 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">
                              Vote locked
                            </span>
                          ) : canVote ? (
                            <span className="mt-3 inline-flex rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-white/74">
                              Tap to vote
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/[0.05] bg-black/20 p-3 text-xs text-white/55">
                    <div className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4 text-white/42" />
                      <span>Status: {String(selectedMatch.status || 'unknown').replace(/_/g, ' ')}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Target className="h-4 w-4 text-white/42" />
                      <span>Match ID: {selectedMatch.match_id.slice(0, 8)}</span>
                    </div>
                    {currentRoundMatches.length > 0 ? (
                      <div className="mt-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-white/42" />
                        <span>
                          {currentRoundMatches.length} matchup{currentRoundMatches.length === 1 ? '' : 's'} in the current lane.
                        </span>
                      </div>
                    ) : null}
                  </div>
                </>
              );
            })()}
          </section>
        </div>
      ) : null}
    </BracketShell>
  );
}
