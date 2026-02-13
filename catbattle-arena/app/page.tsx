'use client';

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  Swords, Sparkles, Github, Twitter, Flame, Heart,
  Target, TrendingUp, Zap, X, Gift, Crown, Loader2,
  Zap as ZapIcon, Shield, Dices, Plus
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

async function castVote(battleId: string, userId: string | null, votedFor: string) {
  try {
    const res = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ battleId, userId, votedFor })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Vote failed');
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
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [voting, setVoting] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [claimingCrate, setClaimingCrate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCat, setSelectedCat] = useState<Cat | null>(null);
  const [userId] = useState('test-user-id'); // TODO: Replace with actual auth

  // Load data on mount
  useEffect(() => {
    loadUserState();
  }, []);

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
    setCats([]);
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

  async function handleVote(side: 'left' | 'right') {
    if (hasVoted || voting || cats.length < 2) return;
    setVoting(true);
    setError(null);
    const catId = side === 'left' ? cats[0].id : cats[1].id;
    const result = await castVote('mock-battle-id', userId, catId);
    if (result.error) {
      setError(result.error);
    } else if (result.success) {
      setHasVoted(true);
      await loadUserState(); // Refresh XP
      setTimeout(() => setHasVoted(false), 2000);
    }
    setVoting(false);
  }

  const totalVotes = cats.reduce((s, c) => s + c.votes, 0);
  const leftOdds = cats.length >= 2 ? Math.round((cats[0].votes / (totalVotes || 1)) * 100) : 50;
  const rightOdds = 100 - leftOdds;

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 glass border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center border border-white/10">
              <Swords className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold tracking-tight text-lg">CatBattle <span className="text-neutral-400 text-sm uppercase tracking-wider">Arena</span></div>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
              <Flame className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-bold">{progress?.currentStreak || 0}</span>
              <span className="text-xs text-white/50">day streak</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-bold">{progress?.xp || 0}</span>
              <span className="text-xs text-white/50">XP (Lvl {progress?.level || 1})</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm">
            <a href="#arena" className="text-white/70 hover:text-white transition-colors">Battle</a>
            <Link href="/submit" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
              <Plus className="w-4 h-4" />Submit Cat
            </Link>
          </nav>
        </div>
      </header>

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
          
          {cats.length < 2 ? (
            <div className="text-center py-12 glass rounded-2xl">
              <p className="text-white/60 mb-4">No cats in the arena yet!</p>
              <Link href="/submit" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black font-bold hover:scale-105 transition-transform">
                <Plus className="w-5 h-5" />Be the first to submit a cat
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {cats.slice(0, 2).map((cat) => <CatCard key={cat.id} cat={cat} onClick={() => setSelectedCat(cat)} showStats={true} />)}
              </div>
              <div className="glass rounded-2xl p-6 text-center">
                <div className="flex items-center justify-center gap-4 mb-4">
                  <div className="text-2xl font-bold text-white">{cats[0].name}</div>
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center"><span className="text-lg font-bold text-white/70">VS</span></div>
                  <div className="text-2xl font-bold text-white">{cats[1].name}</div>
                </div>
                <div className="flex items-center justify-center gap-8 mb-4 text-sm">
                  <div className="text-center"><div className="text-2xl font-bold text-blue-400">{leftOdds}%</div><div className="text-white/50">Odds</div></div>
                  <div className="text-center"><div className="text-2xl font-bold text-white">{totalVotes.toLocaleString()}</div><div className="text-white/50">Votes</div></div>
                  <div className="text-center"><div className="text-2xl font-bold text-red-400">{rightOdds}%</div><div className="text-white/50">Odds</div></div>
                </div>
                <div className="flex items-center justify-center gap-4">
                  <button onClick={() => handleVote('left')} disabled={hasVoted || voting} className="px-8 py-4 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                    {voting && <Loader2 className="w-4 h-4 animate-spin" />}Vote {cats[0].name}
                  </button>
                  <button onClick={() => handleVote('right')} disabled={hasVoted || voting} className="px-8 py-4 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                    {voting && <Loader2 className="w-4 h-4 animate-spin" />}Vote {cats[1].name}
                  </button>
                </div>
                {hasVoted && <p className="mt-4 text-green-400 animate-pulse">Vote recorded! +5 XP</p>}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-4 border-t border-white/10">
        <div className="max-w-7xl mx-auto text-center text-neutral-400">
          <div className="mb-4">Built with ❤️ — CatBattle Arena 2026</div>
          <div className="flex items-center justify-center gap-4">
            <a className="hover:text-white transition-colors" href="#"><Github className="w-5 h-5" /></a>
            <a className="hover:text-white transition-colors" href="#"><Twitter className="w-5 h-5" /></a>
          </div>
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
