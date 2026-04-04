'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Swords, Target, ChevronDown, ChevronLeft, ChevronRight, Sparkles, Info, Coins } from 'lucide-react';
import SigilIcon from './icons/SigilIcon';
import CatCardBack from './CatCardBack';
import type { DuelRowData } from './duel/types';
import { VoteSplitBar } from './VoteSplitBar';
import FlameStreak from './FlameStreak';
import VoteConfirmToast from './VoteConfirmToast';
import LiveDuelsTicker from './LiveDuelsTicker';
import { LoadingState } from './LoadingState';
import { showGlobalToast } from '../lib/global-toast';
import { thumbUrlForCat } from '../lib/cat-images';
import { countLiveDuels, pickLiveDuels } from '../lib/duel-live';
import { readVotedMatchesFromStorage, writeVotedMatchesToStorage } from '../lib/vote-state';
import { deriveTournamentMatchState, summarizeTournamentPlayable } from '../lib/tournament-state';
import { formatPulseCountdown, getVirtualPulse } from '../lib/virtual-pulse';

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
  user_voted_cat_id?: string | null;
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

type BetFeedItem = {
  id: string;
  amount: number;
  catName: string;
  username: string;
  side: 'a' | 'b';
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

const BRACKET_CTA_HREF = '/tournament';

function rankLiveDuels(rows: DuelRowData[] | null | undefined): DuelRowData[] {
  return pickLiveDuels<DuelRowData>(rows)
    .sort((a, b) => Number(b?.votes?.total || 0) - Number(a?.votes?.total || 0))
    .slice(0, 6);
}

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
  if (segment === 'voting') return { title: 'You’re caught up for now.', subtitle: 'Check back for the next pulse, or view the bracket standings.' };
  if (segment === 'upcoming') return { title: 'No upcoming matchups queued.', subtitle: 'Future rounds will stack here once the bracket advances.' };
  return { title: 'No completed matchups yet.', subtitle: 'Results will appear here after the first tournament battle closes.' };
}

function formatTournamentRoundLabel(round: number | null | undefined) {
  const value = Number(round || 0);
  if (value === 4) return 'Final';
  if (value === 3) return 'Semifinal';
  if (value === 2) return 'Quarterfinal';
  if (value === 1) return 'First Round';
  return value > 0 ? `Round ${value}` : 'No active round';
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

function resolveVoteSnapshot(
  payload: any,
  fallback: MatchVoteSnapshot | null
): MatchVoteSnapshot | null {
  const asNumber = (...values: any[]) => {
    for (const value of values) {
      if (value == null || value === '') continue;
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
    return null;
  };
  const votesA = asNumber(payload?.votes_a, payload?.votesA, fallback?.votes_a);
  const votesB = asNumber(payload?.votes_b, payload?.votesB, fallback?.votes_b);
  if (votesA == null || votesB == null) return fallback;
  return calcSnapshot(votesA, votesB);
}

function mergeTournamentTotals(
  current: { votes_a: number; votes_b: number; total_votes: number } | null | undefined,
  incoming: { votes_a: number; votes_b: number; total_votes: number } | null | undefined
) {
  if (!incoming) return current || null;
  if (!current) return incoming;
  const curA = Math.max(0, Number(current.votes_a || 0));
  const curB = Math.max(0, Number(current.votes_b || 0));
  const curTotal = Math.max(0, Number(current.total_votes || (curA + curB)));
  const inA = Math.max(0, Number(incoming.votes_a || 0));
  const inB = Math.max(0, Number(incoming.votes_b || 0));
  const inTotal = Math.max(0, Number(incoming.total_votes || (inA + inB)));
  if (inTotal < curTotal) return current;
  const nextA = Math.max(curA, inA);
  const nextB = Math.max(curB, inB);
  return {
    votes_a: nextA,
    votes_b: nextB,
    total_votes: Math.max(nextA + nextB, curTotal, inTotal),
  };
}

function preferHigherTotalSnapshot(
  primary: MatchVoteSnapshot | null,
  secondary: MatchVoteSnapshot | null
): MatchVoteSnapshot | null {
  if (!primary) return secondary;
  if (!secondary) return primary;
  return primary.total_votes >= secondary.total_votes ? primary : secondary;
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

  const hasArenaRounds = !!arena && Array.isArray(arena.rounds) && arena.rounds.length > 0;
  const bracketMatches = overviewData?.matches || [];
  const roundCount = overviewData ? new Set(bracketMatches.map((match) => Number(match.round || 1))).size : 0;
  const maxRound = Math.max(1, roundCount || Number(arena?.rounds?.length || 1));
  const currentRoundNumber = arena
    ? clampRoundNumber(Number(arena.current_round || 1), 1, maxRound)
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
  const currentRoundLabel = currentRoundNumber !== null ? formatTournamentRoundLabel(currentRoundNumber) : '—';

  if (!hasArenaRounds) {
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

  return (
    <section className="rounded-[1.7rem] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(15,23,42,0.42),rgba(15,23,42,0.34))] p-3 backdrop-blur-md shadow-[0_14px_30px_rgba(0,0,0,0.18)]">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-white">Bracket</h3>
        <div className="flex items-center gap-2">
          <Link
            href={BRACKET_CTA_HREF}
            className="inline-flex items-center gap-1 text-xs font-semibold text-white/72 transition hover:text-white"
          >
            View Full Bracket
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? 'Collapse bracket overview' : 'Expand bracket overview'}
            className="inline-flex items-center gap-1 text-xs font-semibold text-white/64 transition hover:text-white"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      <div className="mt-2.5 overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-900/40">
        <div className="grid grid-cols-2 gap-0">
          <div className="px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Voted</p>
            <p data-testid="tournament-voted-count" className="mt-1 text-[1.28rem] font-extrabold leading-none text-white [text-shadow:0_0_10px_rgba(34,211,238,0.14)]">{playableSummary.votedCount}</p>
          </div>
          <div className="border-l border-slate-800/90 px-3 py-2.5 text-right">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Open</p>
            <p data-testid="tournament-open-count" className="mt-1 text-[1.28rem] font-extrabold leading-none text-white [text-shadow:0_0_10px_rgba(34,211,238,0.12)]">{playableSummary.openCount}</p>
          </div>
          <div className="col-span-2 border-t border-slate-800/90 px-3 py-2.5 text-center">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/44">Current Round</p>
            <p className="mt-1 text-[15px] font-bold text-white">{currentRoundLabel}</p>
          </div>
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

function normalizeFixtureDebugQuery() {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search || '');
  const out = new URLSearchParams();
  if (params.get('fixture') === '1') out.set('fixture', '1');
  if (params.get('debug') === '1') out.set('debug', '1');
  const q = out.toString();
  return q ? `?${q}` : '';
}

function queueMatchesFromArenas(arenas: Arena[]): ArenaMatch[] {
  const fallback = (arenas || []).flatMap((arena) => {
    const rounds = arena.rounds || [];
    const currentRound = rounds.find((round) => Number(round.round || 0) === Number(arena.current_round || 0)) || rounds[0];
    return (currentRound?.matches || []).map((match) => {
      const votesA = Math.max(0, Number(match.votes_a || 0));
      const votesB = Math.max(0, Number(match.votes_b || 0));
      const snapshot = calcSnapshot(votesA, votesB);
      return {
        ...match,
        status: String(match.status || 'active'),
        votes_a: votesA,
        votes_b: votesB,
        total_votes: snapshot.total_votes,
        percent_a: snapshot.percent_a,
        percent_b: snapshot.percent_b,
      };
    });
  });
  return normalizeQueueMatches(fallback);
}

function buildClientFixtureArenas(): Arena[] {
  const fixtureMatch: ArenaMatch = {
    match_id: 'client-fixture-main-1',
    status: 'active',
    votes_a: 22,
    votes_b: 19,
    total_votes: 41,
    percent_a: 54,
    percent_b: 46,
    winner_id: null,
    is_close_match: true,
    user_voted_cat_id: null,
    cat_a: {
      id: 'client-fx-cat-a',
      name: 'Furboss',
      image_url: '/cat-placeholder.svg',
      rarity: 'Rare',
      owner_username: 'vuxsal',
      owner_guild: 'moon',
      stats: { attack: 14, defense: 12, speed: 11, charisma: 10, chaos: 8 },
    },
    cat_b: {
      id: 'client-fx-cat-b',
      name: 'Couchraider',
      image_url: '/cat-placeholder.svg',
      rarity: 'Epic',
      owner_username: 'kais',
      owner_guild: 'sun',
      stats: { attack: 13, defense: 14, speed: 9, charisma: 11, chaos: 8 },
    },
  };
  return [
    {
      tournament_id: 'client-fixture-tournament',
      type: 'main',
      date: new Date().toISOString().slice(0, 10),
      current_round: 1,
      status: 'active',
      champion: null,
      rounds: [{ round: 1, matches: [fixtureMatch] }],
    },
  ];
}

type LoadOptions = {
  silent?: boolean;
  preserveVotedMatches?: Record<string, string> | null;
};

function normalizeQueueMatches(matches: ArenaMatch[]): ArenaMatch[] {
  const seen = new Set<string>();
  const out: ArenaMatch[] = [];
  for (const match of matches || []) {
    const matchId = String(match?.match_id || '').trim();
    if (!matchId || seen.has(matchId)) continue;
    const catAId = String(match?.cat_a?.id || '').trim();
    const catBId = String(match?.cat_b?.id || '').trim();
    if (!catAId || !catBId) continue;
    seen.add(matchId);
    out.push(match);
  }
  return out;
}

function pickQueueScopedVotes(
  queueMatchIds: string[],
  sources: Array<Record<string, string> | null | undefined>
): Record<string, string> {
  const allowed = new Set(queueMatchIds.map((id) => String(id || '').trim()).filter(Boolean));
  const merged: Record<string, string> = {};
  for (const source of sources) {
    if (!source) continue;
    for (const [matchId, catId] of Object.entries(source)) {
      const m = String(matchId || '').trim();
      const c = String(catId || '').trim();
      if (!m || !c || !allowed.has(m)) continue;
      merged[m] = c;
    }
  }
  return merged;
}

async function fetchVotesForCurrentQueue(matchIds: string[]): Promise<Record<string, string>> {
  const ids = Array.from(new Set((matchIds || []).map((id) => String(id || '').trim()).filter(Boolean)));
  if (!ids.length) return {};
  try {
    const response = await fetch('/api/tournament/votes-for-matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_ids: ids }),
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok || typeof payload?.votes !== 'object' || !payload.votes) return {};
    return payload.votes as Record<string, string>;
  } catch {
    return {};
  }
}

function SpotlightMatchCard({
  match,
  renderTotals,
  mode,
  pulseResumeAt,
  isFlameLitForPulse,
  voted,
  isVoting,
  predictBusy,
  availableSigils,
  activeIndex,
  total,
  voteSessionCount,
  voteAnimTick = 0,
  hasCredentials,
  onVote,
  onPredict,
  onPrev,
  onNext,
}: {
  match: ArenaMatch;
  renderTotals?: { votes_a: number; votes_b: number; total_votes: number } | null;
  mode: Segment;
  pulseResumeAt?: string | null;
  isFlameLitForPulse: boolean;
  voted: string | null;
  isVoting: boolean;
  predictBusy: boolean;
  availableSigils: number;
  activeIndex: number;
  total: number;
  voteSessionCount: number;
  voteAnimTick?: number;
  hasCredentials: boolean;
  onVote: (matchId: string, catId: string) => void;
  onPredict: (matchId: string, catId: string, bet: number) => Promise<boolean>;
  onPrev: () => void;
  onNext: () => void;
}) {
  const done = match.status === 'complete' || mode === 'results';
  const hasVoted = !!voted;
  const predictedCatId = match.user_prediction?.predicted_cat_id || null;
  const [bet, setBet] = useState(10);
  const [flippedSides, setFlippedSides] = useState<{ a: boolean; b: boolean }>({ a: false, b: false });
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [flashSide, setFlashSide] = useState<'a' | 'b' | null>(null);
  const [lockedToast, setLockedToast] = useState(false);
  const [betSheetCatId, setBetSheetCatId] = useState<string | null>(null);
  const [betFeed, setBetFeed] = useState<BetFeedItem[]>([]);
  const [justVoted, setJustVoted] = useState(false);
  const [tapReward, setTapReward] = useState<{ x: number; y: number; id: number } | null>(null);
  const [nextBreathe, setNextBreathe] = useState(false);
  const [pressSide, setPressSide] = useState<'a' | 'b' | null>(null);
  const [localFlameCount, setLocalFlameCount] = useState(Math.max(0, Number(voteSessionCount || 0)));
  const [pulseNowMs, setPulseNowMs] = useState(0);
  const [countdownReady, setCountdownReady] = useState(false);
  const pulse = useMemo(() => getVirtualPulse(pulseNowMs), [pulseNowMs]);

  const aPower = statPower(match.cat_a);
  const bPower = statPower(match.cat_b);
  const strongerA = aPower >= bPower;
  const edgePct = Math.min(35, Math.round((Math.abs(aPower - bPower) / Math.max(1, Math.max(aPower, bPower))) * 100));
  const hasCanonicalTotals = renderTotals !== null && renderTotals !== undefined;
  const canonicalTotals = hasCanonicalTotals
    ? {
        votes_a: Math.max(0, Number(renderTotals.votes_a || 0)),
        votes_b: Math.max(0, Number(renderTotals.votes_b || 0)),
        total_votes: Math.max(0, Number(renderTotals.total_votes ?? (renderTotals.votes_a + renderTotals.votes_b))),
      }
    : null;
  let snapshot = hasCanonicalTotals
    ? calcSnapshot(canonicalTotals?.votes_a || 0, canonicalTotals?.votes_b || 0)
    : calcSnapshot(match.votes_a, match.votes_b);
  if (hasCanonicalTotals && canonicalTotals) {
    snapshot = calcSnapshot(canonicalTotals.votes_a, canonicalTotals.votes_b);
  }
  const sourceUsed: 'canonical-local' | 'tournament-match' = hasCanonicalTotals ? 'canonical-local' : 'tournament-match';
  const pctA = snapshot.percent_a;
  const pctB = snapshot.percent_b;
  const tierA = rarityTier(match.cat_a.rarity);
  const tierB = rarityTier(match.cat_b.rarity);
  const reopenAtMs = pulseBoundaryMs(pulseResumeAt || match.resolves_at || match.vote_locks_at);
  const lockExpired = reopenAtMs !== null && Date.now() >= reopenAtMs;
  const votingLocked = mode === 'voting' && !lockExpired && Boolean(match.voting_locked);
  const canVote = mode === 'voting' && !done && !votingLocked && !hasVoted && !isVoting;
  const canTriggerGuestAuthGate = !hasCredentials && mode === 'voting' && !done && !votingLocked;
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
    : hasVoted
      ? 'Vote locked'
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
    setFlashSide(null);
    setLockedToast(false);
    setBetSheetCatId(null);
    setBetFeed([]);
  }, [match.match_id]);

  useEffect(() => {
    if (!betSheetCatId) return;
    const names = ['@nova', '@rookiecat', '@arenafox', '@sigilrun', '@clawlord', '@zenpaw', '@vuxstar', '@whiskerqt'];
    const bets = [5, 10, 10, 15, 20];
    const seedSide: 'a' | 'b' = match.votes_a >= match.votes_b ? 'a' : 'b';
    const seed: BetFeedItem[] = Array.from({ length: 4 }).map((_, index) => {
      const side: 'a' | 'b' = index % 2 === 0 ? seedSide : (seedSide === 'a' ? 'b' : 'a');
      const catName = side === 'a' ? match.cat_a.name : match.cat_b.name;
      return {
        id: `seed-${match.match_id}-${index}`,
        amount: bets[index % bets.length],
        catName,
        username: names[index % names.length],
        side,
      };
    });
    setBetFeed(seed);
    const id = window.setInterval(() => {
      const side: 'a' | 'b' = Math.random() > 0.54 ? 'a' : 'b';
      const catName = side === 'a' ? match.cat_a.name : match.cat_b.name;
      const entry: BetFeedItem = {
        id: `live-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        amount: bets[Math.floor(Math.random() * bets.length)],
        catName,
        username: names[Math.floor(Math.random() * names.length)],
        side,
      };
      setBetFeed((prev) => [entry, ...prev].slice(0, 8));
    }, 1400);
    return () => window.clearInterval(id);
  }, [betSheetCatId, match.cat_a.name, match.cat_b.name, match.match_id, match.votes_a, match.votes_b]);

  useEffect(() => {
    if (!voted) return;
    const side = voted === match.cat_a.id ? 'a' : voted === match.cat_b.id ? 'b' : null;
    if (!side) return;
    setFlashSide(side);
    setLockedToast(true);
    const hideToastId = window.setTimeout(() => setLockedToast(false), 1400);
    const clearFlashId = window.setTimeout(() => setFlashSide(null), 1200);
    return () => {
      window.clearTimeout(hideToastId);
      window.clearTimeout(clearFlashId);
    };
  }, [voted, match.cat_a.id, match.cat_b.id]);

  useEffect(() => {
    setCountdownReady(true);
    setPulseNowMs(Date.now());
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setPulseNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!voteAnimTick) return;
    setJustVoted(true);
    setLocalFlameCount((prev) => Math.max(0, prev + 1));
    const off = window.setTimeout(() => setJustVoted(false), 620);
    const breatheOn = window.setTimeout(() => setNextBreathe(true), 520);
    const breatheOff = window.setTimeout(() => setNextBreathe(false), 1200);
    const rewardOff = window.setTimeout(() => setTapReward(null), 460);
    return () => {
      window.clearTimeout(off);
      window.clearTimeout(breatheOn);
      window.clearTimeout(breatheOff);
      window.clearTimeout(rewardOff);
    };
  }, [voteAnimTick]);

  useEffect(() => {
    const next = Math.max(0, Number(voteSessionCount || 0));
    setLocalFlameCount((prev) => {
      if (next > prev) return next;
      if (next === 0 && prev > 0) return 0;
      return prev;
    });
  }, [voteSessionCount]);

  const aStatEdge = {
    label: edgePct <= 3 ? 'Stat edge: balanced' : `Stat edge: ${strongerA ? 'favored' : 'underdog'} +${edgePct}%`,
    tone: edgePct <= 3 ? 'neutral' as const : strongerA ? 'a' as const : 'neutral' as const,
  };

  const bStatEdge = {
    label: edgePct <= 3 ? 'Stat edge: balanced' : `Stat edge: ${strongerA ? 'underdog' : 'favored'} +${edgePct}%`,
    tone: edgePct <= 3 ? 'neutral' as const : strongerA ? 'neutral' as const : 'b' as const,
  };

  function toggleFlip(side: 'a' | 'b') {
    setFlippedSides((prev) => ({ ...prev, [side]: !prev[side] }));
  }

  const betTargetCat = betSheetCatId === match.cat_a.id
    ? match.cat_a
    : betSheetCatId === match.cat_b.id
      ? match.cat_b
      : null;
  const betTargetSide: 'a' | 'b' | null = betTargetCat ? (betTargetCat.id === match.cat_a.id ? 'a' : 'b') : null;
  const potFromFeed = betFeed.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const basePot = Math.max(0, Number(snapshot.total_votes ?? (snapshot.votes_a + snapshot.votes_b))) * 2;
  const displayedPot = basePot + potFromFeed;
  const targetPct = betTargetSide === 'a' ? pctA : pctB;
  const targetOdds = targetPct >= 55 ? 'favored' : `underdog (+${Math.max(4, 55 - targetPct)}%)`;
  const recentWindow = betFeed.slice(0, 4);
  const actionBias = recentWindow.reduce((acc, item) => acc + (item.side === 'a' ? 1 : -1), 0);
  const momentumLabel = Math.abs(actionBias) <= 1 ? 'Balanced' : Math.abs(actionBias) >= 3 ? 'Heavy action' : 'Trending';
  const momentumIcon = Math.abs(actionBias) <= 1 ? '⚖️' : Math.abs(actionBias) >= 3 ? '🔥' : '📈';
  const queueRemaining = Math.max(0, total - activeIndex - 1);
  const queueComplete = queueRemaining === 0;
  const queueCenterCopy = queueComplete
    ? pulse.state === 'live'
      ? `Queue complete! Results in ${countdownReady ? formatPulseCountdown(pulse.msRemaining) : '—'}`
      : pulse.state === 'resolving'
        ? 'Queue complete! Results resolving...'
        : `Queue complete! Next pulse in ${countdownReady ? formatPulseCountdown(pulse.msRemaining) : '—'}`
    : `${queueRemaining} waiting after this`;

  function triggerVote(side: 'a' | 'b', catId: string) {
    if (!hasCredentials) {
      onVote(match.match_id, catId);
      return;
    }
    if (!canVote && !canTriggerGuestAuthGate) return;
    setFlashSide(side);
    onVote(match.match_id, catId);
  }

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const totalVotes = Math.max(0, Number(snapshot.total_votes || (snapshot.votes_a + snapshot.votes_b)));
    console.debug('[DEV][tournament-vote-render-source]', {
      matchId: match.match_id,
      sourceUsed,
      votes_a: snapshot.votes_a,
      votes_b: snapshot.votes_b,
      total_votes: totalVotes,
      pctA,
      pctB,
      voteAnimTick,
      voted,
    });
    if (hasCanonicalTotals && sourceUsed !== 'canonical-local') {
      console.error('[DEV][tournament-vote-render-fallback-bug]', { matchId: match.match_id, sourceUsed });
      console.error('[BUG] fallback render detected', { matchId: match.match_id, sourceUsed });
    }
    console.debug('[TOURNAMENT_BAR_RENDER]', {
      matchId: match.match_id,
      pctA,
      pctB,
      voteAnimTick,
      voted,
    });
  }, [
    hasCanonicalTotals,
    match.match_id,
    pctA,
    pctB,
    snapshot.total_votes,
    snapshot.votes_a,
    snapshot.votes_b,
    sourceUsed,
    voteAnimTick,
    voted ?? null,
  ]);

  function renderFront(cat: ArenaCat, side: 'a' | 'b') {
    const tier = side === 'a' ? tierA : tierB;
    const isLiveSide = flippedSides[side];
    const votedForThisSide = voted === cat.id;
    const isSelected = flashSide === side || votedForThisSide;
    const isDimmed = !!flashSide && flashSide !== side;
    const frameTone =
      side === 'a'
        ? 'from-blue-500/18 via-cyan-400/10 to-transparent'
        : 'from-rose-500/18 via-orange-400/10 to-transparent';

    return (
      <div
        role={canVote ? 'button' : undefined}
        tabIndex={canVote ? 0 : undefined}
        onPointerDown={(event) => {
          setPressSide(side);
          setTapReward({ x: event.clientX, y: event.clientY, id: Date.now() });
          window.setTimeout(() => setPressSide((prev) => (prev === side ? null : prev)), 110);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            triggerVote(side, cat.id);
          }
        }}
        data-selected={isSelected ? 'true' : 'false'}
        data-dimmed={isDimmed ? 'true' : 'false'}
        className={`tournament-fighter-card tournament-fighter-card--interactive arena-flip-face arena-flip-front arena-fighter-pane arena-duel-card tier-${tier} relative rounded-[1.4rem] border border-white/7 bg-gradient-to-br ${frameTone} p-2 transition-all duration-150 ease-out ${pressSide === side ? 'scale-[0.96]' : 'hover:scale-[1.01]'} ${isSelected ? 'shadow-[0_0_32px_rgba(34,211,238,0.35),0_18px_40px_rgba(0,0,0,0.4)]' : 'shadow-[0_18px_40px_rgba(0,0,0,0.32)]'}`}
        style={pressSide === side ? { filter: 'brightness(1.08)' } : {}}
      >
        {lockedToast && isSelected ? (
          <div className="pointer-events-none absolute inset-x-4 top-4 z-[3] flex items-center justify-between gap-2 rounded-full border border-emerald-300/20 bg-emerald-500/16 px-3 py-1.5 text-[10px] font-semibold text-emerald-50 backdrop-blur-sm">
            <span>Vote locked</span>
            <span className="text-emerald-100/80">+1 impact</span>
          </div>
        ) : null}
        <div className="relative z-[1] flex items-center justify-between gap-2">
          <span className={`rarity-badge rarity-badge--${tier} inline-flex rounded-full border px-2 py-1 text-[9px] font-semibold tracking-[0.08em] uppercase`}>
            {cat.rarity}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setBetSheetCatId(cat.id);
              }}
              aria-label={`Back ${cat.name}`}
              className="tournament-inspect-btn inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white/72 transition hover:bg-white/[0.08] hover:text-white"
            >
              <Coins className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                toggleFlip(side);
              }}
              aria-label={`Inspect ${cat.name}`}
              className="tournament-inspect-btn inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white/72 transition hover:bg-white/[0.08] hover:text-white"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </div>
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

        <div className="relative z-[1] mt-2 min-w-0 px-0.5">
          <div className="rounded-xl border border-white/10 bg-black/35 px-2.5 py-2">
            <p className="block min-w-0 truncate text-[18px] font-bold leading-[1.15] tracking-tight text-white drop-shadow-sm">{cat.name}</p>
          </div>
        </div>

        {isLiveSide && isSmallScreen ? null : (
          <div className="pointer-events-none absolute inset-x-4 bottom-4 h-10 rounded-full bg-white/5 blur-2xl opacity-70" />
        )}
      </div>
    );
  }

  function renderBack(cat: ArenaCat, side: 'a' | 'b') {
    return (
      <div>
        <CatCardBack
          cat={cat}
          role={side === 'a' ? 'Challenger' : 'Defender'}
          votes={Number(side === 'a' ? snapshot.votes_a || 0 : snapshot.votes_b || 0)}
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
    <div key={match.match_id} data-tier-a={tierA} data-tier-b={tierB} className="tournament-stage-shell relative overflow-hidden rounded-[2rem] border border-white/7 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.14),_transparent_32%),linear-gradient(180deg,rgba(12,16,26,0.94),rgba(6,8,14,0.98))] p-3.5 shadow-[0_24px_58px_rgba(0,0,0,0.42)] sm:p-5">
      <div className="pointer-events-none absolute inset-x-10 top-0 h-24 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-4 h-24 w-24 rounded-full bg-amber-400/10 blur-3xl" />

      <div className="tournament-stage-meta relative z-[1] flex items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-white">{roundStatus}</p>
        </div>
        <div className="shrink-0 text-right">
          <FlameStreak count={localFlameCount} reactionTick={voteAnimTick} className="mb-1.5" />
          <p className="text-xs font-semibold text-white/80">Queue {Math.min(total, activeIndex + 1)} / {Math.max(1, total)}</p>
          <p className={`text-[10px] ${isFlameLitForPulse ? 'text-amber-200/85' : 'text-white/60'}`}>
            {isFlameLitForPulse ? `Arena Flame ${localFlameCount} · +10% bonus` : `Vote to keep it lit`}
          </p>
        </div>
      </div>

      <div className="relative z-[1] mt-4 grid grid-cols-1 items-start gap-3.5 sm:grid-cols-[minmax(0,1fr)_40px_minmax(0,1fr)] sm:gap-5">
        <div className="min-w-0">
          <div className="arena-flip-scene min-h-[0]">
            <div
              data-testid={`vote-a-${String(match.match_id)}`}
              role={canVote || !hasCredentials ? 'button' : undefined}
              tabIndex={canVote || !hasCredentials ? 0 : undefined}
              onClick={() => triggerVote('a', match.cat_a.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  triggerVote('a', match.cat_a.id);
                }
              }}
              className={`arena-flip-card ${!isSmallScreen && flippedSides.a ? 'is-flipped-desktop' : ''}`}
            >
              {flippedSides.a && isSmallScreen ? renderBack(match.cat_a, 'a') : renderFront(match.cat_a, 'a')}
              {!isSmallScreen ? renderBack(match.cat_a, 'a') : null}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-2.5 py-1 sm:pt-14">
          <div className="tournament-vs-pill rounded-full border border-white/[0.08] bg-white/[0.035] px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.16em] text-white/70">
            VS
          </div>
          <VoteSplitBar
            pctA={pctA}
            rarityA={match.cat_a.rarity}
            rarityB={match.cat_b.rarity}
            animTick={voteAnimTick}
            justVoted={justVoted}
            selectedSide={flashSide}
            className="mt-0.5 w-full"
            durationMs={justVoted ? 550 : 500}
          />
          <div className="mt-0.5 flex flex-col items-center gap-0.5">
            <div className="text-center text-[15px] font-black tracking-[0.02em] tabular-nums text-white">
              {pctA}%<span className="text-white/40 mx-1">·</span>{pctB}%
            </div>
            <div className="text-[11px] font-medium text-white/55">
              {Number(snapshot.total_votes ?? (snapshot.votes_a + snapshot.votes_b))} votes
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <div className="arena-flip-scene min-h-[0]">
            <div
              data-testid={`vote-b-${String(match.match_id)}`}
              role={canVote || !hasCredentials ? 'button' : undefined}
              tabIndex={canVote || !hasCredentials ? 0 : undefined}
              onClick={() => triggerVote('b', match.cat_b.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  triggerVote('b', match.cat_b.id);
                }
              }}
              className={`arena-flip-card ${!isSmallScreen && flippedSides.b ? 'is-flipped-desktop' : ''}`}
            >
              {flippedSides.b && isSmallScreen ? renderBack(match.cat_b, 'b') : renderFront(match.cat_b, 'b')}
              {!isSmallScreen ? renderBack(match.cat_b, 'b') : null}
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-[1] mt-3.5 flex items-center justify-end text-[11px] text-white/75">
        {votingLocked ? (
          <span className="inline-flex rounded-full border border-white/[0.1] bg-white/[0.05] px-3 py-1.5 text-white/70">
            {lockCopy ? `Voting reopens ${lockCopy}` : 'Voting paused'}
          </span>
        ) : predictBusy || predictedCatId ? (
          <span className="tabular-nums text-white/60">{predictBusy ? 'Locking…' : 'Prediction locked'}</span>
        ) : null}
      </div>
      {tapReward && justVoted ? (
        <div
          key={tapReward.id}
          className="pointer-events-none fixed z-[120] text-[13px] font-bold text-emerald-200"
          style={{
            left: tapReward.x,
            top: tapReward.y,
            transform: 'translate(-50%, -100%)',
            animation: 'floatUp 550ms ease-out forwards',
            textShadow: '0 0 12px rgba(52, 211, 153, 0.6), 0 2px 4px rgba(0,0,0,0.4)',
          }}
        >
          +1 Impact
        </div>
      ) : null}

      {betSheetCatId && betTargetCat ? (
        <div className="fixed inset-0 z-[1900]">
          <button
            type="button"
            aria-label="Close prediction sheet"
            className="absolute inset-0 bg-black/55"
            onClick={() => setBetSheetCatId(null)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border border-white/[0.1] bg-[linear-gradient(180deg,rgba(19,25,38,0.98),rgba(9,14,24,0.99))] p-4 pb-[calc(env(safe-area-inset-bottom)+14px)] shadow-[0_-14px_28px_rgba(0,0,0,0.34)]">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/18" />
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/52">Prediction</p>
                <p className="mt-1 truncate text-sm font-semibold text-white">Back {betTargetCat.name}</p>
              </div>
              {predictedCatId ? (
                <span className="tournament-lock-chip inline-flex items-center gap-1 rounded-full border border-cyan-300/22 bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-100">
                  Locked +<SigilIcon className="h-3 w-3" />{match.user_prediction?.bet_sigils || bet}
                </span>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[5, 10, 15, 20].map((chip) => (
                <button
                  type="button"
                  key={`${match.match_id}-${betTargetCat.id}-${chip}`}
                  disabled={chip > availableSigils || !!predictedCatId}
                  onClick={() => setBet(chip)}
                  data-selected={bet === chip ? 'true' : 'false'}
                  className="tournament-chip-btn h-9 rounded-full border px-3 text-xs font-semibold disabled:opacity-40 active:scale-[0.97]"
                >
                  {chip}
                </button>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-[11px] text-white/80">
                <span className="font-semibold">Pot: {displayedPot} sigils</span>
                <span className="text-white/68">{momentumIcon} {momentumLabel}</span>
              </div>
              <p className="mt-1 text-[10px] text-white/58">
                Odds feel: <span className="text-white/78">{betTargetCat.name}</span> is <span className="text-amber-100/92">{targetOdds}</span>
              </p>
            </div>
            <p className="mt-3 text-xs text-white/64">
              {predictedCatId
                ? 'Prediction already locked for this battle.'
                : !canPredict
                  ? (votingLocked ? (lockCopy ? `Predictions reopen ${lockCopy}.` : 'Predictions are locked right now.') : 'Vote first to back this pick.')
                  : `Lock prediction for ${bet} sigils.`}
            </p>
            <button
              type="button"
              disabled={!canPredict || !!predictedCatId || predictBusy || bet > availableSigils}
              onClick={async () => {
                const ok = await onPredict(match.match_id, betTargetCat.id, bet);
                if (ok) setBetSheetCatId(null);
              }}
              className="tournament-queue-btn tournament-queue-btn--next mt-3 inline-flex h-10 w-full items-center justify-center gap-1 rounded-xl border px-3 text-sm font-semibold disabled:opacity-35 active:scale-[0.98]"
            >
              {predictBusy ? 'Locking…' : predictedCatId ? 'Prediction Locked' : `Confirm +${bet}`}
            </button>
            <div className="mt-3 rounded-xl border border-white/[0.08] bg-black/24 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">Live bets</p>
              <div className="mt-2 space-y-1.5">
                {betFeed.slice(0, 8).map((entry) => (
                  <p key={entry.id} className="animate-[fadeIn_220ms_ease-out] text-xs text-white/80">
                    +{entry.amount} on {entry.catName} <span className="text-white/56">— {entry.username}</span>
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="tournament-queue-row relative z-[1] mt-4 flex items-center justify-between gap-2.5 rounded-xl border border-white/[0.1] bg-black/30 px-4 py-3 shadow-[0_12px_24px_rgba(0,0,0,0.14)]">
        <button
          type="button"
          onClick={onPrev}
          disabled={activeIndex <= 0}
          className="tournament-queue-btn tournament-queue-btn--prev inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/[0.02] px-4 text-sm font-semibold text-white/60 shadow-sm disabled:opacity-30 active:scale-[0.98] hover:border-white/25 hover:text-white/80"
        >
          <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Prev
        </button>
        <div className="text-center flex-1 relative">
          {queueComplete && (
            <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-500/5 via-transparent to-cyan-500/5 pointer-events-none" />
          )}
          <div className="relative">
            {queueComplete ? (
              <>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">QUEUE COMPLETE</p>
                <p className="mt-1.5 text-base font-bold text-white drop-shadow-md">You&apos;re locked in</p>
                <p className="mt-1.5 text-sm font-medium text-white/90">
                  Results in{' '}
                  <span className="text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] animate-[pulse_2s_ease-in-out_infinite]">
                    {pulse.state === 'resolving' ? '—' : countdownReady ? formatPulseCountdown(pulse.msRemaining) : '—'}
                  </span>
                </p>
                <p className="mt-0.5 text-[11px] text-white/50">Flame protected 🔥</p>
              </>
            ) : (
              <>
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/50">BATTLE QUEUE</p>
                <p className="mt-1.5 text-sm font-medium text-white/80">{queueCenterCopy}</p>
              </>
            )}
          </div>
        </div>
        {queueComplete ? (
          <Link
            href={BRACKET_CTA_HREF}
            className={`tournament-queue-btn tournament-queue-btn--next inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-4 text-sm font-semibold text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.25),0_12px_24px_rgba(34,211,238,0.14)] transition-all active:scale-[0.98] hover:border-cyan-300/60 hover:bg-cyan-500/15 hover:shadow-[0_0_28px_rgba(34,211,238,0.35),0_12px_24px_rgba(34,211,238,0.18)] ${nextBreathe ? 'animate-[subtleBreathe_900ms_ease-in-out_1]' : ''}`}
          >
            View Bracket
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={onNext}
            disabled={activeIndex >= total - 1}
            className={`tournament-queue-btn tournament-queue-btn--next inline-flex h-11 items-center justify-center gap-1.5 rounded-full border px-4 text-sm font-semibold shadow-[0_12px_24px_rgba(34,211,238,0.14)] disabled:opacity-35 active:scale-[0.98] ${nextBreathe ? 'animate-[subtleBreathe_900ms_ease-in-out_1]' : ''}`}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}


export default function TournamentPage({
  initialFixtureMode = false,
  initialDebugMode = false,
}: {
  initialFixtureMode?: boolean;
  initialDebugMode?: boolean;
}) {
  const initialFixtureArenas = useMemo(() => (initialFixtureMode ? buildClientFixtureArenas() : []), [initialFixtureMode]);
  const [loading, setLoading] = useState(!initialFixtureMode);
  const [arenas, setArenas] = useState<Arena[]>(initialFixtureArenas);
  const [queueMatches, setQueueMatches] = useState<ArenaMatch[]>(() => (initialFixtureMode ? queueMatchesFromArenas(initialFixtureArenas) : []));
  const [, setBracketQueue] = useState<BracketQueuePayload | null>(null);
  const [votedMatches, setVotedMatches] = useState<Record<string, string>>({});
  const [resolvedVoteByMatchId, setResolvedVoteByMatchId] = useState<Record<string, string>>({});
  const [voteAnimTickByMatchId, setVoteAnimTickByMatchId] = useState<Record<string, number>>({});
  const [votingMatch, setVotingMatch] = useState<string | null>(null);
  const [predictBusyMatch, setPredictBusyMatch] = useState<string | null>(null);

  const [pulseStatus, setPulseStatus] = useState<PulseStatus | null>(null);
  const [clientReady, setClientReady] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [sigils, setSigils] = useState(0);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [predictionStreak, setPredictionStreak] = useState(0);
  const [liveDuels, setLiveDuels] = useState<DuelRowData[]>([]);
  const [liveDuelCount, setLiveDuelCount] = useState(0);
  const [voteConfirmToast, setVoteConfirmToast] = useState<{ visible: boolean; rarity: string | null; pulseTick: number }>({
    visible: false,
    rarity: null,
    pulseTick: 0,
  });
  const voteConfirmToastTimerRef = React.useRef<number | null>(null);
  const voteTapCooldownUntilRef = React.useRef(0);
  const restoreBlockedLogRef = React.useRef(false);
  const [segment, setSegment] = useState<Segment>('voting');
  const [activeIndex, setActiveIndex] = useState(0);
  const [displayLockedMatchId, setDisplayLockedMatchId] = useState<string | null>(null);
  const [displayLockedMatch, setDisplayLockedMatch] = useState<ArenaMatch | null>(null);
  const [hasRestoredTournamentVoteState, setHasRestoredTournamentVoteState] = useState(initialFixtureMode);
  const [showDebugControls, setShowDebugControls] = useState(initialDebugMode);
  const [isFixtureDebugMode, setIsFixtureDebugMode] = useState(initialFixtureMode);
  const [isAdminOperator, setIsAdminOperator] = useState(false);
  const [adminStatusLoaded, setAdminStatusLoaded] = useState(false);
  const [adminActionBusy, setAdminActionBusy] = useState<'refresh' | 'seed' | 'reset' | null>(null);
  const [voteAuthGate, setVoteAuthGate] = useState<{ matchId: string; catId: string } | null>(null);
  const [voteSessionCount, setVoteSessionCount] = useState(0);
  const [tournamentLocalTotalsByMatchId, setTournamentLocalTotalsByMatchId] = useState<Record<string, { votes_a: number; votes_b: number; total_votes: number }>>({});
  const [currentPulseVoteCount, setCurrentPulseVoteCount] = useState(0);
  const [matchResultReveal, setMatchResultReveal] = useState<{
    matchId: string;
    outcome: 'win' | 'loss';
    votedCatId: string | null;
    winningCatId: string | null;
    boosted: boolean;
    boostAmount: number | null;
    sigilsDelta: number | null;
    streakActive: boolean;
    flameProtected: boolean;
    revealSeen: boolean;
  } | null>(null);
  const [pulseResults, setPulseResults] = useState<{
    pulseId: string;
    votes: number;
    bonus: number;
    flameMaintained: boolean;
    predictionWins: number;
    predictionLosses: number;
    sigilDelta: number;
    streakAfter: number | null;
  } | null>(null);
  const [lastVotedPulseId, setLastVotedPulseId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem('catclash:last-voted-pulse');
  });
  const voteStateScope = 'tournament:active';

  useEffect(() => {
    setClientReady(true);
  }, []);

  useEffect(() => {
    if (initialFixtureMode) return;
    void load();
  }, [initialFixtureMode]);
  useEffect(() => {
    let cancelled = false;
    async function loadAdminStatus() {
      try {
        const adminStatus = await fetch('/api/admin/operator/status', { cache: 'no-store' })
          .then((r) => r.json().catch(() => ({})))
          .catch(() => ({}));
        if (!cancelled) {
          setIsAdminOperator(Boolean(adminStatus?.isAdmin));
        }
      } finally {
        if (!cancelled) setAdminStatusLoaded(true);
      }
    }
    void loadAdminStatus();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => { void refreshLiveDuels(); }, []);
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      setShowDebugControls(false);
      setIsFixtureDebugMode(false);
      return;
    }
    if (typeof window === 'undefined') {
      setShowDebugControls(false);
      setIsFixtureDebugMode(false);
      return;
    }
    const params = new URLSearchParams(window.location.search || '');
    setShowDebugControls(params.get('debug') === '1');
    setIsFixtureDebugMode(params.get('fixture') === '1' || params.get('debug') === '1');
  }, []);

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
    if (!options.preserveVotedMatches) setHasRestoredTournamentVoteState(false);
    try {
      const fixtureDebugQuery = normalizeFixtureDebugQuery();
      const forceClientFixture = fixtureDebugQuery.includes('fixture=1') || fixtureDebugQuery.includes('debug=1');
      if (forceClientFixture) {
        const [meData, adminStatus] = await Promise.all([
          fetch('/api/me', { cache: 'no-store' })
          .then((r) => r.json().catch(() => ({})))
          .catch(() => ({})),
          fetch('/api/admin/operator/status', { cache: 'no-store' })
            .then((r) => r.json().catch(() => ({})))
            .catch(() => ({})),
        ]);
        setHasCredentials(Boolean(meData?.data?.has_credentials));
        setIsAdminOperator(Boolean(adminStatus?.isAdmin));
        setAdminStatusLoaded(true);
        const fixtureArenas = buildClientFixtureArenas();
        const fixtureQueue = queueMatchesFromArenas(fixtureArenas);
        setArenas(fixtureArenas);
        setQueueMatches(fixtureQueue);
        setBracketQueue({
          currentRound: 1,
          matches: fixtureQueue,
        });
        setVotedMatches({});
        setResolvedVoteByMatchId({});
        setTournamentLocalTotalsByMatchId(() => {
          const next: Record<string, { votes_a: number; votes_b: number; total_votes: number }> = {};
          for (const match of fixtureQueue) {
            const matchId = String(match.match_id || '').trim();
            if (!matchId) continue;
            const votesA = Math.max(0, Number(match.votes_a || 0));
            const votesB = Math.max(0, Number(match.votes_b || 0));
            next[matchId] = {
              votes_a: votesA,
              votes_b: votesB,
              total_votes: Math.max(0, Number(match.total_votes ?? votesA + votesB)),
            };
          }
          return next;
        });
        setHasRestoredTournamentVoteState(true);
        return;
      }
      const [res, me, adminStatus] = await Promise.all([
        fetch(`/api/tournament/active${fixtureDebugQuery}`, { cache: 'no-store' }),
        fetch('/api/me', { cache: 'no-store' }),
        fetch('/api/admin/operator/status', { cache: 'no-store' }),
      ]);
      const data = await res.json().catch(() => ({}));
      const meData = await me.json().catch(() => ({}));
      const adminData = await adminStatus.json().catch(() => ({}));
      setHasCredentials(Boolean(meData?.data?.has_credentials));
      setIsAdminOperator(Boolean(adminData?.isAdmin));
      setAdminStatusLoaded(true);
      const activeArenas = nextArenasFromLoad(data);
      const activeTournamentId = String(activeArenas?.[0]?.tournament_id || '').trim();
      const bracketData = activeTournamentId
        ? await fetch(`/api/tournament/${activeTournamentId}/bracket${fixtureDebugQuery}`, { cache: 'no-store' })
            .then((r) => r.json().catch(() => ({})))
            .catch(() => ({}))
        : null;
      const bracketMatches = Array.isArray(bracketData?.matches) ? (bracketData.matches as Array<any>) : [];
      const mappedBracketMatches: ArenaMatch[] = normalizeQueueMatches(bracketMatches
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
            user_voted_cat_id: match.user_voted_cat_id ? String(match.user_voted_cat_id) : null,
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
        .filter((match): match is ArenaMatch => !!match && !!match.match_id));

      const fallbackQueueMatches = queueMatchesFromArenas(activeArenas);
      const mappedQueueMatches = mappedBracketMatches.length > 0 ? mappedBracketMatches : fallbackQueueMatches;
      const preservedVotes = options.preserveVotedMatches;
      setArenas(activeArenas);
      setQueueMatches(mappedQueueMatches);
      const queueMatchIds = mappedQueueMatches.map((match) => String(match.match_id || '').trim()).filter(Boolean);
      const hydratedQueueVotes = await fetchVotesForCurrentQueue(queueMatchIds);
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[DEV][tournament-hydrate-queue]', {
          requestedMatchIds: queueMatchIds.length,
          hydratedVotes: Object.keys(hydratedQueueVotes).length,
          fromServer: hydratedQueueVotes,
        });
      }
      setTournamentLocalTotalsByMatchId((prev) => {
        const next = { ...prev };
        for (const match of mappedQueueMatches) {
          const matchId = String(match.match_id || '').trim();
          if (!matchId) continue;
          const votesA = Math.max(0, Number(match.votes_a || 0));
          const votesB = Math.max(0, Number(match.votes_b || 0));
          next[matchId] = mergeTournamentTotals(next[matchId], {
            votes_a: votesA,
            votes_b: votesB,
            total_votes: Math.max(0, Number(match.total_votes ?? (votesA + votesB))),
          }) || {
            votes_a: votesA,
            votes_b: votesB,
            total_votes: Math.max(0, Number(match.total_votes ?? (votesA + votesB))),
          };
        }
        return next;
      });
      setBracketQueue(
        mappedQueueMatches.length > 0
          ? {
              currentRound: Math.max(1, Number(bracketData?.tournament?.round || activeArenas?.[0]?.current_round || 1)),
              matches: mappedQueueMatches,
            }
          : null
      );
      const queueMatchVotesFromPayload = mappedQueueMatches.reduce<Record<string, string>>((acc, match) => {
        const matchId = String(match.match_id || '').trim();
        const votedCatId = String(match.user_voted_cat_id || '').trim();
        if (matchId && votedCatId) acc[matchId] = votedCatId;
        return acc;
      }, {});
      const queueServerVotes = pickQueueScopedVotes(queueMatchIds, [
        queueMatchVotesFromPayload,
        data.voted_matches || {},
        hydratedQueueVotes,
      ]);

      if (!preservedVotes) {
        const restoredVotes = pickQueueScopedVotes(queueMatchIds, [
          readVotedMatchesFromStorage(voteStateScope),
          queueServerVotes,
        ]);
        setVotedMatches(restoredVotes);
        setResolvedVoteByMatchId((prev) =>
          pickQueueScopedVotes(queueMatchIds, [
            prev,
            restoredVotes,
          ])
        );
        writeVotedMatchesToStorage(restoredVotes, voteStateScope);
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[DEV][tournament-voted-state-restored]', {
            restoredCount: Object.keys(restoredVotes).length,
            serverCount: Object.keys(data.voted_matches || {}).length,
            queueScopedCount: queueMatchIds.length,
          });
          console.debug('[DEV][tournament-restore-source]', {
            requestedMatchCount: queueMatchIds.length,
            queueServerVoteCount: Object.keys(queueServerVotes).length,
            localStorageVoteCount: Object.keys(readVotedMatchesFromStorage(voteStateScope)).length,
            finalRestoredCount: Object.keys(restoredVotes).length,
          });
        }
      } else {
        const mergedPreserved = pickQueueScopedVotes(queueMatchIds, [preservedVotes, queueServerVotes]);
        setVotedMatches(mergedPreserved);
        setResolvedVoteByMatchId((prev) => pickQueueScopedVotes(queueMatchIds, [prev, mergedPreserved]));
        writeVotedMatchesToStorage(mergedPreserved, voteStateScope);
      }
      setHasRestoredTournamentVoteState(true);
      setSigils(meData?.data?.progress?.sigils || 0);
      setPredictionStreak(meData?.data?.prediction_streak || data?.prediction_meta?.current_streak || 0);
    } finally {
      if (!options.silent) setLoading(false);
    }
  }

  async function handleDebugRefresh(resetVotesFirst = false) {
    if (process.env.NODE_ENV === 'production') return;
    console.debug('[DEV][tournament-refresh-click]', { resetVotesFirst });
    try {
      setDisplayLockedMatchId(null);
      setDisplayLockedMatch(null);
      setResolvedVoteByMatchId({});
      setVotingMatch(null);
      if (resetVotesFirst && typeof window !== 'undefined') {
        const resetFn = (window as any).__catclashResetVotes;
        if (typeof resetFn === 'function') {
          await resetFn();
          console.debug('[DEV][tournament-refresh-complete]', { resetVotesFirst, via: 'window.__catclashResetVotes' });
          return;
        }
      }
      await load({ silent: false });
      console.debug('[DEV][tournament-refresh-complete]', { resetVotesFirst, via: 'load' });
    } catch {
      console.debug('[DEV][tournament-refresh-complete]', { resetVotesFirst, via: 'error' });
    }
  }

  async function handleAdminArenaAction(action: 'refresh' | 'seed' | 'reset') {
    if (!isAdminOperator || adminActionBusy) return;
    setAdminActionBusy(action);
    try {
      if (action === 'reset') {
        if (process.env.NODE_ENV === 'production') return;
        const res = await fetch('/api/dev/reset-votes', { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) throw new Error(String(data?.error || 'Reset failed'));
        showGlobalToast('Vote test state reset', 1600);
        await load({ silent: true });
        return;
      }
      const endpoint = action === 'refresh'
        ? '/api/admin/operator/refresh-matches'
        : '/api/admin/operator/seed-matches';
      const payload = action === 'seed'
        ? { tournamentType: 'both', seedCount: 16, prioritizeNew: true }
        : { resolveRounds: false };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(String(data?.error || 'Admin action failed'));
      showGlobalToast(action === 'refresh' ? 'Matches refreshed' : 'Matches seeded', 1700);
      await load({ silent: true, preserveVotedMatches: votedMatches });
    } catch (error) {
      showGlobalToast(String((error as any)?.message || 'Admin action failed'), 2200);
    } finally {
      setAdminActionBusy(null);
    }
  }

  function bumpVoteAnimTick(matchId: string) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[TOURNAMENT_VOTE_ANIM_TICK]', { matchId });
    }
    setVoteAnimTickByMatchId((prev) => ({ ...prev, [matchId]: (prev[matchId] || 0) + 1 }));
  }

  function stageResolvedVote(matchId: string, catId: string) {
    setResolvedVoteByMatchId((prev) => ({ ...prev, [matchId]: catId }));
  }

  function clearResolvedVote(matchId: string) {
    setResolvedVoteByMatchId((prev) => {
      if (!prev[matchId]) return prev;
      const next = { ...prev };
      delete next[matchId];
      return next;
    });
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

  async function refreshLiveDuels() {
    try {
      const res = await fetch('/api/duel/challenges', { cache: 'no-store' });
      const duel = await res.json().catch(() => ({}));
      if (!res.ok || !duel?.ok) {
        setLiveDuelCount(0);
        setLiveDuels([]);
        return;
      }
      const open = Array.isArray(duel.open) ? duel.open : [];
      setLiveDuelCount(countLiveDuels(open));
      setLiveDuels(rankLiveDuels(open));
    } catch {
      setLiveDuelCount(0);
      setLiveDuels([]);
    }
  }

  function mergeTotals(rows: Array<{ match_id: string; votes_a: number; votes_b: number; total_votes: number }> | null | undefined) {
    if (!Array.isArray(rows) || rows.length === 0) return;
    setTournamentLocalTotalsByMatchId((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        const matchId = String(row?.match_id || '').trim();
        if (!matchId) continue;
        const votesA = Math.max(0, Number(row?.votes_a || 0));
        const votesB = Math.max(0, Number(row?.votes_b || 0));
        next[matchId] = mergeTournamentTotals(next[matchId], {
          votes_a: votesA,
          votes_b: votesB,
          total_votes: Math.max(0, Number(row?.total_votes ?? (votesA + votesB))),
        }) || {
          votes_a: votesA,
          votes_b: votesB,
          total_votes: Math.max(0, Number(row?.total_votes ?? (votesA + votesB))),
        };
      }
      return next;
    });
  }

  async function refreshAggregates(matchIds: string[]) {
    const ids = Array.from(new Set((matchIds || []).map((id) => String(id || '').trim()).filter(Boolean))).slice(0, 10);
    if (!ids.length) return;
    try {
      const res = await fetch('/api/matches/aggregates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchIds: ids }),
      });
      const payload = await res.json().catch(() => null);
      mergeTotals(Array.isArray(payload?.data) ? payload.data : []);
    } catch {}
  }

  async function handleVote(matchId: string, catId: string) {
    if (!hasCredentials) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[DEV][tournament-guest-vote-auth-gate]', { matchId, catId, hasCredentials });
      }
      setVoteAuthGate({ matchId: String(matchId || ''), catId: String(catId || '') });
      return;
    }
    const now = Date.now();
    if (now < voteTapCooldownUntilRef.current) {
      if (process.env.NODE_ENV !== 'production') {
        showGlobalToast('Too fast — try the next tap in a second', 1200);
      }
      return;
    }
    voteTapCooldownUntilRef.current = now + (process.env.NODE_ENV !== 'production' ? 1200 : 900);
    if (votingMatch || votedMatches[matchId]) return;
    const arenaMatch = findArenaMatch(arenas, matchId) || queueMatches.find((m) => m.match_id === matchId) || null;
    const originalSnapshot = tournamentLocalTotalsByMatchId[matchId]
      ? calcSnapshot(
          Number(tournamentLocalTotalsByMatchId[matchId].votes_a || 0),
          Number(tournamentLocalTotalsByMatchId[matchId].votes_b || 0)
        )
      : arenaMatch
        ? calcSnapshot(arenaMatch.votes_a, arenaMatch.votes_b)
        : null;
    setVotingMatch(matchId);
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(12);
    }
    try {
      const r = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: matchId, voted_for: catId }),
      });
      const data = await r.json().catch(() => null);
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[TOURNAMENT_VOTE_RESOLVE]', {
          matchId,
          ok: !!data?.ok,
          status: r.status,
          error: data?.error || null,
          alreadyVoted: !!data?.alreadyVoted,
          votes_a: data?.votes_a ?? data?.votesA ?? null,
          votes_b: data?.votes_b ?? data?.votesB ?? null,
        });
      }
      if (!r.ok || !data?.ok) {
        const msg = data?.error || 'Vote failed';
        if (r.status === 429 || msg.toLowerCase().includes('rate')) {
          if (process.env.NODE_ENV !== 'production') {
            console.debug('[DEV][tournament-vote-rate-limit]', { matchId, status: r.status, error: msg });
          }
          showGlobalToast('Too fast — try the next tap in a second', 1500);
        } else if (msg.toLowerCase().includes('locked')) {
          setVotedMatches((p) => {
            const next = { ...p };
            delete next[matchId];
            return next;
          });
          const lockCopy = formatPulseTime(pulseStatus?.nextPulseAtUtc || data?.resolves_at || data?.vote_locks_at);
          showGlobalToast(lockCopy ? `Voting reopens ${lockCopy}` : 'Voting is locked for this pulse', 2600);
          void load({ silent: true });
        } else if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('duplicate')) {
          const resolvedSnapshot = resolveVoteSnapshot(data, originalSnapshot);
          if (resolvedSnapshot) {
            setTournamentLocalTotalsByMatchId((prev) => ({
              ...prev,
              [matchId]: {
                votes_a: resolvedSnapshot.votes_a,
                votes_b: resolvedSnapshot.votes_b,
                total_votes: resolvedSnapshot.total_votes,
              },
            }));
          }
          stageResolvedVote(matchId, catId);
          if (process.env.NODE_ENV !== 'production') {
            const remaining = activeVotingList.filter((m) => String(m.match_id || '') !== matchId);
            const nextIdx = remaining.length > 0 ? Math.min(activeIndex, Math.max(0, remaining.length - 1)) : 0;
            const nextMatchId = remaining[nextIdx]?.match_id || null;
            console.debug('[DEV][tournament-next-match]', { nextMatchId, filteredCount: remaining.length });
          }
          setVotedMatches((prev) => {
            const next = { ...prev, [matchId]: catId };
            if (process.env.NODE_ENV !== 'production') {
              console.debug('[DEV][vote-state-updated]', {
                matchId,
                votedCatId: catId,
                votedMatchIds: Object.keys(next),
              });
            }
            return next;
          });
          void refreshAggregates([matchId]);
          window.setTimeout(() => clearResolvedVote(matchId), 700);
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
        const alreadyVotedSync = !!data?.alreadyVoted;
        const resolvedSnapshot = resolveVoteSnapshot(data, originalSnapshot);
        if (resolvedSnapshot) {
          if (alreadyVotedSync) {
            setTournamentLocalTotalsByMatchId((prev) => ({
              ...prev,
              [matchId]: {
                votes_a: resolvedSnapshot.votes_a,
                votes_b: resolvedSnapshot.votes_b,
                total_votes: resolvedSnapshot.total_votes,
              },
            }));
          } else {
            setTournamentLocalTotalsByMatchId((prev) => ({
              ...prev,
              [matchId]: mergeTournamentTotals(prev[matchId], {
                votes_a: resolvedSnapshot.votes_a,
                votes_b: resolvedSnapshot.votes_b,
                total_votes: resolvedSnapshot.total_votes,
              }) || {
                votes_a: resolvedSnapshot.votes_a,
                votes_b: resolvedSnapshot.votes_b,
                total_votes: resolvedSnapshot.total_votes,
              },
            }));
          }
        }
        if (alreadyVotedSync && process.env.NODE_ENV !== 'production') {
          const prevTotals = tournamentLocalTotalsByMatchId[matchId] || originalSnapshot || null;
          console.debug('[DEV][already-voted-sync]', {
            matchId,
            previous: prevTotals ? { votes_a: prevTotals.votes_a, votes_b: prevTotals.votes_b, total_votes: prevTotals.total_votes } : null,
            server: resolvedSnapshot ? { votes_a: resolvedSnapshot.votes_a, votes_b: resolvedSnapshot.votes_b, total_votes: resolvedSnapshot.total_votes } : null,
            animationSkipped: true,
          });
        }
        if (!alreadyVotedSync && process.env.NODE_ENV !== 'production') {
          const prevTotals = tournamentLocalTotalsByMatchId[matchId] || originalSnapshot || null;
          console.debug('[DEV][fresh-vote-accepted]', {
            matchId,
            previous: prevTotals ? { votes_a: prevTotals.votes_a, votes_b: prevTotals.votes_b, total_votes: prevTotals.total_votes } : null,
            server: resolvedSnapshot ? { votes_a: resolvedSnapshot.votes_a, votes_b: resolvedSnapshot.votes_b, total_votes: resolvedSnapshot.total_votes } : null,
            animationSkipped: false,
          });
        }
        stageResolvedVote(matchId, catId);
        if (!alreadyVotedSync) bumpVoteAnimTick(matchId);
        const holdMs = alreadyVotedSync ? 0 : 850;
        if (!alreadyVotedSync) {
          const lockedMatchCandidate = (activeMatch && String(activeMatch.match_id || '') === matchId)
            ? activeMatch
            : (arenaMatch && String(arenaMatch.match_id || '') === matchId ? arenaMatch : null);
          setDisplayLockedMatch(lockedMatchCandidate);
          setDisplayLockedMatchId(matchId);
          if (process.env.NODE_ENV !== 'production') {
            console.debug('[DEV][tournament-display-lock-start]', { matchId, holdMs });
          }
        }
        if (!alreadyVotedSync && process.env.NODE_ENV !== 'production') {
          console.debug('[DEV][fresh-vote-hold]', { matchId, holdMs });
        }
        if (holdMs > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, holdMs));
          setDisplayLockedMatch(null);
          setDisplayLockedMatchId(null);
          if (process.env.NODE_ENV !== 'production') {
            console.debug('[DEV][tournament-display-lock-end]', { matchId });
          }
        }
        if (process.env.NODE_ENV !== 'production') {
          const remaining = activeVotingList.filter((m) => String(m.match_id || '') !== matchId);
          const nextIdx = remaining.length > 0 ? Math.min(activeIndex, Math.max(0, remaining.length - 1)) : 0;
          const nextMatchId = remaining[nextIdx]?.match_id || null;
          console.debug('[DEV][tournament-next-match]', { nextMatchId, filteredCount: remaining.length });
        }
        setVotedMatches((prev) => {
          const next = { ...prev, [matchId]: catId };
          if (process.env.NODE_ENV !== 'production') {
            console.debug('[DEV][vote-state-updated]', {
              matchId,
              votedCatId: catId,
              votedMatchIds: Object.keys(next),
            });
          }
          return next;
        });
        void refreshAggregates([matchId]);
        window.setTimeout(() => clearResolvedVote(matchId), 700);
        if (!alreadyVotedSync) setVoteSessionCount((prev) => prev + 1);
        const freshAcceptedVote = !data?.alreadyVoted && !String(data?.error || '').toLowerCase().includes('already') && !String(data?.error || '').toLowerCase().includes('duplicate');
        if (pulse.state === 'live' && freshAcceptedVote) {
          const votedPulseId = pulse.pulseId;
          setCurrentPulseVoteCount((prev) => prev + 1);
          setLastVotedPulseId(votedPulseId);
          window.localStorage.setItem('catclash:last-voted-pulse', votedPulseId);
        }
        const votedCatRarity =
          arenaMatch?.cat_a?.id === catId ? arenaMatch?.cat_a?.rarity
          : arenaMatch?.cat_b?.id === catId ? arenaMatch?.cat_b?.rarity
          : null;
        setVoteConfirmToast((prev) => ({
          visible: true,
          rarity: votedCatRarity || prev.rarity || null,
          pulseTick: prev.pulseTick + 1,
        }));
        if (!alreadyVotedSync) {
          if (voteConfirmToastTimerRef.current) window.clearTimeout(voteConfirmToastTimerRef.current);
          voteConfirmToastTimerRef.current = window.setTimeout(() => {
            setVoteConfirmToast((prev) => ({ ...prev, visible: false }));
          }, 2000);
          if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate(10);
          }
        } else {
          showGlobalToast('Already voted ✅', 1800);
        }
      }
    } catch {
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

  useEffect(() => {
    return () => {
      if (voteConfirmToastTimerRef.current) window.clearTimeout(voteConfirmToastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    writeVotedMatchesToStorage(votedMatches, voteStateScope);
  }, [votedMatches]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    (window as any).__catclashResetVotes = async () => {
      try {
        const res = await fetch('/api/dev/reset-votes', { method: 'POST' });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok || !payload?.ok) {
          // eslint-disable-next-line no-console
          console.error('[DEV] vote reset failed', payload);
          showGlobalToast('Vote reset failed', 1600);
          return payload;
        }
        const toDelete: string[] = [];
        for (let i = 0; i < window.localStorage.length; i += 1) {
          const key = window.localStorage.key(i);
          if (!key) continue;
          if (key.startsWith('catclash:voted_matches:')) toDelete.push(key);
        }
        toDelete.forEach((key) => window.localStorage.removeItem(key));
        window.localStorage.removeItem('catclash:last-voted-pulse');
        setVotedMatches({});
        setResolvedVoteByMatchId({});
        setVoteAnimTickByMatchId({});
        setVoteSessionCount(0);
        setCurrentPulseVoteCount(0);
        setPulseResults(null);
        setVotingMatch(null);
        await load({ silent: true });
        // eslint-disable-next-line no-console
        console.info('[DEV] votes reset for current tester');
        showGlobalToast('Votes reset for current tester', 1600);
        return payload;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[DEV] vote reset failed', error);
        showGlobalToast('Vote reset failed', 1600);
        return { ok: false, error: 'network_error' };
      }
    };
    // eslint-disable-next-line no-console
    console.info('[DEV] call window.__catclashResetVotes() to reset current tester votes');
    return () => {
      try {
        delete (window as any).__catclashResetVotes;
      } catch {}
    };
  }, []);

  async function handlePredict(matchId: string, catId: string, bet: number): Promise<boolean> {
    if (predictBusyMatch) return false;
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
        return false;
      } else {
        setSigils(data.sigils_after ?? sigils);
        setPredictionStreak(data.current_streak ?? predictionStreak);
        showGlobalToast(`Prediction locked (-${bet})`, 2200);
        void load({ silent: true });
        return true;
      }
    } catch {
      showGlobalToast('Network error', 2200);
      return false;
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
  const pulse = useMemo(() => getVirtualPulse(nowTs), [nowTs]);
  const isFlameLitForPulse = lastVotedPulseId === pulse.pulseId;
  const getVotedSignalForMatch = (matchId: string, match?: ArenaMatch | null) => {
    if (isFixtureDebugMode) return { votedCatId: null, reason: 'fixture_debug_override' as const };
    const localResolved = resolvedVoteByMatchId[matchId];
    if (localResolved) return { votedCatId: localResolved, reason: 'resolvedVoteByMatchId' as const };
    const localVoted = votedMatches[matchId];
    if (localVoted) return { votedCatId: localVoted, reason: 'votedMatches' as const };
    const serverVoted = match?.user_voted_cat_id || null;
    if (serverVoted) return { votedCatId: serverVoted, reason: 'match.user_voted_cat_id' as const };
    return { votedCatId: null, reason: null };
  };
  const isMatchAlreadyVoted = (matchId: string, match?: ArenaMatch | null) => !!getVotedSignalForMatch(matchId, match).votedCatId;
  const isAlreadyVoted = (match: ArenaMatch) => isMatchAlreadyVoted(String(match.match_id || ''), match);

  useEffect(() => {
    setCurrentPulseVoteCount(0);
    setPulseResults(null);
  }, [pulse.pulseId]);

  const arenaView = useMemo(() => {
    const getVotedCatIdForMatch = (match: ArenaMatch) => {
      const matchId = String(match.match_id || '');
      if (!matchId) return null;
      return getVotedSignalForMatch(matchId, match).votedCatId;
    };
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
        voted: !!getVotedCatIdForMatch(match),
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
    };
  }, [isFixtureDebugMode, primaryArena, pulseLocked, resolvedVoteByMatchId, votedMatches]);

  const filteredQueue = useMemo(() => {
    if (!hasRestoredTournamentVoteState) return [] as ArenaMatch[];
    const sourceMatches = queueMatches || [];
    const sourceRound = Math.max(1, Number(primaryArena?.current_round || 1));
    return sourceMatches.filter((match) => {
      const id = String(match?.match_id || '');
      if (!id || isBye(match)) return false;
      const votedSignal = getVotedSignalForMatch(id, match);
      if (isAlreadyVoted(match)) {
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[DEV][tournament-skip-voted-match]', { matchId: id, reason: votedSignal.reason, votedCatId: votedSignal.votedCatId });
        }
        return false;
      }
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
  }, [hasRestoredTournamentVoteState, isFixtureDebugMode, primaryArena?.current_round, primaryArena?.rounds, pulseLocked, queueMatches, resolvedVoteByMatchId, votedMatches]);

  const availableSegments = useMemo(() => {
    const segments: Segment[] = ['voting'];
    if (arenaView.upcoming.length > 0) segments.push('upcoming');
    if (arenaView.results.length > 0) segments.push('results');
    return segments;
  }, [arenaView.upcoming.length, arenaView.results.length]);

  const activeVotingList = hasRestoredTournamentVoteState
    ? filteredQueue
    : (isFixtureDebugMode ? normalizeQueueMatches(queueMatches || []) : []);
  const hasUnvotedMatchesInQueue = activeVotingList.length > 0;
  const lockedMatch = displayLockedMatch;
  const activeList = segment === 'voting'
    ? activeVotingList
    : segment === 'upcoming'
      ? arenaView.upcoming
      : arenaView.results;
  const baseActiveMatch = activeList[Math.min(activeIndex, Math.max(0, activeList.length - 1))] || null;
  const isRenderBlockedBeforeRestore = segment === 'voting' && !hasRestoredTournamentVoteState && !isFixtureDebugMode;
  const fixtureForcedMatch =
    isFixtureDebugMode && segment === 'voting' && !lockedMatch
      ? (baseActiveMatch || normalizeQueueMatches(queueMatches || [])[0] || queueMatchesFromArenas(buildClientFixtureArenas())[0] || null)
      : null;
  const activeMatch = isRenderBlockedBeforeRestore
    ? null
    : segment === 'voting' && lockedMatch
      ? lockedMatch
      : (fixtureForcedMatch || baseActiveMatch);
  const renderedMatchIdsSig = useMemo(
    () => activeList.slice(0, 10).map((match) => String(match.match_id || '')).filter(Boolean).join(','),
    [activeList]
  );
  const isEmptyVoting = segment === 'voting' && hasRestoredTournamentVoteState && !activeMatch;
  const isCaughtUpForPulse = segment === 'voting' && !isRenderBlockedBeforeRestore && hasRestoredTournamentVoteState && !hasUnvotedMatchesInQueue;
  const pulseCompletedCount = Math.max(0, Number(pulseResults?.votes ?? currentPulseVoteCount ?? 0));
  const showResultRevealPanel = segment === 'voting' && pulse.state === 'resolving' && !!pulseResults && pulseCompletedCount > 0;
  const showMatchResultRevealPanel = segment === 'voting' && !!matchResultReveal;
  const showCaughtUpPanel = segment === 'voting' && isCaughtUpForPulse && !showResultRevealPanel && !showMatchResultRevealPanel;
  const hasActiveVotingMatch = segment === 'voting'
    && !isRenderBlockedBeforeRestore
    && (hasRestoredTournamentVoteState || isFixtureDebugMode)
    && hasUnvotedMatchesInQueue
    && !!activeMatch;
  const hasRemainingMatches = arenaView.summary.remainingCount > 0;
  const hasOpenMatches = arenaView.summary.openCount > 0;
  const allRemainingLocked = arenaView.summary.allRemainingLocked;
  const debugTournamentCounts = useMemo(() => {
    const votedCount = Math.max(0, Number(arenaView.summary.votedCount || 0));
    const openCount = Math.max(0, Number(arenaView.summary.openCount || 0));
    const lockedRemainingCount = Math.max(0, Number(arenaView.summary.lockedRemainingCount || 0));
    const currentRoundTotal = Math.max(0, Number(arenaView.summary.playableCount || 0));
    const resolvedCount = Math.max(0, Number(arenaView.results.length || 0));
    const msRemaining = Math.max(0, Number(pulse.msRemaining || 0));
    const formulaTotal = votedCount + openCount + lockedRemainingCount;
    const countFormulaValid = currentRoundTotal === formulaTotal;
    const countdownTarget = pulseStatus?.nextPulseAtUtc || null;
    const countdownEndsAt = countdownTarget || null;
    return {
      currentRoundTotal,
      votedCount,
      openCount,
      lockedRemainingCount,
      resolvedCount,
      countFormulaValid,
      formulaTotal,
      countdownTarget,
      countdownMsRemaining: msRemaining,
      countdownEndsAt,
      pulseState: pulse.state,
      resultRevealVisible: showResultRevealPanel,
      matchResultRevealVisible: showMatchResultRevealPanel,
    };
  }, [arenaView.results.length, arenaView.summary.lockedRemainingCount, arenaView.summary.openCount, arenaView.summary.playableCount, arenaView.summary.votedCount, pulse.msRemaining, pulse.state, pulseStatus?.nextPulseAtUtc, showMatchResultRevealPanel, showResultRevealPanel]);
  const predictionOutcomeSummary = useMemo(() => {
    let wins = 0;
    let losses = 0;
    let sigilDelta = 0;
    for (const match of arenaView.results) {
      const winnerId = String(match.winner_id || '').trim();
      const predictedId = String(match.user_prediction?.predicted_cat_id || '').trim();
      if (!winnerId || !predictedId) continue;
      const bet = Math.max(0, Number(match.user_prediction?.bet_sigils || 0));
      if (winnerId === predictedId) {
        wins += 1;
        sigilDelta += bet;
      } else {
        losses += 1;
        sigilDelta -= bet;
      }
    }
    const streakAfter = wins > 0 ? predictionStreak + wins : losses > 0 ? 0 : null;
    return { wins, losses, sigilDelta, streakAfter };
  }, [arenaView.results, predictionStreak]);

  useEffect(() => {
    if (pulse.state !== 'resolving') return;
    setPulseResults((prev) => {
      if (prev?.pulseId === pulse.pulseId) return prev;
      return {
        pulseId: pulse.pulseId,
        votes: currentPulseVoteCount,
        bonus: Math.floor(currentPulseVoteCount / 3),
        flameMaintained: isFlameLitForPulse,
        predictionWins: predictionOutcomeSummary.wins,
        predictionLosses: predictionOutcomeSummary.losses,
        sigilDelta: predictionOutcomeSummary.sigilDelta,
        streakAfter: predictionOutcomeSummary.streakAfter,
      };
    });
  }, [currentPulseVoteCount, isFlameLitForPulse, predictionOutcomeSummary, pulse.pulseId, pulse.state]);

  useEffect(() => {
    if (segment !== 'voting') return;
    if (matchResultReveal) return;
    const storage = typeof window !== 'undefined' ? window.sessionStorage : null;
    for (const match of arenaView.results) {
      const matchId = String(match.match_id || '').trim();
      if (!matchId) continue;
      const seenKey = `catclash:result-reveal:${matchId}`;
      if (storage?.getItem(seenKey) === '1') continue;
      const votedCatId = getVotedSignalForMatch(matchId, match).votedCatId;
      const boostAmount = Math.max(0, Number(match.user_prediction?.bet_sigils || 0));
      const boosted = boostAmount > 0;
      if (!votedCatId && !boosted) continue;
      const winningCatId = String(match.winner_id || '').trim() || null;
      if (!winningCatId) continue;
      const referenceCatId = boosted
        ? String(match.user_prediction?.predicted_cat_id || '').trim()
        : String(votedCatId || '').trim();
      if (!referenceCatId) continue;
      const outcome: 'win' | 'loss' = referenceCatId === winningCatId ? 'win' : 'loss';
      const revealPayload = {
        matchId,
        outcome,
        votedCatId: votedCatId || null,
        winningCatId,
        boosted,
        boostAmount: boosted ? boostAmount : null,
        sigilsDelta: boosted ? (outcome === 'win' ? boostAmount : -boostAmount) : 0,
        streakActive: predictionStreak > 0,
        flameProtected: isFlameLitForPulse,
        revealSeen: false,
      };
      setMatchResultReveal(revealPayload);
      storage?.setItem(seenKey, '1');
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[DEV][tournament-match-result-reveal]', revealPayload);
      }
      break;
    }
  }, [arenaView.results, getVotedSignalForMatch, isFlameLitForPulse, matchResultReveal, predictionStreak, segment]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const votedMatchIds = Object.keys(votedMatches || {});
    console.debug('[DEV][queue-after-filter]', {
      before: queueMatches.length,
      after: activeVotingList.length,
      votedMatchIds,
    });
    console.debug('[DEV][tournament-filtered-queue]', {
      rawCount: queueMatches.length,
      filteredCount: activeVotingList.length,
      activeIndex,
      restored: hasRestoredTournamentVoteState,
    });
    if (isCaughtUpForPulse) {
      console.debug('[DEV][tournament-caught-up]', {
        filteredActiveCount: activeVotingList.length,
        rawQueueCount: activeVotingList.length,
        activeIndex,
        pulseState: pulse.state,
        currentPulseVoteCount,
      });
    }
  }, [activeIndex, activeVotingList.length, currentPulseVoteCount, hasRestoredTournamentVoteState, isCaughtUpForPulse, pulse.state, queueMatches.length, votedMatches]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (!isRenderBlockedBeforeRestore) {
      restoreBlockedLogRef.current = false;
      return;
    }
    if (restoreBlockedLogRef.current) return;
    restoreBlockedLogRef.current = true;
    console.debug('[DEV][tournament-render-blocked-before-restore]');
  }, [isRenderBlockedBeforeRestore]);

  useEffect(() => {
    if (!hasRestoredTournamentVoteState) return;
    if (displayLockedMatch) return;
    if (!displayLockedMatchId) return;
    const lockStillValid = activeVotingList.some((m) => String(m.match_id || '') === displayLockedMatchId);
    if (!lockStillValid && !votingMatch) {
      setDisplayLockedMatchId(null);
    }
  }, [activeVotingList, displayLockedMatch, displayLockedMatchId, hasRestoredTournamentVoteState, votingMatch]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (segment !== 'voting') return;
    if (hasActiveVotingMatch) return;
    if (activeVotingList.length <= 0) return;
    console.debug('[DEV][tournament-fallback-blocked]', {
      filteredActiveCount: activeVotingList.length,
      rawQueueCount: activeVotingList.length,
      activeIndex,
    });
  }, [activeIndex, activeVotingList.length, hasActiveVotingMatch, segment]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (!displayLockedMatchId) return;
    console.debug('[DEV][tournament-render-locked]', { matchId: displayLockedMatchId });
  }, [displayLockedMatchId]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (!displayLockedMatchId || !lockedMatch) return;
    console.debug('[DEV][tournament-display-lock-hit]', { matchId: displayLockedMatchId });
  }, [displayLockedMatchId, lockedMatch]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (!displayLockedMatch) return;
    const lockedMatchId = String(displayLockedMatch.match_id || '');
    const renderedMatchId = activeMatch ? String(activeMatch.match_id || '') : null;
    const mismatch = renderedMatchId !== lockedMatchId;
    console.debug('[DEV][tournament-display-lock-rendering]', {
      lockedMatchId,
      renderedMatchId,
      mismatch,
    });
    if (mismatch) {
      console.warn('[DEV][tournament-display-lock-rendering]', {
        lockedMatchId,
        renderedMatchId,
        mismatch,
      });
    }
  }, [activeMatch, displayLockedMatch]);

  const activeMatchId = activeMatch ? String(activeMatch.match_id || '') : null;
  const totalsMatchId = activeMatchId && tournamentLocalTotalsByMatchId[activeMatchId] ? activeMatchId : null;
  const activeRenderTotals = totalsMatchId ? tournamentLocalTotalsByMatchId[totalsMatchId] : null;

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    console.debug('[DEV][tournament-active-card]', {
      activeMatchId,
      totalsMatchId,
      filteredCount: activeVotingList.length,
    });
    if (activeMatchId && totalsMatchId && activeMatchId !== totalsMatchId) {
      console.error('[DEV][tournament-render-mismatch]', {
        activeMatchId,
        totalsMatchId,
      });
    }
  }, [activeMatchId, activeVotingList.length, totalsMatchId]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    console.debug('[DEV][tournament-bracket-cta]', { href: BRACKET_CTA_HREF });
  }, [BRACKET_CTA_HREF]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    console.debug('[TOURNAMENT_STATE_DEBUG]', {
      votableCount: activeVotingList.length,
      votableMatchIds: activeVotingList.map((m) => String(m.match_id || '')).filter(Boolean),
      renderedSpotlightCount: hasActiveVotingMatch ? 1 : 0,
    });
  }, [activeVotingList, hasActiveVotingMatch]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (typeof window === 'undefined') return;
    if (!showDebugControls && !isFixtureDebugMode) return;
    (window as any).__catclashTournamentDebug = debugTournamentCounts;
  }, [debugTournamentCounts, isFixtureDebugMode, showDebugControls]);

  useEffect(() => {
    setActiveIndex(0);
  }, [segment]);

  useEffect(() => {
    if (!hasRestoredTournamentVoteState) return;
    setActiveIndex(0);
  }, [hasRestoredTournamentVoteState]);

  useEffect(() => {
    const ids = renderedMatchIdsSig.split(',').filter(Boolean);
    if (!ids.length) return;
    let cancelled = false;
    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch('/api/matches/aggregates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchIds: ids }),
        });
        const payload = await res.json().catch(() => null);
        if (cancelled) return;
        mergeTotals(Array.isArray(payload?.data) ? payload.data : []);
      } catch {}
    };
    void tick();
    const timer = window.setInterval(tick, 6000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [renderedMatchIdsSig]);

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

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (voteAuthGate) {
      root.setAttribute('data-vote-auth-gate-open', '1');
    } else {
      root.removeAttribute('data-vote-auth-gate-open');
    }
    return () => {
      root.removeAttribute('data-vote-auth-gate-open');
    };
  }, [voteAuthGate]);

  if (loading) {
    return (
      <LoadingState
        fullPage
        icon="⚔️"
        message="Loading tournament..."
        className="min-h-screen bg-[#08090d] text-white"
        phrases={[
          'Finding worthy opponents...',
          'Balancing the matchup...',
          'Summoning contenders...',
          'Checking live vote states...'
        ]}
      />
    );
  }

  const emptyCopy = spotlightEmptyCopy(segment);
  const currentRoundLabel = primaryArena ? formatTournamentRoundLabel(primaryArena.current_round) : 'No active round';

  return (
    <div className="min-h-screen bg-[#08090d] px-4 pb-8 pt-4 sm:pt-5 text-white">
      {voteAuthGate ? (
        <div className="fixed inset-0 z-[2200] bg-black/70 backdrop-blur-sm px-4 py-6 flex items-end sm:items-center justify-center">
          <div data-testid="vote-auth-gate" className="w-full max-w-sm rounded-2xl border border-cyan-300/25 bg-[linear-gradient(180deg,rgba(6,15,30,0.96),rgba(4,10,22,0.98))] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
            <p className="text-sm font-bold text-white">Lock in your vote</p>
            <p className="mt-1 text-xs text-white/70">Create an account to save votes, earn sigils, and build your flame.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                href={`/login?next=${encodeURIComponent(`/?resume_vote_match=${encodeURIComponent(voteAuthGate.matchId)}&resume_vote_cat=${encodeURIComponent(voteAuthGate.catId)}&resume_vote_src=tournament`)}`}
                data-testid="vote-auth-gate-cta"
                className="h-10 rounded-xl bg-cyan-400 text-black text-xs font-bold inline-flex items-center justify-center"
              >
                Create / Login
              </Link>
              <button
                type="button"
                onClick={() => setVoteAuthGate(null)}
                data-testid="vote-auth-gate-dismiss"
                className="h-10 rounded-xl border border-white/15 bg-white/5 text-xs font-semibold text-white/85"
              >
                Keep browsing
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className={`mx-auto max-w-3xl ${isEmptyVoting ? 'space-y-2.5' : showCaughtUpPanel || showResultRevealPanel || showMatchResultRevealPanel ? 'space-y-3' : 'space-y-3.5'}`}>
        {showDebugControls ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-2">
            <p className="px-1 text-[11px] font-semibold text-white/65">
              ADMIN: {isAdminOperator ? 'true' : 'false'}{adminStatusLoaded ? '' : ' (loading)'}
            </p>
            <button
              type="button"
              onClick={() => { void handleDebugRefresh(false); }}
              className="h-8 rounded-lg border border-cyan-300/30 bg-cyan-500/15 px-3 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-500/25"
            >
              Refresh Matches
            </button>
            <button
              type="button"
              onClick={() => { void handleDebugRefresh(true); }}
              className="h-8 rounded-lg border border-amber-300/30 bg-amber-500/15 px-3 text-[11px] font-semibold text-amber-100 transition hover:bg-amber-500/25"
            >
              Reset Votes + Refresh
            </button>
            <button
              type="button"
              data-testid="vote-a-debug"
              onClick={() => {
                const matchId = String(activeMatch?.match_id || 'debug-fixture-main');
                const catId = String(activeMatch?.cat_a?.id || 'debug-fixture-cat-a');
                if (process.env.NODE_ENV !== 'production') {
                  console.debug('[DEV][tournament-debug-vote-click]', { side: 'a', hasCredentials, matchId, catId });
                }
                if (!hasCredentials) {
                  setVoteAuthGate({
                    matchId,
                    catId,
                  });
                  return;
                }
                void handleVote(matchId, catId);
              }}
              className="h-8 rounded-lg border border-emerald-300/30 bg-emerald-500/15 px-3 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-500/25"
            >
              Vote A (Debug)
            </button>
            <button
              type="button"
              data-testid="vote-b-debug"
              onClick={() => {
                const matchId = String(activeMatch?.match_id || 'debug-fixture-main');
                const catId = String(activeMatch?.cat_b?.id || 'debug-fixture-cat-b');
                if (process.env.NODE_ENV !== 'production') {
                  console.debug('[DEV][tournament-debug-vote-click]', { side: 'b', hasCredentials, matchId, catId });
                }
                if (!hasCredentials) {
                  setVoteAuthGate({
                    matchId,
                    catId,
                  });
                  return;
                }
                void handleVote(matchId, catId);
              }}
              className="h-8 rounded-lg border border-fuchsia-300/30 bg-fuchsia-500/15 px-3 text-[11px] font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/25"
            >
              Vote B (Debug)
            </button>
            <div
              data-testid="tournament-count-debug"
              className="w-full rounded-lg border border-white/10 bg-black/25 px-2 py-1 text-[10px] text-white/65"
            >
              currentRoundTotal={debugTournamentCounts.currentRoundTotal} voted={debugTournamentCounts.votedCount} open={debugTournamentCounts.openCount} resolved={debugTournamentCounts.resolvedCount} msRemaining={clientReady ? debugTournamentCounts.countdownMsRemaining : '—'}
            </div>
          </div>
        ) : null}
        {isAdminOperator ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-500/[0.08] p-2">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-100/85">Admin Arena Controls</p>
            <button
              type="button"
              disabled={adminActionBusy !== null}
              onClick={() => { void handleAdminArenaAction('refresh'); }}
              className="h-8 rounded-lg border border-amber-200/20 bg-black/25 px-3 text-[11px] font-semibold text-amber-100 transition hover:bg-black/35 disabled:opacity-60"
            >
              {adminActionBusy === 'refresh' ? 'Refreshing...' : 'Refresh Matches'}
            </button>
            <button
              type="button"
              disabled={adminActionBusy !== null}
              onClick={() => { void handleAdminArenaAction('seed'); }}
              className="h-8 rounded-lg border border-amber-200/20 bg-black/25 px-3 text-[11px] font-semibold text-amber-100 transition hover:bg-black/35 disabled:opacity-60"
            >
              {adminActionBusy === 'seed' ? 'Seeding...' : 'Seed Matches'}
            </button>
            {process.env.NODE_ENV !== 'production' && showDebugControls ? (
              <button
                type="button"
                disabled={adminActionBusy !== null}
                onClick={() => { void handleAdminArenaAction('reset'); }}
                className="h-8 rounded-lg border border-amber-200/20 bg-black/25 px-3 text-[11px] font-semibold text-amber-100 transition hover:bg-black/35 disabled:opacity-60"
              >
                {adminActionBusy === 'reset' ? 'Resetting...' : 'Reset Vote Test State'}
              </button>
            ) : null}
          </div>
        ) : null}
        {(!activeMatch || segment !== 'voting') ? (
          <div className={`tournament-info-module rounded-[1.7rem] border border-white/[0.05] bg-[linear-gradient(135deg,rgba(88,28,135,0.08),rgba(34,211,238,0.04))] shadow-[0_14px_28px_rgba(0,0,0,0.18)] ${isEmptyVoting ? 'p-3 opacity-90' : 'p-3.5'}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="tournament-status-pill inline-flex items-center gap-1 rounded-full border border-violet-300/14 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-100/82">
                  <Sparkles className="h-3.5 w-3.5" />
                  Whisker Arena
                </div>
                <p className="mt-2 text-sm font-semibold text-white">Whisker Arena is coming soon for faster ranked repeat battles.</p>
              </div>
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="tournament-primary-link inline-flex h-11 shrink-0 cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-cyan-300/12 bg-cyan-500/8 px-4 text-sm font-semibold text-cyan-50/72 opacity-80"
              >
                <Swords className="h-4 w-4" />
                Coming Soon
              </button>
            </div>
          </div>
        ) : null}

        <section className="tournament-spotlight-shell rounded-[2rem] border border-white/[0.06] bg-white/[0.025] p-3 shadow-[0_16px_36px_rgba(0,0,0,0.28)] sm:p-4">
          <div className="mb-3 flex items-center justify-end">
            <span className={`tournament-round-pill shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${primaryArena ? 'border-white/[0.08] bg-white/[0.05] text-white/80' : 'border-white/[0.05] bg-white/[0.03] text-white/40'}`}>
              {currentRoundLabel}
            </span>
          </div>

          {showMatchResultRevealPanel ? (
            <div className="tournament-empty-state rounded-[1.6rem] border border-emerald-300/16 bg-[linear-gradient(135deg,rgba(16,185,129,0.08),rgba(30,41,59,0.36))] p-6 text-center">
              <p className="text-base font-semibold text-emerald-100">
                {matchResultReveal?.outcome === 'win' ? '🏆 Match Result: Win' : '💥 Match Result: Loss'}
              </p>
              <p className="mt-1 text-sm text-white/80">
                {matchResultReveal?.boosted ? 'Boost resolved' : 'Vote resolved'}
                {typeof matchResultReveal?.sigilsDelta === 'number'
                  ? ` · Sigils ${matchResultReveal.sigilsDelta > 0 ? `+${matchResultReveal.sigilsDelta}` : matchResultReveal.sigilsDelta}`
                  : ''}
              </p>
              <p className="mt-1 text-xs text-white/62">
                {matchResultReveal?.flameProtected ? 'Flame protected 🔥' : 'Flame at risk'}
                {matchResultReveal?.streakActive ? ' · Streak active' : ''}
              </p>
              <button
                type="button"
                onClick={() => {
                  setMatchResultReveal((prev) => (prev ? { ...prev, revealSeen: true } : prev));
                  setTimeout(() => setMatchResultReveal(null), 0);
                }}
                className="mt-4 inline-flex h-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.045] px-4 text-sm font-semibold text-white/88 transition hover:bg-white/[0.08]"
              >
                Continue
              </button>
            </div>
          ) : showResultRevealPanel ? (
            <div className="tournament-empty-state rounded-[1.6rem] border border-amber-300/16 bg-[linear-gradient(135deg,rgba(251,191,36,0.08),rgba(30,41,59,0.36))] p-6 text-center">
              <p className="text-base font-semibold text-amber-100">✨ Pulse Results</p>
              <p className="mt-1 text-sm text-white/80">You completed {pulseCompletedCount} matches</p>
              {(pulseResults?.predictionWins || pulseResults?.predictionLosses) ? (
                <p className="mt-1 text-xs text-white/68">
                  {pulseResults?.predictionWins || 0} correct · {pulseResults?.predictionLosses || 0} missed
                </p>
              ) : null}
              {Number(pulseResults?.sigilDelta || 0) !== 0 ? (
                <p className="mt-1 text-xs text-white/68">
                  Sigils {Number(pulseResults?.sigilDelta || 0) > 0 ? `+${pulseResults?.sigilDelta}` : pulseResults?.sigilDelta}
                </p>
              ) : null}
              {typeof pulseResults?.streakAfter === 'number' ? (
                <p className="mt-1 text-xs text-white/68">Streak now {pulseResults.streakAfter}</p>
              ) : null}
              {pulseResults?.flameMaintained || isFlameLitForPulse ? (
                <p className="mt-1 text-xs text-amber-200/90">Flame maintained 🔥</p>
              ) : null}
              <p className="mt-1 text-xs text-white/58">Next pulse opens soon</p>
              <Link
                href={BRACKET_CTA_HREF}
                className="mt-4 inline-flex h-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.045] px-4 text-sm font-semibold text-white/88 transition hover:bg-white/[0.08]"
              >
                View Bracket
              </Link>
            </div>
          ) : showCaughtUpPanel ? (
            <div className="tournament-empty-state rounded-[1.6rem] border border-white/[0.08] bg-[linear-gradient(140deg,rgba(34,211,238,0.08),rgba(15,23,42,0.44))] p-6 text-center">
              <p className="text-base font-semibold text-white">🔥 You’re caught up</p>
              <p className="mt-1 text-sm text-white/78">No open matches right now</p>
              <p className="mt-1 text-xs text-white/58">Next pulse opens soon</p>
              {currentPulseVoteCount > 0 ? (
                <p className="mt-2 text-xs text-white/62">You voted on {currentPulseVoteCount} matches this pulse</p>
              ) : null}
              {isFlameLitForPulse || currentPulseVoteCount > 0 ? (
                <p className="mt-1 text-xs text-amber-200/90">Flame maintained 🔥</p>
              ) : null}
              <Link
                href={BRACKET_CTA_HREF}
                className="mt-4 inline-flex h-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.045] px-4 text-sm font-semibold text-white/88 transition hover:bg-white/[0.08]"
              >
                View Bracket
              </Link>
            </div>
          ) : !hasRestoredTournamentVoteState && segment === 'voting' ? (
            <div className="tournament-empty-state rounded-[1.6rem] border border-white/[0.06] bg-white/[0.02] p-8 text-center">
              <p className="text-sm font-semibold text-white/78">Loading voting queue…</p>
            </div>
          ) : hasActiveVotingMatch ? (
            <SpotlightMatchCard
              key={activeMatch.match_id}
              match={activeMatch}
              renderTotals={activeRenderTotals}
              mode={segment}
              pulseResumeAt={pulseStatus?.nextPulseAtUtc || null}
              isFlameLitForPulse={isFlameLitForPulse}
              voted={isFixtureDebugMode ? null : (resolvedVoteByMatchId[activeMatch.match_id] || votedMatches[activeMatch.match_id] || null)}
              isVoting={votingMatch === activeMatch.match_id}
              predictBusy={predictBusyMatch === activeMatch.match_id}
              availableSigils={sigils}
              activeIndex={activeIndex}
              total={activeList.length}
              voteSessionCount={voteSessionCount}
              voteAnimTick={voteAnimTickByMatchId[activeMatch.match_id] || 0}
              hasCredentials={hasCredentials}
              onVote={handleVote}
              onPredict={handlePredict}
              onPrev={() => setActiveIndex((prev) => Math.max(0, prev - 1))}
              onNext={() => setActiveIndex((prev) => Math.min(activeList.length - 1, prev + 1))}
            />
          ) : segment === 'voting' ? (
            <div className="tournament-empty-state rounded-[1.6rem] border border-white/[0.08] bg-[linear-gradient(140deg,rgba(34,211,238,0.08),rgba(15,23,42,0.44))] p-6 text-center">
              <p className="text-base font-semibold text-white">🔥 You’re caught up</p>
              <p className="mt-1 text-sm text-white/78">No open matches right now</p>
              <p className="mt-1 text-xs text-white/58">Next pulse opens soon</p>
              {currentPulseVoteCount > 0 ? (
                <p className="mt-2 text-xs text-white/62">You voted on {currentPulseVoteCount} matches this pulse</p>
              ) : null}
              {isFlameLitForPulse || currentPulseVoteCount > 0 ? (
                <p className="mt-1 text-xs text-amber-200/90">Flame maintained 🔥</p>
              ) : null}
              <Link
                href={BRACKET_CTA_HREF}
                className="mt-4 inline-flex h-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.045] px-4 text-sm font-semibold text-white/88 transition hover:bg-white/[0.08]"
              >
                View Bracket
              </Link>
            </div>
          ) : (
            <div className="tournament-empty-state rounded-[1.6rem] border border-white/[0.06] bg-white/[0.02] p-8 text-center">
              <Target className="mx-auto mb-2 h-8 w-8 text-white/40" />
              <p className="text-sm font-semibold text-white/78">
                {emptyCopy.title}
              </p>
              <p className="mt-1 text-xs text-white/48">
                {emptyCopy.subtitle}
              </p>
            </div>
          )}
        </section>

        <LiveDuelsTicker duels={liveDuels} liveDuelCount={liveDuelCount} />

        <div className={isEmptyVoting ? 'opacity-90' : ''}>
          <TournamentBracket arena={primaryArena} votedMatches={votedMatches} pulseLocked={pulseLocked} />
        </div>
      </div>
      <VoteConfirmToast
        visible={voteConfirmToast.visible}
        rarity={voteConfirmToast.rarity}
        pulseTick={voteConfirmToast.pulseTick}
      />
    </div>
  );
}
