'use client';

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  Sparkles, Flame, Heart,
  Target, TrendingUp, Zap, X, Gift, Crown, Loader2,
  Zap as ZapIcon, Shield, Dices
} from "lucide-react";
import Link from "next/link";

// Types
type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic' | 'God-Tier';
type EvolutionStage = 'Kitten' | 'Elite Floof' | 'Battle Beast' | 'Supreme Overlord';
type SpecialPower = 'Laser Eyes' | 'Ultimate Fluff' | 'Chaos Mode' | 'Nine Lives' | 'Royal Aura' | 'Underdog Boost';



interface Cat {
  id: string;
  name: string;
  image: string;
  votes: number;
  winRate: number;
  rarity: Rarity;
  stats: { attack: number; defense: number; speed: number; charisma: number; chaos: number };
  xp: number;
  maxXp: number;
  evolution: EvolutionStage;
  power: SpecialPower;
  level: number;
}

interface UserProgress {
  xp: number;
  level: number;
  xpForNextLevel: number;
  currentStreak: number;
  lastClaimDate: string | null;
  leveledUp: boolean;
  newLevel: number;
  canClaim?: boolean;
}


type TournamentCat = { id: string; name: string; image_url?: string; image_path?: string };
type TournamentMatch = {
  match_id: string;
  cat_a: TournamentCat;
  cat_b: TournamentCat;
  votes_a: number;
  votes_b: number;
  status: string;
};



// Helpers
const POWER_ICONS: Record<SpecialPower, React.ReactNode> = {
  'Laser Eyes': <ZapIcon className="w-4 h-4" />,
  'Ultimate Fluff': <Shield className="w-4 h-4" />,
  'Chaos Mode': <Dices className="w-4 h-4" />,
  'Nine Lives': <Heart className="w-4 h-4" />,
  'Royal Aura': <Crown className="w-4 h-4" />,
  'Underdog Boost': <TrendingUp className="w-4 h-4" />
};

function getRarityColor(rarity: Rarity): string {
  const colors: Record<Rarity, string> = {
    'Common': 'border-gray-500 text-gray-400',
    'Rare': 'border-blue-500 text-blue-400',
    'Epic': 'border-purple-500 text-purple-400',
    'Legendary': 'border-yellow-500 text-yellow-400',
    'Mythic': 'border-red-500 text-red-400',
    'God-Tier': 'border-pink-500 text-pink-400 animate-pulse'
  };
  return colors[rarity];
}

function getRarityBg(rarity: Rarity): string {
  const colors: Record<Rarity, string> = {
    'Common': 'bg-gray-500/20',
    'Rare': 'bg-blue-500/20',
    'Epic': 'bg-purple-500/20',
    'Legendary': 'bg-yellow-500/20',
    'Mythic': 'bg-red-500/20',
    'God-Tier': 'bg-gradient-to-r from-pink-500/30 via-purple-500/30 to-blue-500/30'
  };
  return colors[rarity];
}

// API Functions - All routes return JSON
async function fetchUserState() {
  try {
    const res = await fetch('/api/me');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch');
    return data;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Server error" };
  }
}

type TournamentTodayResponse = {
  success?: boolean;
  tournament?: { matches?: TournamentMatch[] };
};

async function fetchLiveArenaMatch(): Promise<TournamentMatch | null> {
  const res = await fetch("/api/tournament/today", { cache: "no-store" });
  const j = (await res.json().catch(() => ({}))) as TournamentTodayResponse;
  return j.success ? (j.tournament?.matches?.[0] ?? null) : null;
}





async function checkin() {
  try {
    const res = await fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Checkin failed');
    return data;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Server error" };
  }
}

async function claimCrate() {
  try {
    const res = await fetch('/api/crate/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Claim failed');
    return data;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Server error" };
  }
}



// Components
function StatBar({ label, value, color = 'bg-white' }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-neutral-400">{label}</span>
      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-8 text-right text-white/70">{value}</span>
    </div>
  );
}

function RarityBadge({ rarity }: { rarity: Rarity }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getRarityColor(rarity)} ${getRarityBg(rarity)}`}>
      {rarity === 'God-Tier' ? 'GOD' : rarity.toUpperCase()}
    </span>
  );
}

function PowerBadge({ power }: { power: SpecialPower }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10">
      <span className="text-white/70">{POWER_ICONS[power]}</span>
      <span className="text-xs text-white/60">{power}</span>
    </div>
  );
}

function CatCard({ cat, onClick, showStats = false }: { cat: Cat; onClick?: () => void; showStats?: boolean }) {
  return (
    <div onClick={onClick} className={`relative rounded-2xl overflow-hidden border-2 ${getRarityColor(cat.rarity)} bg-black/40 backdrop-blur-sm transition-all hover:scale-105 cursor-pointer`}>
      <div className="relative h-48">
        <Image src={cat.image} alt={cat.name} fill className="object-cover" />
        <div className={`absolute inset-0 ${getRarityBg(cat.rarity)} mix-blend-overlay opacity-30`} />
        <div className="absolute top-2 left-2"><RarityBadge rarity={cat.rarity} /></div>
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/60 text-xs font-bold text-white">LVL {cat.level}</div>
      </div>
      <div className="p-4">
        <h4 className="text-lg font-bold text-white mb-2">{cat.name}</h4>
        <PowerBadge power={cat.power} />
        <div className="flex items-center gap-2 text-xs text-white/60 mt-2">
          <TrendingUp className="w-3 h-3" /><span>{cat.winRate}% WR</span><span>•</span><span>{cat.votes.toLocaleString()} votes</span>
        </div>
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs mb-1"><span className="text-white/50">XP</span><span className="text-white/70">{cat.xp}/{cat.maxXp}</span></div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-400 to-purple-400 transition-all" style={{ width: `${(cat.xp / cat.maxXp) * 100}%` }} /></div>
        </div>
        {showStats && <div className="mt-3 pt-3 border-t border-white/10 space-y-1"><StatBar label="ATK" value={cat.stats.attack} color="bg-red-400" /><StatBar label="DEF" value={cat.stats.defense} color="bg-blue-400" /><StatBar label="SPD" value={cat.stats.speed} color="bg-green-400" /></div>}
      </div>
    </div>
  );
}

// Main Page
export default function Page() {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [voting, setVoting] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [claimingCrate, setClaimingCrate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCat, setSelectedCat] = useState<Cat | null>(null);
  const [liveMatch, setLiveMatch] = useState<TournamentMatch | null>(null);
  const [voteToast, setVoteToast] = useState<string | null>(null);
  // Load data on mount
  useEffect(() => {
    loadUserState();
    loadLiveMatch();
  }, []);

  async function loadLiveMatch() {
    try {
      const res = await fetch("/api/tournament/today", { cache: "no-store" });
      const j = await res.json().catch(() => null);
      const matches = j?.tournament?.matches;
      if (Array.isArray(matches) && matches.length > 0) {
        setLiveMatch(matches[0]);
      } else {
        setLiveMatch(null);
      }
    } catch {
      setLiveMatch(null);
    }
  }
  
  async function loadUserState() {
    setLoading(true);
    setError(null);
    const data = await fetchUserState();
    if (data.error) {
      setError(data.error);
    } else {
      setProgress({
        xp: data.data?.progress?.xp || 0,
        level: data.data?.progress?.level || 1,
        currentStreak: data.data?.streak?.current_streak || 0,
        lastClaimDate: data.data?.streak?.last_claim_date,
        xpForNextLevel: (data.data?.progress?.level || 1) * (data.data?.progress?.level || 1) * 100,
        leveledUp: false,
        newLevel: data.data?.progress?.level || 1,
        canClaim: (data.data?.streak?.last_claim_date || '').split('T')[0] !== new Date().toISOString().split('T')[0]
      });
    }
    const m = await fetchLiveArenaMatch();
    setLiveMatch(m);

    setLoading(false);
  }

  async function handleCheckin() {
    if (checkingIn) return;
    setCheckingIn(true);
    setError(null);
    const result = await checkin();
    if (result.error) {
      setError(result.error);
    } else if (result.already_checked_in) {
      setError('Already checked in today');
    } else if (result.current_streak) {
      // Update progress immediately with new streak
      setProgress(prev => prev ? { ...prev, currentStreak: result.current_streak } : null);
    } else {
      await loadUserState(); // Fallback refresh
    }
    setCheckingIn(false);
  }

  async function handleClaimCrate() {
    if (claimingCrate) return;
    setClaimingCrate(true);
    setError(null);
    const result = await claimCrate();
    if (result.error) {
      setError(result.error);
    } else if (!result.success) {
      setError(result.message || 'Already claimed today');
    } else {
      await loadUserState(); // Refresh to get updated XP
    }
    setClaimingCrate(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      {voteToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-white/10 border border-white/20 backdrop-blur text-white">
          {voteToast}
        </div>
      )}

      {/* User Stats Bar */}
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
      <section className="pt-24 pb-8">
        <div className="max-w-4xl mx-auto text-center px-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs mb-6 border border-yellow-500/30 bg-yellow-500/10">
            <Sparkles className="w-3 h-3 text-yellow-400" />
            <span className="text-yellow-200">Unbox. Battle. Evolve.</span>
          </div>
          <h1 className="font-bold text-4xl md:text-6xl tracking-tight mb-4">
            <span className="text-gradient">The Ultimate</span><br /><span className="text-white">Feline Showdown</span>
          </h1>
          <p className="text-white/50 max-w-xl mx-auto">Collect rare cats, battle for glory, and climb the ranks. Every vote counts.</p>
        </div>
      </section>

      {/* Error Display */}
      {error && (
        <section className="px-4 mb-4">
          <div className="max-w-md mx-auto p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-200 text-sm text-center">
            {error}
          </div>
        </section>
      )}

      {/* Daily Actions */}
      <section className="px-4 mb-8">
        <div className="max-w-md mx-auto grid grid-cols-2 gap-4">
          {/* Streak Checkin */}
          <div className="glass rounded-2xl p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Flame className="w-5 h-5 text-orange-400" />
              <h3 className="text-lg font-bold">Streak</h3>
            </div>
            <div className="text-3xl font-bold mb-2">{progress?.currentStreak || 0}</div>
            <button 
              onClick={handleCheckin}
              disabled={checkingIn}
              className="mt-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mx-auto"
            >
              {checkingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check In'}
            </button>
          </div>

          {/* Daily Crate */}
          <div className="glass rounded-2xl p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Gift className="w-5 h-5 text-yellow-400" />
              <h3 className="text-lg font-bold">Crate</h3>
            </div>
            <div className="text-3xl font-bold mb-2">?</div>
            <button 
              onClick={handleClaimCrate}
              disabled={claimingCrate}
              className="mt-2 px-4 py-2 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mx-auto"
            >
              {claimingCrate ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Open'}
            </button>
          </div>
        </div>
      </section>

      {/* Battle Arena */}
      <section id="arena" className="py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Battle Arena</h2>
            <div className="flex items-center gap-2 text-sm text-white/50"><Target className="w-4 h-4" /><span>Live Match</span></div>
          </div>
          
          {!liveMatch ? (
  <div className="text-center py-12 glass rounded-2xl">
    <p className="text-white/60 mb-4">No live match right now.</p>
    <Link href="/tournament" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black font-bold hover:scale-105 transition-transform">
      <Target className="w-5 h-5" /> Go to Tournament
    </Link>
  </div>
) : (
  <div className="glass rounded-2xl p-6 text-center">
    <div className="flex items-center justify-center gap-4 mb-4">
      <div className="text-2xl font-bold text-white">{liveMatch.cat_a.name}</div>
      <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
        <span className="text-lg font-bold text-white/70">VS</span>
      </div>
      <div className="text-2xl font-bold text-white">{liveMatch.cat_b.name}</div>
    </div>

    <div className="flex items-center justify-center gap-4">
      <button
        onClick={async () => {
          setVoting(true);
          setError(null);
          const r = await fetch("/api/vote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ match_id: liveMatch.match_id, voted_for: liveMatch.cat_a.id }),
          });
          const jj = await r.json().catch(() => null);
          if (!r.ok || !jj?.ok) {
            setError(jj?.error || jj?.details || "Vote failed");
            setVoteToast(jj?.error || jj?.details || "Vote failed");
            setTimeout(() => setVoteToast(null), 2500);
          } else {
            setVoteToast("✅ Vote recorded! +5 XP");
            setTimeout(() => setVoteToast(null), 2000);
            // refresh live match counts
            const m2 = await fetchLiveArenaMatch();
            setLiveMatch(m2);
          }
          setVoting(false);
        }}
        disabled={voting}
        className="px-8 py-4 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold transition-all hover:scale-105 disabled:opacity-50"
      >
        Vote {liveMatch.cat_a.name}
      </button>

      <button
        onClick={async () => {
          setVoting(true);
          setError(null);
          const r = await fetch("/api/vote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ match_id: liveMatch.match_id, voted_for: liveMatch.cat_b.id }),
          });
          const jj = await r.json().catch(() => null);
          if (!r.ok || !jj?.ok) {
            setError(jj?.error || jj?.details || "Vote failed");
            setVoteToast(jj?.error || jj?.details || "Vote failed");
            setTimeout(() => setVoteToast(null), 2500);
          } else {
            setVoteToast("✅ Vote recorded! +5 XP");
            setTimeout(() => setVoteToast(null), 2000);
            const m2 = await fetchLiveArenaMatch();
            setLiveMatch(m2);
          }
          setVoting(false);
        }}
        disabled={voting}
        className="px-8 py-4 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold transition-all hover:scale-105 disabled:opacity-50"
      >
        Vote {liveMatch.cat_b.name}
      </button>
    </div>
  </div>
)}

        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-4 border-t border-white/10">
        <div className="max-w-7xl mx-auto text-center text-neutral-400">
          <div className="mb-4">Built with ❤️ — CatBattle Arena 2026</div>
          <a 
            className="inline-flex items-center gap-2 hover:text-white transition-colors" 
            href="https://instagram.com/vuxsal" 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            <span>@vuxsal</span>
          </a>
        </div>
      </footer>

      {/* Cat Detail Modal */}
      {selectedCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-4" onClick={() => setSelectedCat(null)}>
          <div className="relative w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedCat(null)} className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white"><X className="w-6 h-6" /></button>
            <CatCard cat={selectedCat} showStats={true} />
          </div>
        </div>
      )}
    </main>
  );
}
