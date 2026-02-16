// REPLACE: app/page.tsx
'use client';

import React, { useState, useEffect } from "react";
import {
  Sparkles, Flame, Target, Zap, Gift, Loader2, Check,
  ArrowRight, Crown, Swords, Star,
} from "lucide-react";
import Link from "next/link";

// Types
interface UserProgress {
  xp: number;
  level: number;
  currentStreak: number;
}

interface ArenaCat {
  id: string;
  name: string;
  image_url: string | null;
  rarity: string;
}

interface ArenaMatch {
  match_id: string;
  cat_a: ArenaCat;
  cat_b: ArenaCat;
  votes_a: number;
  votes_b: number;
  status: string;
  winner_id?: string | null;
}

interface ArenaRound {
  round: number;
  matches: ArenaMatch[];
}

interface Arena {
  tournament_id: string;
  type: string;
  date: string;
  current_round: number;
  status: string;
  champion: ArenaCat | null;
  rounds: ArenaRound[];
}

// Config
const ARENA_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; accent: string; description: string }> = {
  main: {
    label: "Main Arena",
    icon: <Swords className="w-4 h-4" />,
    color: "border-yellow-500/30 bg-yellow-500/5",
    accent: "text-yellow-400",
    description: "The premier daily tournament. 8 cats enter, 1 champion emerges.",
  },
  rookie: {
    label: "Rookie Arena",
    icon: <Star className="w-4 h-4" />,
    color: "border-green-500/30 bg-green-500/5",
    accent: "text-green-400",
    description: "Fresh faces battle for glory. Every champion starts here.",
  },
};

function getArenaConfig(type: string) {
  return ARENA_CONFIG[type] || {
    label: type.charAt(0).toUpperCase() + type.slice(1) + " Arena",
    icon: <Target className="w-4 h-4" />,
    color: "border-purple-500/30 bg-purple-500/5",
    accent: "text-purple-400",
    description: "A special tournament bracket.",
  };
}

function getRarityColor(rarity: string): string {
  const colors: Record<string, string> = {
    Common: "text-gray-400", Rare: "text-blue-400", Epic: "text-purple-400",
    Legendary: "text-yellow-400", Mythic: "text-red-400", "God-Tier": "text-pink-400",
  };
  return colors[rarity] || "text-gray-400";
}

function getCatImage(cat: ArenaCat): string {
  return cat.image_url || "https://placekitten.com/300/300";
}

function getVotePercent(a: number, b: number): [number, number] {
  const total = a + b;
  if (total === 0) return [50, 50];
  return [Math.round((a / total) * 100), Math.round((b / total) * 100)];
}

function isByeMatch(match: ArenaMatch): boolean {
  return match.cat_a.id === match.cat_b.id;
}

// ── Match Card ── Images link to profile, vote buttons below
function MatchCard({
  match, voted, isVoting, onVote,
}: {
  match: ArenaMatch; voted: string | null; isVoting: boolean;
  onVote: (matchId: string, catId: string) => void;
}) {
  const [pctA, pctB] = getVotePercent(match.votes_a, match.votes_b);
  const totalVotes = match.votes_a + match.votes_b;
  const isComplete = match.status === "complete";
  const hasVoted = !!voted;
  const canVote = !hasVoted && !isVoting && !isComplete;

  // Dim entire card if voted OR complete
  const cardOpacity = (hasVoted || isComplete) ? "opacity-60" : "";

  return (
    <div className={`rounded-xl overflow-hidden bg-white/[0.03] border border-white/5 ${cardOpacity}`}>
      <div className="p-4">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
          {/* Cat A */}
          <div className="text-center">
            {/* Clickable image → cat profile */}
            <Link href={`/cat/${match.cat_a.id}`}>
              <div className={`relative h-28 sm:h-36 rounded-lg overflow-hidden bg-white/5 mb-2 transition-transform hover:scale-[1.03] ${voted === match.cat_a.id ? "ring-2 ring-blue-400" : ""}`}>
                <img src={getCatImage(match.cat_a)} alt={match.cat_a.name} className="w-full h-full object-cover object-center"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = "https://placekitten.com/300/300"; }} />
                {voted === match.cat_a.id && (
                  <div className="absolute top-1.5 right-1.5 bg-blue-500 rounded-full p-0.5"><Check className="w-3 h-3 text-white" /></div>
                )}
                {isComplete && match.winner_id === match.cat_a.id && (
                  <div className="absolute top-1.5 right-1.5 bg-yellow-500 rounded-full p-0.5"><Crown className="w-3 h-3 text-black" /></div>
                )}
              </div>
            </Link>
            <Link href={`/cat/${match.cat_a.id}`} className="font-bold text-xs truncate block hover:underline">{match.cat_a.name}</Link>
            <p className={`text-[10px] ${getRarityColor(match.cat_a.rarity)}`}>{match.cat_a.rarity}</p>

            {/* Vote button */}
            {canVote && (
              <button
                onClick={() => onVote(match.match_id, match.cat_a.id)}
                disabled={isVoting}
                className="mt-2 w-full py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs font-bold transition-colors disabled:opacity-50"
              >
                {isVoting ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "Vote"}
              </button>
            )}
            {hasVoted && voted === match.cat_a.id && (
              <div className="mt-2 w-full py-1.5 rounded-lg bg-blue-500/10 text-blue-400/60 text-xs font-bold flex items-center justify-center gap-1">
                <Check className="w-3 h-3" /> Voted
              </div>
            )}
          </div>

          {/* VS */}
          <div className="flex flex-col items-center pt-12">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <span className="text-xs font-bold text-white/50">VS</span>
            </div>
          </div>

          {/* Cat B */}
          <div className="text-center">
            <Link href={`/cat/${match.cat_b.id}`}>
              <div className={`relative h-28 sm:h-36 rounded-lg overflow-hidden bg-white/5 mb-2 transition-transform hover:scale-[1.03] ${voted === match.cat_b.id ? "ring-2 ring-red-400" : ""}`}>
                <img src={getCatImage(match.cat_b)} alt={match.cat_b.name} className="w-full h-full object-cover object-center"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = "https://placekitten.com/300/300"; }} />
                {voted === match.cat_b.id && (
                  <div className="absolute top-1.5 right-1.5 bg-red-500 rounded-full p-0.5"><Check className="w-3 h-3 text-white" /></div>
                )}
                {isComplete && match.winner_id === match.cat_b.id && (
                  <div className="absolute top-1.5 right-1.5 bg-yellow-500 rounded-full p-0.5"><Crown className="w-3 h-3 text-black" /></div>
                )}
              </div>
            </Link>
            <Link href={`/cat/${match.cat_b.id}`} className="font-bold text-xs truncate block hover:underline">{match.cat_b.name}</Link>
            <p className={`text-[10px] ${getRarityColor(match.cat_b.rarity)}`}>{match.cat_b.rarity}</p>

            {canVote && (
              <button
                onClick={() => onVote(match.match_id, match.cat_b.id)}
                disabled={isVoting}
                className="mt-2 w-full py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold transition-colors disabled:opacity-50"
              >
                {isVoting ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "Vote"}
              </button>
            )}
            {hasVoted && voted === match.cat_b.id && (
              <div className="mt-2 w-full py-1.5 rounded-lg bg-red-500/10 text-red-400/60 text-xs font-bold flex items-center justify-center gap-1">
                <Check className="w-3 h-3" /> Voted
              </div>
            )}
          </div>
        </div>

        {/* Vote bar */}
        {(hasVoted || totalVotes > 0 || isComplete) && (
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-white/40 mb-0.5">
              <span>{match.votes_a} ({pctA}%)</span>
              <span>{match.votes_b} ({pctB}%)</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden flex bg-white/5">
              <div className="bg-blue-500 transition-all duration-500" style={{ width: `${pctA}%` }} />
              <div className="bg-red-500 transition-all duration-500" style={{ width: `${pctB}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Arena Section ──
function ArenaSection({
  arena, votedMatches, votingMatch, onVote,
}: {
  arena: Arena; votedMatches: Record<string, string>;
  votingMatch: string | null; onVote: (matchId: string, catId: string) => void;
}) {
  const config = getArenaConfig(arena.type);
  const currentRound = arena.rounds.find((r) => r.round === arena.current_round);
  // Filter out bye matches (same cat vs itself)
  const realMatches = currentRound?.matches.filter((m) => !isByeMatch(m)) || [];
  const activeMatches = realMatches.filter((m) => m.status === "active");
  const completedMatches = realMatches.filter((m) => m.status === "complete");
  const unvoted = activeMatches.filter((m) => !votedMatches[m.match_id]);
  const votedActive = activeMatches.filter((m) => votedMatches[m.match_id]);
  const totalRounds = arena.rounds.length;

  return (
    <div className={`rounded-2xl border ${config.color} overflow-hidden`}>
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={config.accent}>{config.icon}</span>
          <h3 className="font-bold">{config.label}</h3>
          <span className="text-xs text-white/30 px-2 py-0.5 rounded-full bg-white/5">
            Round {arena.current_round}
          </span>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: Math.max(totalRounds, 3) }, (_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full ${
              i + 1 < arena.current_round ? "bg-green-400" :
              i + 1 === arena.current_round ? "bg-yellow-400" :
              "bg-white/10"
            }`} />
          ))}
        </div>
      </div>

      <div className="p-4">
        {arena.status === "complete" && arena.champion && (
          <div className="mb-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg overflow-hidden">
              <img src={getCatImage(arena.champion)} alt={arena.champion.name} className="w-full h-full object-cover object-center" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <Crown className="w-4 h-4 text-yellow-400" />
                <Link href={`/cat/${arena.champion.id}`} className="font-bold text-yellow-400 hover:underline">{arena.champion.name}</Link>
              </div>
              <p className="text-xs text-white/40">Tournament Champion</p>
            </div>
          </div>
        )}

        <p className="text-xs text-white/30 mb-3">{config.description}</p>

        {/* Unvoted active matches first */}
        {unvoted.length > 0 && (
          <div className="space-y-3 mb-3">
            {unvoted.map((match) => (
              <MatchCard key={match.match_id} match={match} voted={votedMatches[match.match_id] || null}
                isVoting={votingMatch === match.match_id} onVote={onVote} />
            ))}
          </div>
        )}

        {/* Voted active matches */}
        {votedActive.length > 0 && (
          <>
            {unvoted.length > 0 && (
              <div className="flex items-center gap-2 py-2">
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-[10px] text-white/20 flex items-center gap-1"><Check className="w-2.5 h-2.5" />Voted</span>
                <div className="flex-1 h-px bg-white/5" />
              </div>
            )}
            <div className="space-y-3">
              {votedActive.map((match) => (
                <MatchCard key={match.match_id} match={match} voted={votedMatches[match.match_id] || null}
                  isVoting={false} onVote={onVote} />
              ))}
            </div>
          </>
        )}

        {/* Completed matches */}
        {completedMatches.length > 0 && activeMatches.length > 0 && (
          <>
            <div className="flex items-center gap-2 py-2">
              <div className="flex-1 h-px bg-white/5" />
              <span className="text-[10px] text-white/20">Decided</span>
              <div className="flex-1 h-px bg-white/5" />
            </div>
            <div className="space-y-3">
              {completedMatches.map((match) => (
                <MatchCard key={match.match_id} match={match} voted={votedMatches[match.match_id] || null}
                  isVoting={false} onVote={onVote} />
              ))}
            </div>
          </>
        )}

        {activeMatches.length > 0 && unvoted.length === 0 && (
          <div className="text-center py-4 rounded-xl bg-white/[0.02] mt-3">
            <p className={`font-bold text-sm ${config.accent}`}>All caught up!</p>
            <p className="text-xs text-white/30 mt-0.5">Check back for the next round.</p>
          </div>
        )}

        {realMatches.length === 0 && arena.status !== "complete" && (
          <div className="text-center py-6 rounded-xl bg-white/[0.02]">
            <p className="text-white/40 text-sm">Waiting for next round...</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── API Helpers ──
async function fetchUserState() {
  try {
    const res = await fetch("/api/me");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");
    return data;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Server error" };
  }
}

async function fetchArenas(): Promise<{ arenas: Arena[]; votedMatches: Record<string, string> }> {
  try {
    const res = await fetch("/api/tournament/active", { cache: "no-store" });
    const data = await res.json();
    return { arenas: data.arenas || [], votedMatches: data.voted_matches || {} };
  } catch {
    return { arenas: [], votedMatches: {} };
  }
}

async function apiCheckin() {
  try {
    const res = await fetch("/api/checkin", { method: "POST", headers: { "Content-Type": "application/json" } });
    return await res.json();
  } catch (e) { return { error: e instanceof Error ? e.message : "Error" }; }
}

async function apiClaimCrate() {
  try {
    const res = await fetch("/api/crate/claim", { method: "POST", headers: { "Content-Type": "application/json" } });
    return await res.json();
  } catch (e) { return { error: e instanceof Error ? e.message : "Error" }; }
}

// ── Main Page ──
export default function Page() {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [votedMatches, setVotedMatches] = useState<Record<string, string>>({});
  const [votingMatch, setVotingMatch] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [claimingCrate, setClaimingCrate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [userData, arenaData] = await Promise.all([fetchUserState(), fetchArenas()]);
    if (!userData.error) {
      setProgress({
        xp: userData.data?.progress?.xp || 0,
        level: userData.data?.progress?.level || 1,
        currentStreak: userData.data?.streak?.current_streak || 0,
      });
    }
    setArenas(arenaData.arenas);
    setVotedMatches(arenaData.votedMatches);
    setLoading(false);
  }

  async function handleVote(matchId: string, catId: string) {
    if (votingMatch || votedMatches[matchId]) return;
    setVotingMatch(matchId);
    setError(null);
    try {
      const r = await fetch("/api/vote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId, voted_for: catId }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) {
        const msg = data?.error || "Vote failed";
        if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("duplicate")) {
          setVotedMatches((prev) => ({ ...prev, [matchId]: catId }));
        }
        showToast(msg);
      } else {
        setVotedMatches((prev) => ({ ...prev, [matchId]: catId }));
        showToast("Vote recorded! +5 XP");
        setProgress((prev) => prev ? { ...prev, xp: prev.xp + 5 } : null);
        const updated = await fetchArenas();
        setArenas(updated.arenas);
        setVotedMatches((prev) => ({ ...prev, ...updated.votedMatches }));
      }
    } catch { showToast("Network error"); }
    setVotingMatch(null);
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2500); }

  async function handleCheckin() {
    if (checkingIn) return;
    setCheckingIn(true);
    const result = await apiCheckin();
    if (result.error) setError(result.error);
    else if (result.already_checked_in) setError("Already checked in today");
    else if (result.current_streak) setProgress((p) => p ? { ...p, currentStreak: result.current_streak } : null);
    setCheckingIn(false);
  }

  async function handleClaimCrate() {
    if (claimingCrate) return;
    setClaimingCrate(true);
    const result = await apiClaimCrate();
    if (result.error) setError(result.error);
    else if (!result.success) setError(result.message || "Already claimed");
    else {
      const ud = await fetchUserState();
      if (!ud.error) setProgress((p) => p ? { ...p, xp: ud.data?.progress?.xp || p.xp } : null);
    }
    setClaimingCrate(false);
  }

  if (loading) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-white/50" /></div>;
  }

  return (
    <main className="min-h-screen bg-black text-white">
      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-white/10 border border-white/20 backdrop-blur text-white text-sm">{toast}</div>
      )}

      {/* Stats Bar */}
      <div className="fixed top-16 left-0 right-0 z-30 glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center gap-4 text-sm">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5">
            <Flame className="w-4 h-4 text-orange-400" />
            <span className="font-bold">{progress?.currentStreak || 0}</span>
            <span className="text-white/50">streak</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="font-bold">{progress?.xp || 0}</span>
            <span className="text-white/50">XP (Lvl {progress?.level || 1})</span>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="pt-24 pb-4">
        <div className="max-w-4xl mx-auto text-center px-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs mb-4 border border-yellow-500/30 bg-yellow-500/10">
            <Sparkles className="w-3 h-3 text-yellow-400" />
            <span className="text-yellow-200">Unbox. Battle. Evolve.</span>
          </div>
          <h1 className="font-bold text-3xl md:text-5xl tracking-tight mb-3">
            <span className="text-gradient">The Ultimate</span><br />
            <span className="text-white">Feline Showdown</span>
          </h1>
          <p className="text-white/40 text-sm max-w-md mx-auto">Vote for your favorite cats across multiple arenas. Every vote earns XP.</p>
        </div>
      </section>

      {error && (
        <section className="px-4 mb-4">
          <div className="max-w-md mx-auto p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-200 text-sm text-center">{error}</div>
        </section>
      )}

      {/* Daily Actions */}
      <section className="px-4 mb-6">
        <div className="max-w-md mx-auto grid grid-cols-2 gap-3">
          <div className="glass rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Flame className="w-4 h-4 text-orange-400" />
              <h3 className="font-bold text-sm">Streak</h3>
            </div>
            <div className="text-2xl font-bold mb-2">{progress?.currentStreak || 0}</div>
            <button onClick={handleCheckin} disabled={checkingIn}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1 mx-auto">
              {checkingIn ? <Loader2 className="w-3 h-3 animate-spin" /> : "Check In"}
            </button>
          </div>
          <div className="glass rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Gift className="w-4 h-4 text-yellow-400" />
              <h3 className="font-bold text-sm">Crate</h3>
            </div>
            <div className="text-2xl font-bold mb-2">?</div>
            <button onClick={handleClaimCrate} disabled={claimingCrate}
              className="px-3 py-1.5 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1 mx-auto">
              {claimingCrate ? <Loader2 className="w-3 h-3 animate-spin" /> : "Open"}
            </button>
          </div>
        </div>
      </section>

      {/* Arenas */}
      <section className="px-4 pb-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Today&apos;s Arenas</h2>
            <Link href="/tournament" className="flex items-center gap-1 text-xs text-white/40 hover:text-white transition-colors">
              Full Bracket <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {arenas.length === 0 ? (
            <div className="text-center py-12 glass rounded-2xl">
              <p className="text-white/50 mb-4">No active arenas today.</p>
              <Link href="/submit" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-sm font-bold hover:scale-105 transition-transform">
                Submit a Cat
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {arenas.map((arena) => (
                <ArenaSection key={arena.tournament_id} arena={arena} votedMatches={votedMatches}
                  votingMatch={votingMatch} onVote={handleVote} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-white/5">
        <div className="max-w-7xl mx-auto text-center text-neutral-500 text-sm">
          <div className="mb-3">CatBattle Arena 2026</div>
          <a className="inline-flex items-center gap-2 hover:text-white transition-colors"
            href="https://instagram.com/vuxsal" target="_blank" rel="noopener noreferrer">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
            @vuxsal
          </a>
        </div>
      </footer>
    </main>
  );
}