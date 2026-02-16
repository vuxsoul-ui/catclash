// PLACE AT: app/crate/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Gift, Loader2, ArrowLeft, Sparkles, Zap, Star, Crown } from 'lucide-react';
import Link from 'next/link';

interface CrateReward {
  ok: boolean;
  rarity: string;
  reward_type: string;
  xp_gained: number;
  sigils_gained: number;
  cosmetic?: {
    id: string;
    name: string;
    slug: string;
    category: string;
    rarity: string;
    description: string;
  };
  error?: string;
}

const RARITY_STYLES: Record<string, { bg: string; border: string; text: string; glow: string; particle: string }> = {
  'xp_sigils':  { bg: 'bg-zinc-800', border: 'border-zinc-500', text: 'text-zinc-300', glow: '', particle: '#a1a1aa' },
  'duplicate':  { bg: 'bg-zinc-800', border: 'border-zinc-500', text: 'text-zinc-300', glow: '', particle: '#a1a1aa' },
  'Common':     { bg: 'bg-zinc-900', border: 'border-zinc-500', text: 'text-zinc-300', glow: '', particle: '#a1a1aa' },
  'Rare':       { bg: 'bg-blue-950', border: 'border-blue-500', text: 'text-blue-400', glow: 'shadow-[0_0_40px_rgba(59,130,246,0.3)]', particle: '#3b82f6' },
  'Epic':       { bg: 'bg-purple-950', border: 'border-purple-500', text: 'text-purple-400', glow: 'shadow-[0_0_50px_rgba(147,51,234,0.4)]', particle: '#9333ea' },
  'Legendary':  { bg: 'bg-yellow-950', border: 'border-yellow-500', text: 'text-yellow-400', glow: 'shadow-[0_0_60px_rgba(234,179,8,0.5)]', particle: '#eab308' },
};

function getStyle(rarity: string) {
  return RARITY_STYLES[rarity] || RARITY_STYLES['Common'];
}

const CATEGORY_LABELS: Record<string, string> = {
  'cat_title': '🏷 Cat Title',
  'cat_border': '🖼 Cat Border',
  'voter_badge': '🎖 Voter Badge',
  'vote_effect': '✨ Vote Effect',
};

export default function CratePage() {
  const [phase, setPhase] = useState<'idle' | 'opening' | 'reveal'>('idle');
  const [reward, setReward] = useState<CrateReward | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sigils, setSigils] = useState(0);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; delay: number }[]>([]);

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => {
      setSigils(d.data?.progress?.sigils || 0);
    }).catch(() => {});
  }, []);

  const spawnParticles = useCallback(() => {
    const ps = Array.from({ length: 24 }, (_, i) => ({
      id: i,
      x: 50 + (Math.random() - 0.5) * 80,
      y: 50 + (Math.random() - 0.5) * 80,
      delay: Math.random() * 0.3,
    }));
    setParticles(ps);
    setTimeout(() => setParticles([]), 2000);
  }, []);

  async function openCrate() {
    if (phase !== 'idle') return;
    setPhase('opening');
    setError(null);
    setReward(null);

    try {
      const res = await fetch('/api/crate/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const data = await res.json();

      if (!data.success && !data.ok) {
        setError(data.error || 'Failed to open crate');
        setPhase('idle');
        return;
      }

      // Suspense delay based on rarity
      const delays: Record<string, number> = { 'Legendary': 2500, 'Epic': 2000, 'Rare': 1500, 'Common': 1200, 'xp_sigils': 1000, 'duplicate': 1000 };
      const delay = delays[data.rarity] || 1200;

      setTimeout(() => {
        setReward(data);
        setPhase('reveal');
        spawnParticles();
        // Update sigils
        setSigils(prev => prev + (data.sigils_gained || 0));
      }, delay);

    } catch {
      setError('Network error');
      setPhase('idle');
    }
  }

  function reset() {
    setPhase('idle');
    setReward(null);
  }

  const rarityStyle = reward ? getStyle(reward.rarity) : getStyle('Common');

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20">
            <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-sm font-bold text-yellow-400">{sigils}</span>
            <span className="text-xs text-white/40">Sigils</span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center mb-2">Daily Crate</h1>
        <p className="text-center text-white/40 text-sm mb-8">Open once per day. Cosmetics, XP, and Sigils await.</p>

        {/* Crate Area */}
        <div className="relative flex items-center justify-center" style={{ minHeight: 320 }}>
          {/* Particles */}
          {particles.map(p => (
            <div key={p.id} className="absolute w-2 h-2 rounded-full animate-ping"
              style={{
                left: `${p.x}%`, top: `${p.y}%`,
                backgroundColor: rarityStyle.particle,
                animationDelay: `${p.delay}s`,
                animationDuration: '1s',
              }} />
          ))}

          {/* IDLE STATE */}
          {phase === 'idle' && (
            <button onClick={openCrate}
              className="group relative w-48 h-48 rounded-2xl border-2 border-dashed border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10 hover:border-yellow-500/50 transition-all hover:scale-105 flex flex-col items-center justify-center gap-3">
              <Gift className="w-16 h-16 text-yellow-400 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-bold text-yellow-400">Tap to Open</span>
            </button>
          )}

          {/* OPENING STATE */}
          {phase === 'opening' && (
            <div className="w-48 h-48 rounded-2xl border-2 border-white/20 bg-white/5 flex flex-col items-center justify-center gap-3 animate-pulse">
              <div className="relative">
                <Gift className="w-16 h-16 text-white/60" />
                <div className="absolute inset-0 animate-spin">
                  <Sparkles className="w-6 h-6 text-yellow-400 absolute -top-2 -right-2" />
                </div>
              </div>
              <Loader2 className="w-5 h-5 animate-spin text-white/40" />
            </div>
          )}

          {/* REVEAL STATE */}
          {phase === 'reveal' && reward && (
            <div className={`w-full max-w-sm rounded-2xl border-2 ${rarityStyle.border} ${rarityStyle.bg} ${rarityStyle.glow} p-6 animate-[scaleIn_0.3s_ease-out]`}>

              {/* Rarity badge */}
              <div className="text-center mb-4">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${rarityStyle.text} ${rarityStyle.border} border`}>
                  {reward.rarity === 'Legendary' && <Crown className="w-3 h-3" />}
                  {reward.rarity === 'Epic' && <Star className="w-3 h-3" />}
                  {reward.rarity === 'Rare' && <Zap className="w-3 h-3" />}
                  {reward.rarity === 'xp_sigils' || reward.rarity === 'duplicate' ? 'BONUS' : reward.rarity}
                </span>
              </div>

              {/* Cosmetic reward */}
              {reward.cosmetic && (
                <div className="text-center mb-4">
                  <div className="text-3xl mb-2">
                    {reward.cosmetic.category === 'cat_title' && '🏷'}
                    {reward.cosmetic.category === 'cat_border' && '🖼'}
                    {reward.cosmetic.category === 'voter_badge' && '🎖'}
                    {reward.cosmetic.category === 'vote_effect' && '✨'}
                  </div>
                  <h3 className={`text-xl font-black ${rarityStyle.text}`}>{reward.cosmetic.name}</h3>
                  <p className="text-xs text-white/40 mt-1">{CATEGORY_LABELS[reward.cosmetic.category] || reward.cosmetic.category}</p>
                  <p className="text-sm text-white/50 mt-2">{reward.cosmetic.description}</p>
                </div>
              )}

              {/* XP + Sigils */}
              <div className="flex items-center justify-center gap-4 mt-4">
                {reward.xp_gained > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5">
                    <Zap className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-bold text-blue-400">+{reward.xp_gained} XP</span>
                  </div>
                )}
                {reward.sigils_gained > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5">
                    <Sparkles className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm font-bold text-yellow-400">+{reward.sigils_gained} Sigils</span>
                  </div>
                )}
              </div>

              {/* Open another / back */}
              <div className="mt-6 text-center">
                <button onClick={reset}
                  className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-bold transition-colors">
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-200 text-sm text-center">{error}</div>
        )}

        {/* Recent drops hint */}
        <div className="mt-8 text-center">
          <p className="text-xs text-white/20">Drop rates: 50% XP/Sigils · 25% Common · 15% Rare · 8% Epic · 2% Legendary</p>
        </div>
      </div>

      <style jsx>{`
        @keyframes scaleIn {
          from { transform: scale(0.8); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}