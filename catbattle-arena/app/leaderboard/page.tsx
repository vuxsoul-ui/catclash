// REPLACE: app/leaderboard/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

type LeaderCat = {
  id: string;
  name: string;
  image_url: string;
  rarity: string;
  wins: number;
  losses: number;
  battles_fought: number;
};

export default function LeaderboardPage() {
  const [cats, setCats] = useState<LeaderCat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  async function loadLeaderboard() {
    try {
      const res = await fetch('/api/leaderboard');
      const data = await res.json();
      if (data.ok) {
        setCats(data.cats || []);
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

        <div className="space-y-3">
          {cats.map((cat, i) => {
            const winRate = cat.battles_fought > 0
              ? Math.round((cat.wins / cat.battles_fought) * 100)
              : 0;

            return (
              <div
                key={cat.id}
                className={`glass rounded-xl p-4 flex items-center gap-4 ${
                  i === 0 ? 'border border-yellow-500/30 bg-yellow-500/5' :
                  i === 1 ? 'border border-gray-400/20' :
                  i === 2 ? 'border border-amber-700/20' : ''
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
                    src={cat.image_url || 'https://placekitten.com/100/100'}
                    alt={cat.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = 'https://placekitten.com/100/100';
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
                </div>
              </div>
            );
          })}
        </div>

        {cats.length === 0 && !error && (
          <div className="text-center py-12 glass rounded-2xl">
            <p className="text-white/60">No battle results yet. Tournaments are just getting started!</p>
          </div>
        )}
      </div>
    </div>
  );
}