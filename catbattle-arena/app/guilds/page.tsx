'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sun, Moon, ArrowLeft, Loader2, Trophy } from 'lucide-react';
import { showGlobalToast } from '../lib/global-toast';

type GuildId = 'sun' | 'moon';

const GUILD_INFO: Record<GuildId, { name: string; icon: React.ComponentType<{ className?: string }>; color: string; motto: string }> = {
  sun: {
    name: 'Solar Claw',
    icon: Sun,
    color: 'from-amber-500 to-orange-500',
    motto: 'Fast, aggressive, high-pressure cats.',
  },
  moon: {
    name: 'Lunar Paw',
    icon: Moon,
    color: 'from-cyan-500 to-blue-600',
    motto: 'Controlled, resilient, tactical cats.',
  },
};

interface Standing {
  guild: GuildId;
  members: number;
  cats: number;
  wins: number;
  avg_power: number;
  daily_value: number;
}

export default function GuildsPage() {
  const [loading, setLoading] = useState(true);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [pledgedGuild, setPledgedGuild] = useState<GuildId | null>(null);
  const [pledgingGuild, setPledgingGuild] = useState<GuildId | null>(null);
  const [nextRefreshAt, setNextRefreshAt] = useState<string | null>(null);
  const [countdown, setCountdown] = useState('');
  const [leaderGuild, setLeaderGuild] = useState<GuildId | null>(null);
  const [voteXpBonus, setVoteXpBonus] = useState(1);
  const [leaderExtraXpBonus, setLeaderExtraXpBonus] = useState(1);
  const [leaderDailySigilsBonus, setLeaderDailySigilsBonus] = useState(20);
  const lowEgressMode = process.env.NEXT_PUBLIC_LOW_EGRESS === '1';

  useEffect(() => {
    let active = true;

    async function loadStandings() {
      try {
        const res = await fetch(`/api/guild/standings?t=${Date.now()}`, { cache: 'no-store' });
        const data = await res.json();
        if (!active) return;
        if (res.ok && data.ok) {
          setStandings(data.standings || []);
          setPledgedGuild(data.pledged_guild || null);
          setNextRefreshAt(data.next_refresh_at || null);
          setLeaderGuild(data.leader_guild || null);
          setVoteXpBonus(Number(data.vote_xp_bonus || 1));
          setLeaderExtraXpBonus(Number(data.leader_extra_xp_bonus || 1));
          setLeaderDailySigilsBonus(Number(data.leader_daily_sigils_bonus || 20));
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadStandings();
    const poll = setInterval(loadStandings, lowEgressMode ? 60000 : 15000);
    return () => {
      active = false;
      clearInterval(poll);
    };
  }, [lowEgressMode]);

  useEffect(() => {
    function tick() {
      if (!nextRefreshAt) {
        setCountdown('');
        return;
      }
      const diff = Math.max(0, new Date(nextRefreshAt).getTime() - Date.now());
      const totalSec = Math.floor(diff / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    }
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [nextRefreshAt]);

  async function pledge(guild: GuildId) {
    if (pledgingGuild) return;
    const previous = pledgedGuild;
    setPledgingGuild(guild);
    setPledgedGuild(guild);
    try {
      const res = await fetch('/api/guild/pledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guild }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setPledgedGuild(previous);
        showGlobalToast(data.error || 'Pledge failed', 1800);
      } else {
        showGlobalToast(`Pledged to ${GUILD_INFO[guild].name}`, 1800);
      }
    } catch {
      setPledgedGuild(previous);
      showGlobalToast('Pledge failed', 1800);
    } finally {
      setPledgingGuild(null);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white px-4 py-5 sm:py-6">
      <div className="max-w-5xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm mb-5">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-center">Guild War Table</h1>
        <p className="text-center text-white/45 text-sm sm:text-base mb-2">Two guilds. Daily value refresh. Live pledges.</p>
        <p className="text-center text-cyan-300 text-xs sm:text-sm mb-6">Next daily value refresh: {countdown || '--:--:--'} (UTC)</p>
        <div className="max-w-3xl mx-auto mb-6 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/75">
          <p>Guild Perks: +{voteXpBonus} XP on every main-arena vote when pledged.</p>
          <p>Leader Perks: +{leaderExtraXpBonus} extra XP per vote and +{leaderDailySigilsBonus} sigils on first daily check-in if your pledged guild is leading.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-white/40" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
            {standings.map((guild) => {
              const info = GUILD_INFO[guild.guild];
              const Icon = info.icon;
              const active = pledgedGuild === guild.guild;
              const isLeader = leaderGuild === guild.guild;

              return (
                <div
                  key={guild.guild}
                  className={`relative rounded-2xl p-4 sm:p-6 bg-gradient-to-br ${info.color} ${active ? 'ring-2 ring-white' : ''}`}
                >
                  {isLeader && (
                    <div className="absolute -top-3 -right-3 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                      <Trophy className="w-3 h-3" /> #1
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-white/20 p-2.5 sm:p-3 rounded-xl">
                      <Icon className="w-6 h-6 sm:w-7 sm:h-7" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold">{info.name}</h3>
                      <p className="text-xs text-white/85">{info.motto}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm mb-4">
                    <div className="bg-black/20 rounded-lg p-2 text-center">
                      <p className="text-white/60 text-[11px]">Value</p>
                      <p className="font-bold">{guild.daily_value}</p>
                    </div>
                    <div className="bg-black/20 rounded-lg p-2 text-center">
                      <p className="text-white/60 text-[11px]">Members</p>
                      <p className="font-bold">{guild.members}</p>
                    </div>
                    <div className="bg-black/20 rounded-lg p-2 text-center">
                      <p className="text-white/60 text-[11px]">Cats</p>
                      <p className="font-bold">{guild.cats}</p>
                    </div>
                    <div className="bg-black/20 rounded-lg p-2 text-center">
                      <p className="text-white/60 text-[11px]">Wins</p>
                      <p className="font-bold">{guild.wins}</p>
                    </div>
                    <div className="bg-black/20 rounded-lg p-2 text-center col-span-2 sm:col-span-1">
                      <p className="text-white/60 text-[11px]">Avg Pwr</p>
                      <p className="font-bold">{guild.avg_power}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => pledge(guild.guild)}
                    disabled={!!pledgingGuild}
                    className="w-full bg-black/30 hover:bg-black/40 transition-colors rounded-xl py-2.5 font-bold text-sm"
                  >
                    {pledgingGuild === guild.guild ? 'Pledging...' : active ? 'Pledged' : `Pledge to ${info.name}`}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
