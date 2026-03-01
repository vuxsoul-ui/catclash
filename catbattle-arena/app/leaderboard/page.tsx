// REPLACE: app/leaderboard/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, ArrowLeft, Loader2, Flame, Zap, TrendingUp, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { thumbUrlForCat } from '../lib/cat-images';

type LeaderCat = {
  id: string;
  name: string;
  image_url: string;
  rarity: string;
  wins: number;
  losses: number;
  battles_fought: number;
};

type LeaderPlayer = {
  id: string;
  username: string;
  level: number;
  xp: number;
  sigils: number;
  current_streak: number;
  total_wins: number;
};

export default function LeaderboardPage() {
  const [cats, setCats] = useState<LeaderCat[]>([]);
  const [players, setPlayers] = useState<LeaderPlayer[]>([]);
  const [tab, setTab] = useState<'players' | 'cats'>('players');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerMoves, setPlayerMoves] = useState<Record<string, 'up' | 'down'>>({});
  const [catMoves, setCatMoves] = useState<Record<string, 'up' | 'down'>>({});
  const lowEgressMode = process.env.NEXT_PUBLIC_LOW_EGRESS === '1';

  useEffect(() => {
    loadLeaderboard();
    if (lowEgressMode) return;
    const id = setInterval(loadLeaderboard, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lowEgressMode]);

  async function loadLeaderboard() {
    try {
      const res = await fetch(`/api/leaderboard?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.ok) {
        const nextCats = data.cats || [];
        const nextPlayers = data.players || [];

        const prevPlayerPos = Object.fromEntries(players.map((p, idx) => [p.id, idx]));
        const prevCatPos = Object.fromEntries(cats.map((c, idx) => [c.id, idx]));
        const currentPlayerPos = Object.fromEntries(nextPlayers.map((p: LeaderPlayer, idx: number) => [p.id, idx]));
        const currentCatPos = Object.fromEntries(nextCats.map((c: LeaderCat, idx: number) => [c.id, idx]));

        const pMoves: Record<string, 'up' | 'down'> = {};
        for (const p of nextPlayers) {
          const prev = prevPlayerPos[p.id];
          const curr = currentPlayerPos[p.id];
          if (prev !== undefined && curr !== undefined && prev !== curr) {
            pMoves[p.id] = curr < prev ? 'up' : 'down';
          }
        }
        const cMoves: Record<string, 'up' | 'down'> = {};
        for (const c of nextCats) {
          const prev = prevCatPos[c.id];
          const curr = currentCatPos[c.id];
          if (prev !== undefined && curr !== undefined && prev !== curr) {
            cMoves[c.id] = curr < prev ? 'up' : 'down';
          }
        }

        setPlayerMoves(pMoves);
        setCatMoves(cMoves);
        if (Object.keys(pMoves).length || Object.keys(cMoves).length) {
          setTimeout(() => {
            setPlayerMoves({});
            setCatMoves({});
          }, 2000);
        }

        setCats(nextCats);
        setPlayers(nextPlayers);
        setError(null);
      } else {
        setError(data.error || 'Failed to load');
      }
    } catch {
      setError('Network error');
    }
    setLoading(false);
  }

  function getRarityColor(rarity: string): string {
    const colors: Record<string, string> = {
      'Common': 'text-gray-400',
      'Rare': 'text-blue-400',
      'Epic': 'text-purple-400',
      'Legendary': 'text-yellow-400',
      'Mythic': 'text-red-400',
      'God-Tier': 'text-pink-400',
    };
    return colors[rarity] || 'text-gray-400';
  }

  function getMedalEmoji(rank: number): string {
    if (rank === 0) return '🥇';
    if (rank === 1) return '🥈';
    if (rank === 2) return '🥉';
    return `#${rank + 1}`;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-xs mb-4">
            <Trophy className="w-3 h-3 text-yellow-400" />
            <span className="text-yellow-200">Hall of Champions</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Leaderboard</h1>
          <p className="text-white/50">Top battle cats ranked by wins</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/20 text-red-200 text-center">{error}</div>
        )}

        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={() => setTab('players')}
            className={`px-3 py-1.5 rounded-lg text-sm ${tab === 'players' ? 'bg-white text-black font-bold' : 'bg-white/10 text-white/80'}`}
          >
            Players
          </button>
          <button
            onClick={() => setTab('cats')}
            className={`px-3 py-1.5 rounded-lg text-sm ${tab === 'cats' ? 'bg-white text-black font-bold' : 'bg-white/10 text-white/80'}`}
          >
            Cats
          </button>
        </div>

        {tab === 'players' ? (
          <div className="space-y-3">
            {players.map((player, i) => (
              <Link
                key={player.id}
                href={`/profile/${player.id}`}
                className={`block glass rounded-xl p-4 transition-transform ${
                  i === 0 ? 'border border-yellow-500/30 bg-yellow-500/5' :
                  i === 1 ? 'border border-gray-400/20' :
                  i === 2 ? 'border border-amber-700/20' : ''
                } ${playerMoves[player.id] === 'up' ? 'ring-1 ring-green-400/40' : ''} ${
                  playerMoves[player.id] === 'down' ? 'ring-1 ring-red-400/40' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 text-center font-bold text-lg">
                    {i < 3 ? <span className="text-2xl">{getMedalEmoji(i)}</span> : <span className="text-white/40">{i + 1}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{player.username}</p>
                    <div className="text-xs text-white/40 flex items-center gap-3 mt-1">
                      <span className="inline-flex items-center gap-1"><Zap className="w-3 h-3 text-yellow-400" />Lvl {player.level} · {player.xp} XP</span>
                      <span className="inline-flex items-center gap-1"><Flame className="w-3 h-3 text-orange-400" />{player.current_streak}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-yellow-400">{player.total_wins}</div>
                    <div className="text-xs text-white/40">wins</div>
                    {playerMoves[player.id] === 'up' && (
                      <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-green-400">
                        <TrendingUp className="w-3 h-3" /> Rising
                      </div>
                    )}
                    {playerMoves[player.id] === 'down' && (
                      <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-red-400">
                        <TrendingDown className="w-3 h-3" /> Dropped
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {cats.map((cat, i) => {
            const winRate = cat.battles_fought > 0
              ? Math.round((cat.wins / cat.battles_fought) * 100)
              : 0;

            return (
              <div
                key={cat.id}
                className={`glass rounded-xl p-4 flex items-center gap-4 transition-transform ${
                  i === 0 ? 'border border-yellow-500/30 bg-yellow-500/5' :
                  i === 1 ? 'border border-gray-400/20' :
                  i === 2 ? 'border border-amber-700/20' : ''
                } ${catMoves[cat.id] === 'up' ? 'ring-1 ring-green-400/40' : ''} ${
                  catMoves[cat.id] === 'down' ? 'ring-1 ring-red-400/40' : ''
                }`}
              >
                {/* Rank */}
                <div className="w-10 text-center font-bold text-lg">
                  {i < 3 ? (
                    <span className="text-2xl">{getMedalEmoji(i)}</span>
                  ) : (
                    <span className="text-white/40">{i + 1}</span>
                  )}
                </div>

                {/* Cat image */}
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                  <img
                    src={thumbUrlForCat(cat.id)}
                    alt={cat.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/cat-placeholder.svg';
                    }}
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold truncate">{cat.name}</span>
                    <span className={`text-xs ${getRarityColor(cat.rarity)}`}>{cat.rarity}</span>
                  </div>
                  <div className="text-xs text-white/40">
                    {cat.battles_fought} battles &middot; {winRate}% win rate
                  </div>
                </div>

                {/* Wins */}
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-yellow-400">{cat.wins}</div>
                  <div className="text-xs text-white/40">wins</div>
                  {catMoves[cat.id] === 'up' && (
                    <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-green-400">
                      <TrendingUp className="w-3 h-3" />
                    </div>
                  )}
                  {catMoves[cat.id] === 'down' && (
                    <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-red-400">
                      <TrendingDown className="w-3 h-3" />
                    </div>
                  )}
                </div>
              </div>
            );
            })}
          </div>
        )}

        {((tab === 'cats' && cats.length === 0) || (tab === 'players' && players.length === 0)) && !error && (
          <div className="text-center py-12 glass rounded-2xl">
            <p className="text-white/60">No battle results yet. Tournaments are just getting started!</p>
          </div>
        )}
      </div>
    </div>
  );
}
