'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Clock3, Swords, Target, ChevronRight } from 'lucide-react';
import SigilIcon from './icons/SigilIcon';
import { showGlobalToast } from '../lib/global-toast';
import { thumbUrlForCat } from '../lib/cat-images';

interface ArenaCat {
  id: string;
  name: string;
  image_url: string | null;
  rarity: string;
  stats?: { attack: number; defense: number; speed: number; charisma: number; chaos: number };
}

interface ArenaMatch {
  match_id: string;
  cat_a: ArenaCat;
  cat_b: ArenaCat;
  votes_a: number;
  votes_b: number;
  status: string;
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

interface QuestRow {
  id: string;
  label: string;
  progress: number;
  target: number;
  reward: number;
  done: boolean;
}

interface HomeDashboardData {
  quests: { daily: QuestRow[]; weekly: QuestRow[] };
  highlights: Array<{ id: string; title: string; subtitle: string; created_at: string }>;
}

type Segment = 'voting' | 'upcoming' | 'results';

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

function statPower(c: ArenaCat): number {
  const s = c.stats || { attack: 0, defense: 0, speed: 0, charisma: 0, chaos: 0 };
  const rarityBoost = c.rarity === 'Mythic' ? 1.1 : c.rarity === 'Legendary' ? 1.08 : c.rarity === 'Epic' ? 1.05 : c.rarity === 'Rare' ? 1.03 : 1;
  return (s.attack * 1.25 + s.defense * 1.15 + s.speed * 1.2 + s.charisma * 0.9 + s.chaos * 1.1) * rarityBoost;
}

function MatchRow({
  match,
  voted,
  isVoting,
  predictBusy,
  availableSigils,
  onVote,
  onPredict,
}: {
  match: ArenaMatch;
  voted: string | null;
  isVoting: boolean;
  predictBusy: boolean;
  availableSigils: number;
  onVote: (matchId: string, catId: string) => void;
  onPredict: (matchId: string, catId: string, bet: number) => void;
}) {
  const done = match.status === 'complete';
  const hasVoted = !!voted;
  const canVote = !done && !hasVoted && !isVoting;
  const predictedCatId = match.user_prediction?.predicted_cat_id || null;
  const [bet, setBet] = useState(10);

  const aPower = statPower(match.cat_a);
  const bPower = statPower(match.cat_b);
  const strongerA = aPower >= bPower;
  const edgePct = Math.min(35, Math.round((Math.abs(aPower - bPower) / Math.max(1, Math.max(aPower, bPower))) * 100));

  return (
    <div className="rounded-2xl bg-white/[0.04] shadow-[0_8px_30px_rgba(0,0,0,0.25)] p-3 active:scale-[0.995] transition-transform">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <img src={catImg(match.cat_a)} alt={match.cat_a.name} loading="lazy" decoding="async" className="w-11 h-11 rounded-xl object-cover" />
            <div className="min-w-0">
              <Link href={`/cat/${match.cat_a.id}`} className="block text-sm font-semibold truncate">{match.cat_a.name}</Link>
              <p className={`text-[11px] ${rarityColor(match.cat_a.rarity)}`}>{match.cat_a.rarity}</p>
            </div>
          </div>
          {canVote && (
            <button onClick={() => onVote(match.match_id, match.cat_a.id)} className="mt-2 h-11 w-full rounded-xl bg-blue-500/20 text-blue-200 text-sm font-semibold">
              {isVoting ? 'Voting...' : 'Vote A'}
            </button>
          )}
        </div>

        <div className="text-[10px] text-white/60 font-semibold">VS</div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <img src={catImg(match.cat_b)} alt={match.cat_b.name} loading="lazy" decoding="async" className="w-11 h-11 rounded-xl object-cover" />
            <div className="min-w-0">
              <Link href={`/cat/${match.cat_b.id}`} className="block text-sm font-semibold truncate">{match.cat_b.name}</Link>
              <p className={`text-[11px] ${rarityColor(match.cat_b.rarity)}`}>{match.cat_b.rarity}</p>
            </div>
          </div>
          {canVote && (
            <button onClick={() => onVote(match.match_id, match.cat_b.id)} className="mt-2 h-11 w-full rounded-xl bg-red-500/20 text-red-200 text-sm font-semibold">
              {isVoting ? 'Voting...' : 'Vote B'}
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-white/60">
        <span>{match.is_close_match ? 'Close Match' : 'Prediction Open'}</span>
        <span>{match.votes_a}-{match.votes_b} votes</span>
      </div>

      <div className="mt-1">
        {edgePct <= 3 ? (
          <span className="inline-flex px-2 py-0.5 rounded-full bg-white/10 text-[10px] text-white/75">Stat Edge: Balanced</span>
        ) : (
          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] ${strongerA ? 'bg-blue-500/20 text-blue-200' : 'bg-red-500/20 text-red-200'}`}>
            Stat Edge: {strongerA ? 'A' : 'B'} +{edgePct}%
          </span>
        )}
      </div>

      {!done && (
        <div className="mt-2">
          <div className="flex gap-1.5 mb-1.5">
            {[5, 10, 15, 20].map((chip) => (
              <button
                key={`${match.match_id}-${chip}`}
                disabled={chip > availableSigils || !!predictedCatId}
                onClick={() => setBet(chip)}
                className={`h-9 px-3 rounded-full text-xs border ${bet === chip ? 'border-amber-300 text-amber-200 bg-amber-500/15' : 'border-white/15 text-white/70 bg-white/5'} disabled:opacity-40`}
              >
                {chip}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={!!predictedCatId || predictBusy || bet > availableSigils}
              onClick={() => onPredict(match.match_id, match.cat_a.id, bet)}
              className="h-11 rounded-xl bg-blue-500/15 text-blue-200 text-xs font-semibold disabled:opacity-40"
            >
              {predictedCatId === match.cat_a.id ? (
                <span className="inline-flex items-center justify-center gap-1">
                  Predicted
                  <span className="inline-flex items-center gap-0.5">
                    +
                    <SigilIcon className="w-3 h-3" />
                    {match.user_prediction?.bet_sigils || bet}
                  </span>
                </span>
              ) : (
                <span className="inline-flex items-center justify-center gap-1">
                  Predict A
                  <span className="inline-flex items-center gap-0.5">
                    (
                    +
                    <SigilIcon className="w-3 h-3" />
                    {bet}
                    )
                  </span>
                </span>
              )}
            </button>
            <button
              disabled={!!predictedCatId || predictBusy || bet > availableSigils}
              onClick={() => onPredict(match.match_id, match.cat_b.id, bet)}
              className="h-11 rounded-xl bg-red-500/15 text-red-200 text-xs font-semibold disabled:opacity-40"
            >
              {predictedCatId === match.cat_b.id ? (
                <span className="inline-flex items-center justify-center gap-1">
                  Predicted
                  <span className="inline-flex items-center gap-0.5">
                    +
                    <SigilIcon className="w-3 h-3" />
                    {match.user_prediction?.bet_sigils || bet}
                  </span>
                </span>
              ) : (
                <span className="inline-flex items-center justify-center gap-1">
                  Predict B
                  <span className="inline-flex items-center gap-0.5">
                    (
                    +
                    <SigilIcon className="w-3 h-3" />
                    {bet}
                    )
                  </span>
                </span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TournamentPage() {
  const [loading, setLoading] = useState(true);
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [votedMatches, setVotedMatches] = useState<Record<string, string>>({});
  const [votingMatch, setVotingMatch] = useState<string | null>(null);
  const [predictBusyMatch, setPredictBusyMatch] = useState<string | null>(null);

  const [refreshCountdown, setRefreshCountdown] = useState('');
  const [sigils, setSigils] = useState(0);
  const [predictionStreak, setPredictionStreak] = useState(0);
  const [dashboard, setDashboard] = useState<HomeDashboardData | null>(null);
  const [segment, setSegment] = useState<Segment>('voting');

  useEffect(() => { load(); }, []);

  useEffect(() => {
    function tickCountdown() {
      const now = new Date();
      const next = new Date(now);
      next.setUTCMinutes(0, 0, 0);
      next.setUTCHours(next.getUTCHours() + 1);
      const diffMs = Math.max(0, next.getTime() - now.getTime());
      const totalSec = Math.floor(diffMs / 1000);
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      setRefreshCountdown(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
    }
    tickCountdown();
    const id = setInterval(tickCountdown, 1000);
    return () => clearInterval(id);
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [res, me, home] = await Promise.all([
        fetch('/api/tournament/active', { cache: 'no-store' }),
        fetch('/api/me', { cache: 'no-store' }),
        fetch('/api/home/dashboard', { cache: 'no-store' }),
      ]);
      const data = await res.json().catch(() => ({}));
      const meData = await me.json().catch(() => ({}));
      const homeData = await home.json().catch(() => ({}));

      setArenas(data.arenas || []);
      setVotedMatches(data.voted_matches || {});
      setSigils(meData?.data?.progress?.sigils || 0);
      setPredictionStreak(meData?.data?.prediction_streak || data?.prediction_meta?.current_streak || 0);
      if (home.ok && homeData?.ok) {
        setDashboard({
          quests: homeData.quests || { daily: [], weekly: [] },
          highlights: homeData.highlights || [],
        });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVote(matchId: string, catId: string) {
    if (votingMatch || votedMatches[matchId]) return;
    setVotingMatch(matchId);
    try {
      const r = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: matchId, voted_for: catId }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) {
        const msg = data?.error || 'Vote failed';
        if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('duplicate')) {
          setVotedMatches((p) => ({ ...p, [matchId]: catId }));
        }
        showGlobalToast(msg, 2200);
      } else {
        setVotedMatches((p) => ({ ...p, [matchId]: catId }));
        showGlobalToast('Vote recorded', 2200);
        await load();
      }
    } catch {
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
        showGlobalToast(data?.error || 'Prediction failed', 2200);
      } else {
        setSigils(data.sigils_after ?? sigils);
        setPredictionStreak(data.current_streak ?? predictionStreak);
        showGlobalToast(`Prediction locked (-${bet})`, 2200);
        await load();
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

  const arenaView = useMemo(() => {
    if (!primaryArena) {
      return { voting: [] as ArenaMatch[], upcoming: [] as ArenaMatch[], results: [] as ArenaMatch[] };
    }
    const currentRound = primaryArena.rounds.find((r) => r.round === primaryArena.current_round);
    const voting = (currentRound?.matches || []).filter((m) => !isBye(m) && m.status === 'active');
    const upcoming = (primaryArena.rounds.find((r) => r.round > primaryArena.current_round)?.matches || []).filter((m) => !isBye(m));
    const results = [...primaryArena.rounds]
      .reverse()
      .flatMap((r) => r.matches || [])
      .filter((m) => !isBye(m) && m.status === 'complete');
    return { voting, upcoming, results };
  }, [primaryArena]);

  const activeList = segment === 'voting' ? arenaView.voting : segment === 'upcoming' ? arenaView.upcoming : arenaView.results;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08090d] text-white flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08090d] text-white px-4 pt-24 pb-8">

      <div className="max-w-2xl mx-auto space-y-4">
        <section className="rounded-3xl p-4 bg-gradient-to-br from-cyan-500/20 via-cyan-400/10 to-transparent border border-cyan-300/25 shadow-[0_16px_35px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">Arena Voting Hub</h1>
              <p className="text-xs text-white/70 mt-1">Vote here, then jump into Whisker for battles.</p>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-200 text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" /> Live
            </span>
          </div>

          <Link href="/tournament" className="mt-3 h-12 rounded-2xl bg-cyan-300 text-black font-semibold text-sm inline-flex items-center justify-center w-full gap-2 transition-transform hover:-translate-y-0.5 active:translate-y-0">
            <Swords className="w-4 h-4" />
            Open Whisker Arena
          </Link>

          <div className="mt-3 rounded-2xl border border-white/12 bg-black/35 backdrop-blur px-2 py-2">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="h-11 rounded-full bg-gradient-to-r from-amber-400/20 to-yellow-300/5 border border-amber-200/20 px-3 flex items-center justify-between transition-transform hover:-translate-y-0.5">
                <span className="text-white/70">Sigils</span>
                <span className="font-semibold text-white inline-flex items-center gap-1"><SigilIcon className="w-3.5 h-3.5" />{sigils}</span>
              </div>
              <div className="h-11 rounded-full bg-gradient-to-r from-cyan-400/20 to-blue-300/5 border border-cyan-200/20 px-3 flex items-center justify-between transition-transform hover:-translate-y-0.5">
                <span className="text-white/70">Streak</span>
                <span className="font-semibold text-white">{predictionStreak}</span>
              </div>
              <div className="h-11 rounded-full bg-gradient-to-r from-emerald-400/20 to-teal-300/5 border border-emerald-200/20 px-3 flex items-center justify-center gap-1 text-white/85">
                <Clock3 className="w-3.5 h-3.5" />
                <span>{refreshCountdown}</span>
              </div>
            </div>
            <div className="mt-2 text-[11px] text-white/60 flex items-center justify-end gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              auto-sync
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white/[0.03] shadow-[0_10px_25px_rgba(0,0,0,0.25)] p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">{primaryArena?.type === 'rookie' ? 'Rookie Arena' : 'Active Arena'}</h2>
            <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${primaryArena ? 'bg-white/10 text-white/80' : 'bg-white/5 text-white/40'}`}>
              {primaryArena ? `Round ${primaryArena.current_round}` : 'No active round'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            {(['voting', 'upcoming', 'results'] as Segment[]).map((s) => (
              <button
                key={s}
                onClick={() => setSegment(s)}
                className={`h-11 rounded-full text-xs font-semibold capitalize ${segment === s ? 'bg-white text-black' : 'bg-white/8 text-white/80'}`}
              >
                {s === 'voting' ? 'Voting Now' : s}
              </button>
            ))}
          </div>

          {activeList.length === 0 ? (
            <div className="rounded-2xl bg-white/[0.02] p-6 text-center">
              <Target className="w-7 h-7 text-white/40 mx-auto mb-2" />
              <p className="text-sm text-white/70">No {segment === 'voting' ? 'live' : segment} matchups yet.</p>
              <p className="text-xs text-white/45 mt-1">Check back shortly. New pairs roll in automatically.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeList.map((match) => (
                <MatchRow
                  key={match.match_id}
                  match={match}
                  voted={votedMatches[match.match_id] || null}
                  isVoting={votingMatch === match.match_id}
                  predictBusy={predictBusyMatch === match.match_id}
                  availableSigils={sigils}
                  onVote={handleVote}
                  onPredict={handlePredict}
                />
              ))}
            </div>
          )}
        </section>

        <details className="rounded-2xl bg-white/[0.03] p-3">
          <summary className="cursor-pointer h-11 px-2 rounded-xl flex items-center justify-between text-sm font-semibold">
            Quests
            <ChevronRight className="w-4 h-4 text-white/50" />
          </summary>
          <div className="pt-2 space-y-2">
            {[...(dashboard?.quests.daily || []), ...(dashboard?.quests.weekly || [])].map((q) => (
              <div key={q.id} className="rounded-xl bg-white/[0.03] p-2.5">
                <p className="text-sm font-medium">{q.label}</p>
                <p className="text-xs text-white/60 mt-0.5">{q.progress}/{q.target} · +{q.reward} XP</p>
              </div>
            ))}
            {(!(dashboard?.quests.daily || []).length && !(dashboard?.quests.weekly || []).length) && (
              <p className="text-xs text-white/55 px-1">No quests available right now.</p>
            )}
          </div>
        </details>

        <details className="rounded-2xl bg-white/[0.03] p-3">
          <summary className="cursor-pointer h-11 px-2 rounded-xl flex items-center justify-between text-sm font-semibold">
            Tutorial
            <ChevronRight className="w-4 h-4 text-white/50" />
          </summary>
          <div className="pt-2 space-y-2 text-xs text-white/80">
            <div className="rounded-xl bg-white/[0.03] p-2.5"><span className="font-semibold text-cyan-300">Vote:</span> pick your favorite cat in live matches.</div>
            <div className="rounded-xl bg-white/[0.03] p-2.5"><span className="font-semibold text-amber-300">Predict:</span> choose a side with sigils for payout.</div>
            <div className="rounded-xl bg-white/[0.03] p-2.5"><span className="font-semibold text-emerald-300">Whisker:</span> run interactive turn battles for progression.</div>
            <div className="rounded-xl bg-white/[0.03] p-2.5"><span className="font-semibold text-blue-300">Stat Edge:</span> quick hint showing matchup advantage.</div>
          </div>
        </details>

        <details className="rounded-2xl bg-white/[0.03] p-3">
          <summary className="cursor-pointer h-11 px-2 rounded-xl flex items-center justify-between text-sm font-semibold">
            Arena Highlights
            <ChevronRight className="w-4 h-4 text-white/50" />
          </summary>
          <div className="pt-2 space-y-2">
            {(dashboard?.highlights || []).slice(0, 8).map((h) => (
              <div key={h.id} className="rounded-xl bg-white/[0.03] p-2.5">
                <p className="text-sm font-medium">{h.title}</p>
                <p className="text-xs text-white/60 mt-0.5">{h.subtitle}</p>
              </div>
            ))}
            {!(dashboard?.highlights || []).length && <p className="text-xs text-white/55 px-1">No highlights yet. Battles are still warming up.</p>}
          </div>
        </details>
      </div>
    </div>
  );
}
