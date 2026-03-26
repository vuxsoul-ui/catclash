'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { CheckCircle2, ChevronLeft, Clock3, Loader2, Sparkles, Target, Trophy } from 'lucide-react';
import { deriveTournamentMatchState, summarizeTournamentPlayable } from '../../lib/tournament-state';

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
  if (round === totalRounds - 1) return 'Semi Finals';
  if (round === totalRounds - 2) return 'Quarter Finals';
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
    <div className="space-y-4">
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
  const [error, setError] = useState<string | null>(null);
  const roundRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const nodeRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const initialFocusDone = useRef(false);

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

  function selectMatch(matchId: string, scrollIntoView = false) {
    setSelectedMatchId(matchId);
    if (scrollIntoView) {
      window.requestAnimationFrame(() => {
        nodeRefs.current[matchId]?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      });
    }
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
    selectMatch(currentSpotlightMatchId, true);
  }

  if (loading) {
    return (
      <BracketShell subtitle="Loading the current tournament path and bracket summary.">
        <section className="rounded-[1.8rem] border border-white/[0.06] bg-white/[0.025] p-6 text-center shadow-[0_16px_36px_rgba(0,0,0,0.22)]">
          <div className="flex min-h-[28vh] flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-white/45" />
            <p className="text-sm font-semibold text-white/80">Loading bracket...</p>
            <p className="text-sm text-white/55">Checking for the active tournament and its current bracket state.</p>
          </div>
        </section>
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/60">Bracket</p>
            <h1 className="mt-1 text-xl font-semibold text-white">Tournament Map</h1>
            <p className="mt-1 text-sm text-white/55">
              Follow the path round by round, inspect any node, and jump back to the spotlight when you want to vote.
            </p>
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <section className="rounded-[1.8rem] border border-white/[0.06] bg-white/[0.025] p-4 shadow-[0_16px_36px_rgba(0,0,0,0.22)]">
          <div className="mb-3">
            <p className="text-sm font-semibold text-white">Bracket Map</p>
            <p className="mt-1 text-xs text-white/55">
              Tap any node to inspect it. Scroll sideways on mobile to follow the full tournament path.
            </p>
          </div>

          <div className="tournament-bracket-scroller overflow-x-auto overflow-y-hidden pb-2">
            <div className="tournament-bracket-grid inline-flex min-w-max flex-nowrap items-start gap-4">
              {rounds.map((roundData, columnIndex) => {
                const isCurrent = roundData.round === currentRound;
                const isLast = columnIndex === rounds.length - 1;
                return (
                  <div
                    key={`round-${roundData.round}`}
                    ref={(node) => {
                      roundRefs.current[roundData.round] = node;
                    }}
                    className={`tournament-bracket-column tournament-bracket-lane w-[212px] shrink-0 md:w-[224px] ${isCurrent ? 'is-current' : ''}`}
                  >
                    <div
                      className={`tournament-bracket-roundhead rounded-2xl border px-3 py-2 ${
                        isCurrent ? 'border-cyan-300/18 bg-cyan-500/[0.08]' : 'border-white/[0.05] bg-black/20'
                      }`}
                    >
                      <p className="text-[10px] uppercase tracking-[0.16em] text-white/38">{roundLabel(roundData.round, totalRounds)}</p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {isCurrent ? 'Current round' : roundData.round < currentRound ? 'Completed path' : 'Waiting lane'}
                      </p>
                      <p className="mt-1 text-[10px] text-white/42">{roundData.matches.length} matchups</p>
                    </div>

                    <div className="mt-3 space-y-5">
                      {roundData.groups.map((group, groupIndex) => (
                        <div
                          key={`group-${roundData.round}-${groupIndex}`}
                          className={`tournament-bracket-group relative space-y-2.5 ${!isLast ? 'tournament-bracket-group--linked' : ''}`}
                        >
                          {group.map((match) => {
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

                            return (
                              <button
                                type="button"
                                key={match.match_id}
                                ref={(node) => {
                                  nodeRefs.current[match.match_id] = node;
                                }}
                                onClick={() => selectMatch(match.match_id, false)}
                                data-tier-a={tierA}
                                data-tier-b={tierB}
                                data-state={state.state}
                                data-selected={selected ? 'true' : 'false'}
                                aria-pressed={selected}
                                className={`tournament-bracket-card tournament-bracket-node relative w-full rounded-[1.2rem] border p-2.5 text-left shadow-[0_10px_22px_rgba(0,0,0,0.18)] ${
                                  state.state === 'votable'
                                    ? 'is-active border-cyan-300/18 bg-cyan-500/[0.06]'
                                    : state.state === 'voted'
                                      ? 'border-emerald-300/18 bg-emerald-500/[0.05]'
                                      : state.state === 'resolved'
                                        ? 'border-emerald-300/14 bg-emerald-500/[0.04]'
                                        : 'border-white/[0.06] bg-white/[0.02]'
                                } ${selected ? 'ring-1 ring-white/18' : ''}`}
                              >
                                {!isLast ? <span className="tournament-bracket-node-link" aria-hidden="true" /> : null}
                                <div className="flex items-center justify-between gap-2">
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
                                  <div className="flex items-center gap-1">
                                    {votedForThisMatch ? (
                                      <span className="rounded-full border border-emerald-300/18 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">
                                        Voted
                                      </span>
                                    ) : null}
                                    {state.isSpotlight ? (
                                      <span className="rounded-full border border-amber-300/16 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                                        Spotlight
                                      </span>
                                    ) : null}
                                  </div>
                                </div>

                                <div className="mt-2 space-y-1.5">
                                  {[match.cat_a, match.cat_b].map((cat, index) => {
                                    const isWinner = match.winner_id === cat.id;
                                    return (
                                      <div
                                        key={cat.id}
                                        className={`tournament-bracket-fighter flex items-center gap-2 rounded-xl border border-white/[0.04] bg-black/20 px-2 py-1.5 ${
                                          match.winner_id && !isWinner ? 'opacity-60' : ''
                                        }`}
                                      >
                                        <div className="h-7 w-7 overflow-hidden rounded-lg border border-white/[0.06] bg-black/30">
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
                                        <div className="min-w-0 flex-1">
                                          <p className="truncate text-[11px] font-semibold text-white">{cat.name}</p>
                                          <p className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-white/36">{index === 0 ? 'A side' : 'B side'}</p>
                                        </div>
                                        {isWinner ? (
                                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-amber-300/16 bg-amber-500/10 px-1 text-[9px] font-semibold text-amber-100">
                                            <Trophy className="h-2.5 w-2.5" />
                                          </span>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>

                                <div className="mt-2">
                                  <div className="mb-1 flex items-center justify-between text-[9px] text-white/46">
                                    <span>{snapshot.percentA}%</span>
                                    <span>{snapshot.percentB}%</span>
                                  </div>
                                  <div className="tournament-bracket-bar h-1.5 overflow-hidden rounded-full border border-white/[0.06] bg-white/[0.06]">
                                    <div className="flex h-full w-full">
                                      <div className="tournament-bracket-segment tournament-bracket-segment--a" style={{ width: `${snapshot.percentA}%` }} />
                                      <div className="tournament-bracket-segment tournament-bracket-segment--b" style={{ width: `${snapshot.percentB}%` }} />
                                    </div>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {selectedMatch ? (
          <section
            data-tier-a={rarityTier(selectedMatch.cat_a.rarity)}
            data-tier-b={rarityTier(selectedMatch.cat_b.rarity)}
            className="tournament-bracket-card tournament-bracket-detail is-active rounded-[1.8rem] border border-white/[0.06] bg-white/[0.025] p-4 shadow-[0_16px_36px_rgba(0,0,0,0.22)] xl:sticky xl:top-5 xl:self-start"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200/60">Selected Match</p>
                <h2 className="mt-1 text-lg font-semibold text-white">
                  {selectedMatch.cat_a.name} vs {selectedMatch.cat_b.name}
                </h2>
              </div>
              <span className="rounded-full border border-white/[0.08] bg-black/20 px-3 py-1 text-[11px] font-semibold text-white/72">
                {roundLabel(selectedMatch.round, totalRounds)}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {(() => {
                const state = deriveTournamentMatchState({
                  matchId: selectedMatch.match_id,
                  status: selectedMatch.status,
                  round: selectedMatch.round,
                  currentRound,
                  voted: !!votedMatches[selectedMatch.match_id],
                  pulseLocked,
                  spotlightMatchId: currentSpotlightMatchId,
                });
                return (
                  <>
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
                    {votedMatches[selectedMatch.match_id] ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/18 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-100">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        You voted
                      </span>
                    ) : null}
                    {state.isSpotlight ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/18 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-100">
                        <Sparkles className="h-3.5 w-3.5" />
                        Current spotlight
                      </span>
                    ) : null}
                  </>
                );
              })()}
            </div>

            <div className="mt-3 rounded-2xl border border-white/[0.05] bg-black/20 p-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 font-semibold text-white/78">
                  Status: {String(selectedMatch.status || 'unknown').replace(/_/g, ' ')}
                </span>
                <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 font-semibold text-white/66">
                  Match ID: {selectedMatch.match_id.slice(0, 8)}
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {[selectedMatch.cat_a, selectedMatch.cat_b].map((cat, index) => {
                const isWinner = selectedMatch.winner_id === cat.id;
                const votes = index === 0 ? selectedMatch.votes_a : selectedMatch.votes_b;
                const share = index === 0 ? calcSnapshot(selectedMatch.votes_a, selectedMatch.votes_b).percentA : calcSnapshot(selectedMatch.votes_a, selectedMatch.votes_b).percentB;
                return (
                  <div key={cat.id} className={`rounded-2xl border border-white/[0.05] bg-black/20 p-3 ${selectedMatch.winner_id && !isWinner ? 'opacity-65' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-14 overflow-hidden rounded-xl border border-white/[0.06] bg-black/30">
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
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{cat.name}</p>
                        <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-white/42">{cat.rarity}</p>
                        <p className="mt-1 text-xs text-white/55">{votes} votes · {share}% share</p>
                      </div>
                      {isWinner ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/16 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-100">
                          <Trophy className="h-3 w-3" />
                          Winner
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl border border-white/[0.05] bg-black/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/38">Vote Split</p>
                <p className="text-[11px] text-white/55">{selectedMatch.total_votes} total votes</p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full border border-white/[0.05] bg-white/[0.05]">
                <div className="flex h-full w-full">
                  <div
                    className="tournament-bracket-segment tournament-bracket-segment--a"
                    style={{ width: `${calcSnapshot(selectedMatch.votes_a, selectedMatch.votes_b).percentA}%` }}
                  />
                  <div
                    className="tournament-bracket-segment tournament-bracket-segment--b"
                    style={{ width: `${calcSnapshot(selectedMatch.votes_a, selectedMatch.votes_b).percentB}%` }}
                  />
                </div>
              </div>
            </div>

            {currentRoundMatches.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-white/[0.05] bg-black/20 p-3">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-cyan-200/70" />
                  <p className="text-sm font-semibold text-white">Current Round Snapshot</p>
                </div>
                <p className="mt-1 text-xs text-white/55">
                  {currentRoundMatches.length} matchup{currentRoundMatches.length === 1 ? '' : 's'} in the current lane.
                </p>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </BracketShell>
  );
}
