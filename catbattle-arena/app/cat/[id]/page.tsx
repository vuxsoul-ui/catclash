// REPLACE: app/cat/[id]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowLeft, Loader2, Swords, Shield, Zap,
  Wind, Sparkles, Skull, Heart, Star,
} from 'lucide-react';
import Link from 'next/link';

interface CatProfile {
  id: string;
  name: string;
  image_url: string;
  rarity: string;
  ability: string;
  power: string;
  evolution: string;
  level: number;
  xp: number;
  stats: { attack: number; defense: number; speed: number; charisma: number; chaos: number };
  total_power: number;
  wins: number;
  losses: number;
  battles_fought: number;
  win_rate: number;
  owner_id: string | null;
  created_at: string;
  battle_history: {
    match_id: string;
    opponent_name: string;
    won: boolean;
    my_votes: number;
    opp_votes: number;
    date: string;
  }[];
}

const RARITY_CONFIG: Record<string, {
  gradient: string; border: string; glow: string; text: string; bg: string; tier: number;
}> = {
  'Common':    { gradient: 'from-zinc-400 to-zinc-600',     border: 'border-zinc-500/40',    glow: '',                                          text: 'text-zinc-400',   bg: 'bg-zinc-500/10',    tier: 1 },
  'Rare':      { gradient: 'from-blue-400 to-cyan-500',     border: 'border-blue-500/40',    glow: 'shadow-[0_0_20px_rgba(59,130,246,0.15)]',   text: 'text-blue-400',   bg: 'bg-blue-500/10',    tier: 2 },
  'Epic':      { gradient: 'from-purple-400 to-violet-600', border: 'border-purple-500/40',  glow: 'shadow-[0_0_25px_rgba(147,51,234,0.2)]',    text: 'text-purple-400', bg: 'bg-purple-500/10',  tier: 3 },
  'Legendary': { gradient: 'from-yellow-400 to-amber-500',  border: 'border-yellow-500/40',  glow: 'shadow-[0_0_30px_rgba(234,179,8,0.25)]',    text: 'text-yellow-400', bg: 'bg-yellow-500/10',  tier: 4 },
  'Mythic':    { gradient: 'from-red-400 to-rose-600',      border: 'border-red-500/40',     glow: 'shadow-[0_0_35px_rgba(239,68,68,0.25)]',    text: 'text-red-400',    bg: 'bg-red-500/10',     tier: 5 },
  'God-Tier':  { gradient: 'from-pink-400 via-purple-400 to-cyan-400', border: 'border-pink-500/40', glow: 'shadow-[0_0_40px_rgba(236,72,153,0.3)]', text: 'text-pink-400', bg: 'bg-pink-500/10', tier: 6 },
};

function getRarity(rarity: string) {
  return RARITY_CONFIG[rarity] || RARITY_CONFIG['Common'];
}

// Explicit bg colors so Tailwind doesn't purge them
const STAT_CONFIG: Record<string, { icon: React.ReactNode; textColor: string; barColor: string; label: string }> = {
  attack:   { icon: <Swords className="w-3.5 h-3.5" />,  textColor: 'text-red-400',    barColor: 'bg-red-400',    label: 'ATK' },
  defense:  { icon: <Shield className="w-3.5 h-3.5" />,  textColor: 'text-blue-400',   barColor: 'bg-blue-400',   label: 'DEF' },
  speed:    { icon: <Wind className="w-3.5 h-3.5" />,    textColor: 'text-green-400',  barColor: 'bg-green-400',  label: 'SPD' },
  charisma: { icon: <Heart className="w-3.5 h-3.5" />,   textColor: 'text-pink-400',   barColor: 'bg-pink-400',   label: 'CHA' },
  chaos:    { icon: <Skull className="w-3.5 h-3.5" />,   textColor: 'text-orange-400', barColor: 'bg-orange-400', label: 'CHS' },
};

function StatRow({ stat, value }: { stat: string; value: number }) {
  const config = STAT_CONFIG[stat];
  if (!config) return null;
  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center gap-1.5 w-14 ${config.textColor}`}>
        {config.icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{config.label}</span>
      </div>
      <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out ${config.barColor}`}
          style={{ width: `${Math.min(value, 100)}%`, opacity: 0.7 }}
        />
      </div>
      <span className="text-xs font-mono text-white/50 w-7 text-right">{value}</span>
    </div>
  );
}

export default function CatProfilePage() {
  const params = useParams();
  const catId = params?.id as string;
  const [cat, setCat] = useState<CatProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!catId) return;
    async function loadCat() {
      setLoading(true);
      try {
        const res = await fetch(`/api/cats/${catId}`);
        const data = await res.json();
        if (data.ok) setCat(data.cat);
        else setError(data.error || 'Cat not found');
      } catch { setError('Failed to load'); }
      setLoading(false);
    }
    loadCat();
  }, [catId]);

  if (loading) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-white/50" /></div>;
  }

  if (error || !cat) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-white/60 mb-4">{error || 'Cat not found'}</p>
          <Link href="/" className="text-white/40 hover:text-white">Back to Arena</Link>
        </div>
      </div>
    );
  }

  const r = getRarity(cat.rarity);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className={`fixed inset-0 pointer-events-none opacity-20 bg-gradient-to-br ${r.gradient}`} style={{ filter: 'blur(120px)' }} />

      <div className="relative z-10 max-w-lg mx-auto px-4 py-6">
        <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div className={`relative rounded-2xl overflow-hidden border ${r.border} ${r.glow} bg-black/60 backdrop-blur-sm`}>
          {r.tier >= 4 && (
            <div className="absolute inset-0 z-10 pointer-events-none opacity-10"
              style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.4) 45%, transparent 50%)', backgroundSize: '200% 100%', animation: 'shimmer 3s ease-in-out infinite' }} />
          )}

          {/* Cat Image */}
          <div className="relative h-72 sm:h-80">
            <img src={cat.image_url || 'https://placekitten.com/500/500'} alt={cat.name}
              className="w-full h-full object-cover object-center"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://placekitten.com/500/500'; }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
            <div className="absolute top-3 left-3 flex gap-2">
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${r.border} ${r.bg} ${r.text}`}>
                {cat.rarity === 'God-Tier' ? '✦ GOD TIER' : cat.rarity}
              </span>
              {cat.evolution && cat.evolution !== 'Kitten' && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border border-white/10 bg-white/5 text-white/60">{cat.evolution}</span>
              )}
            </div>
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-sm border border-white/10">
              <span className="text-xs font-bold">LVL {cat.level}</span>
            </div>
            <div className="absolute bottom-4 left-4 right-4">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-1">{cat.name}</h1>
              <div className="flex items-center gap-2">
                <Zap className={`w-3.5 h-3.5 ${r.text}`} />
                <span className="text-sm text-white/60">{cat.power || cat.ability || 'Unknown'}</span>
                {cat.ability && cat.ability !== 'None' && cat.ability !== cat.power && (
                  <>
                    <span className="text-white/20">&middot;</span>
                    <Sparkles className="w-3.5 h-3.5 text-white/40" />
                    <span className="text-sm text-white/40">{cat.ability}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* Combat Record */}
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="rounded-xl bg-white/[0.03] p-3">
                <div className="text-lg font-bold">{cat.battles_fought}</div>
                <div className="text-[10px] uppercase tracking-wider text-white/30">Battles</div>
              </div>
              <div className="rounded-xl bg-green-500/[0.06] p-3">
                <div className="text-lg font-bold text-green-400">{cat.wins}</div>
                <div className="text-[10px] uppercase tracking-wider text-white/30">Wins</div>
              </div>
              <div className="rounded-xl bg-red-500/[0.06] p-3">
                <div className="text-lg font-bold text-red-400">{cat.losses}</div>
                <div className="text-[10px] uppercase tracking-wider text-white/30">Losses</div>
              </div>
              <div className="rounded-xl bg-white/[0.03] p-3">
                <div className="text-lg font-bold">{cat.win_rate}%</div>
                <div className="text-[10px] uppercase tracking-wider text-white/30">WR</div>
              </div>
            </div>

            {/* Power Rating */}
            <div className={`flex items-center justify-between p-3 rounded-xl ${r.bg} border ${r.border}`}>
              <div className="flex items-center gap-2">
                <Star className={`w-4 h-4 ${r.text}`} />
                <span className="text-sm font-bold">Power Rating</span>
              </div>
              <span className={`text-lg font-black ${r.text}`}>{cat.total_power}</span>
            </div>

            {/* Stats */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white/30 mb-3">Combat Stats</h3>
              <div className="space-y-2.5">
                <StatRow stat="attack" value={cat.stats.attack} />
                <StatRow stat="defense" value={cat.stats.defense} />
                <StatRow stat="speed" value={cat.stats.speed} />
                <StatRow stat="charisma" value={cat.stats.charisma} />
                <StatRow stat="chaos" value={cat.stats.chaos} />
              </div>
            </div>

            {/* Owner */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/30 mb-0.5">Owner</div>
                <div className="text-sm font-medium text-white/70">{cat.owner_id ? cat.owner_id.slice(0, 8) + '...' : 'Unknown'}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-white/30 mb-0.5">Recruited</div>
                <div className="text-sm font-medium text-white/70">{new Date(cat.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              </div>
            </div>

            {/* Battle History */}
            {cat.battle_history.length > 0 ? (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/30 mb-3">Recent Battles</h3>
                <div className="space-y-1.5">
                  {cat.battle_history.map((b) => (
                    <div key={b.match_id}
                      className={`flex items-center justify-between p-2.5 rounded-lg ${b.won ? 'bg-green-500/[0.05] border border-green-500/10' : 'bg-red-500/[0.05] border border-red-500/10'}`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${b.won ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {b.won ? 'W' : 'L'}
                        </span>
                        <span className="text-sm text-white/70">vs {b.opponent_name}</span>
                      </div>
                      <span className="text-xs text-white/30">{b.my_votes}-{b.opp_votes}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 rounded-xl bg-white/[0.02]">
                <Swords className="w-6 h-6 mx-auto mb-2 text-white/20" />
                <p className="text-sm text-white/30">No battles yet. This cat is ready for war.</p>
              </div>
            )}
          </div>
        </div>

        {/* XP Bar */}
        <div className="mt-4 px-1">
          <div className="flex items-center justify-between text-[10px] text-white/30 mb-1">
            <span>XP</span>
            <span>{cat.xp} / {cat.level * 100}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div className={`h-full rounded-full bg-gradient-to-r ${r.gradient} transition-all duration-1000`}
              style={{ width: `${Math.min((cat.xp / (cat.level * 100)) * 100, 100)}%` }} />
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}