'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Swords,
  Shield,
  Zap,
  Wind,
  Sparkles,
  Skull,
  Heart,
  Star,
  Trophy,
  Share2,
} from 'lucide-react';
import Link from 'next/link';
import CatShareButton from '../../components/CatShareButton';
import { DataLoadError } from '../../components/DataLoadError';

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
  win_rate: number | null;
  stance?: string | null;
  fan_count?: number;
  rivalries?: Array<{ cat_id: string; cat_name: string; battles: number }>;
  owner_title?: string | null;
  owner_id: string | null;
  owner_username?: string | null;
  created_at: string;
  viewer_is_owner?: boolean;
  skill_locked?: boolean;
  skill_lock_ends_at?: string | null;
  equipped_skill?: SkillOption | null;
  available_skills?: SkillOption[];
  battle_history: {
    match_id: string;
    opponent_name: string;
    won: boolean;
    my_votes: number;
    opp_votes: number;
    date: string;
  }[];
}

interface SkillOption {
  id: string;
  name: string;
  description?: string | null;
  trigger: string;
  trigger_value?: number | null;
  delta: number;
  is_counter?: boolean;
  counter_to?: string | null;
  trigger_label: string;
}

const RARITY_CONFIG: Record<
  string,
  {
    gradient: string;
    border: string;
    glow: string;
    text: string;
    bg: string;
    tier: number;
  }
> = {
  Common: { gradient: 'from-zinc-400 to-zinc-600', border: 'border-zinc-500/40', glow: '', text: 'text-zinc-300', bg: 'bg-zinc-500/12', tier: 1 },
  Rare: { gradient: 'from-blue-400 to-cyan-500', border: 'border-blue-500/40', glow: 'shadow-[0_0_22px_rgba(59,130,246,0.14)]', text: 'text-blue-300', bg: 'bg-blue-500/12', tier: 2 },
  Epic: { gradient: 'from-purple-400 to-violet-600', border: 'border-purple-500/40', glow: 'shadow-[0_0_24px_rgba(147,51,234,0.16)]', text: 'text-purple-300', bg: 'bg-purple-500/12', tier: 3 },
  Legendary: { gradient: 'from-yellow-400 to-amber-500', border: 'border-yellow-500/40', glow: 'shadow-[0_0_28px_rgba(234,179,8,0.2)]', text: 'text-yellow-300', bg: 'bg-yellow-500/12', tier: 4 },
  Mythic: { gradient: 'from-red-400 to-rose-600', border: 'border-red-500/40', glow: 'shadow-[0_0_32px_rgba(239,68,68,0.2)]', text: 'text-red-300', bg: 'bg-red-500/12', tier: 5 },
  'God-Tier': {
    gradient: 'from-pink-400 via-purple-400 to-cyan-400',
    border: 'border-pink-500/45',
    glow: 'shadow-[0_0_38px_rgba(236,72,153,0.22)]',
    text: 'text-pink-200',
    bg: 'bg-pink-500/14',
    tier: 6,
  },
};

const STAT_CONFIG: Record<string, { icon: React.ReactNode; textColor: string; barColor: string; label: string }> = {
  attack: { icon: <Swords className="w-4 h-4" />, textColor: 'text-red-300', barColor: 'bg-red-400', label: 'Attack' },
  defense: { icon: <Shield className="w-4 h-4" />, textColor: 'text-blue-300', barColor: 'bg-blue-400', label: 'Defense' },
  speed: { icon: <Wind className="w-4 h-4" />, textColor: 'text-emerald-300', barColor: 'bg-emerald-400', label: 'Speed' },
  charisma: { icon: <Heart className="w-4 h-4" />, textColor: 'text-pink-300', barColor: 'bg-pink-400', label: 'Charisma' },
  chaos: { icon: <Skull className="w-4 h-4" />, textColor: 'text-orange-300', barColor: 'bg-orange-400', label: 'Chaos' },
};

function getRarity(rarity: string) {
  return RARITY_CONFIG[rarity] || RARITY_CONFIG.Common;
}

function getStatGrade(stats: CatProfile['stats']) {
  const values = [stats.attack, stats.defense, stats.speed, stats.charisma, stats.chaos];
  const average = values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
  if (average >= 90) return 'S';
  if (average >= 80) return 'A';
  if (average >= 70) return 'B';
  if (average >= 55) return 'C';
  return 'D';
}

function getXpProgress(level: number, xp: number) {
  const target = Math.max(100, level * 100);
  const progress = Math.min((xp / target) * 100, 100);
  return {
    target,
    progress,
    remaining: Math.max(target - xp, 0),
  };
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-2 py-3 text-center">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70">
        {icon}
      </span>
      <span className="text-[10px] uppercase tracking-[0.2em] text-white/35">{label}</span>
      <span className="text-base font-bold text-white">{value}</span>
    </div>
  );
}

function StatRow({ stat, value }: { stat: string; value: number }) {
  const config = STAT_CONFIG[stat];
  if (!config) return null;
  const highStat = value >= 85;

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className={`flex items-center gap-2 ${config.textColor}`}>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/8 bg-black/30">
            {config.icon}
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">{config.label}</p>
            <p className="text-sm font-semibold text-white">
              {value}
              <span className="ml-1 text-xs text-white/35">/100</span>
            </p>
          </div>
        </div>
        {highStat ? (
          <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200">
            High
          </span>
        ) : null}
      </div>
      <div className="mt-3 h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out ${config.barColor}`}
          style={{ width: `${Math.min(value, 100)}%`, opacity: 0.82 }}
        />
      </div>
    </div>
  );
}

export default function CatProfilePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const catId = params?.id as string;
  const from = String(searchParams?.get('from') || '').trim().toLowerCase();
  const ref = String(searchParams?.get('ref') || '').trim();
  const guildFromRef = String(searchParams?.get('guild') || '').trim().toLowerCase();
  const targetParam = String(searchParams?.get('target') || '').trim();
  const pitchParam = String(searchParams?.get('pitch') || '').trim();

  const [cat, setCat] = useState<CatProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [settingStance, setSettingStance] = useState<string | null>(null);
  const [mintingCard, setMintingCard] = useState(false);
  const [challengeBanner, setChallengeBanner] = useState<{ active: boolean; ref: string }>({ active: false, ref: '' });
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  const [pendingSkillId, setPendingSkillId] = useState<string | null>(null);
  const [savingSkill, setSavingSkill] = useState(false);
  const [skillPickerError, setSkillPickerError] = useState<string | null>(null);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);

  const challengeTargetCatId = targetParam && targetParam.length > 10 ? targetParam : catId;

  useEffect(() => {
    if (!catId) return;
    if (String(searchParams?.get('new') || '').trim() !== '1') return;
    const next = new URLSearchParams();
    next.set('new_cat', '1');
    if (ref) next.set('ref', ref);
    router.replace(`/c/${encodeURIComponent(catId)}/share?${next.toString()}`);
  }, [catId, ref, router, searchParams]);

  useEffect(() => {
    if (!catId) return;
    async function loadCat() {
      setLoading(true);
      try {
        const res = await fetch(`/api/cats/${catId}`);
        const data = await res.json();
        if (data.ok) setCat(data.cat);
        else setError(data.error || 'Cat not found');
      } catch {
        setError('Failed to load');
      }
      setLoading(false);
    }
    loadCat();
  }, [catId]);

  useEffect(() => {
    fetch('/api/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setViewerId(d?.guest_id || null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!ref) return;
    setChallengeBanner({ active: true, ref });
    try {
      sessionStorage.setItem('catclash_ref', ref);
      if (challengeTargetCatId) sessionStorage.setItem('catclash_target_cat', String(challengeTargetCatId));
      fetch('/api/referral/visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref,
          guild: guildFromRef === 'sun' || guildFromRef === 'moon' ? guildFromRef : undefined,
          pitch: pitchParam || undefined,
        }),
      }).catch(() => {});
    } catch {
      // ignore
    }
  }, [ref, catId, challengeTargetCatId, guildFromRef, pitchParam]);

  async function setStance(stance: 'aggro' | 'guard' | 'chaos') {
    if (!cat || settingStance) return;
    setSettingStance(stance);
    try {
      const res = await fetch(`/api/cats/${cat.id}/stance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stance }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Failed to set stance');
      } else {
        setCat((prev) => (prev ? { ...prev, stance } : prev));
      }
    } catch {
      setError('Failed to set stance');
    } finally {
      setSettingStance(null);
    }
  }

  const availableSkills = cat?.available_skills || [];
  const pendingSkill = useMemo(
    () => availableSkills.find((skill) => skill.id === pendingSkillId) || null,
    [availableSkills, pendingSkillId]
  );

  function formatSkillDelta(delta: number) {
    const pct = Math.round(Number(delta || 0) * 100);
    return `${pct >= 0 ? '+' : ''}${pct}%`;
  }

  async function saveEquippedSkill() {
    if (!cat || !pendingSkillId || savingSkill || cat.skill_locked) return;
    setSavingSkill(true);
    setError(null);
    setSkillPickerError(null);
    try {
      const res = await fetch(`/api/cat/${cat.id}/skill`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skill_id: pendingSkillId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        if (res.status === 403 && data?.error === 'pulse_locked') {
          setSkillPickerError('Skills are locked — wait for Pulse to resolve');
          setCat((prev) => (prev ? { ...prev, skill_locked: true } : prev));
          return;
        }
        setSkillPickerError(data?.message || data?.error || 'Failed to equip skill');
        return;
      }
      const selected = availableSkills.find((skill) => skill.id === pendingSkillId) || null;
      setCat((prev) => (prev ? { ...prev, equipped_skill: selected } : prev));
      setSkillPickerOpen(false);
      setPendingSkillId(null);
    } catch {
      setSkillPickerError('Failed to equip skill');
    } finally {
      setSavingSkill(false);
    }
  }

  function openSkillPicker() {
    setPendingSkillId(cat?.equipped_skill?.id || availableSkills[0]?.id || null);
    setSkillPickerError(null);
    setSkillPickerOpen(true);
  }

  function closeSkillPicker() {
    if (savingSkill) return;
    setSkillPickerOpen(false);
    setSkillPickerError(null);
  }

  async function openShareScreen() {
    if (!cat || mintingCard) return;
    setMintingCard(true);
    try {
      const res = await fetch('/api/cards/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cat_id: cat.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data?.card?.publicSlug) {
        setError(data?.error || 'Failed to mint share card');
        return;
      }
      window.location.href = `/c/${data.card.publicSlug}/share`;
    } catch {
      setError('Failed to mint share card');
    } finally {
      setMintingCard(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-white/50" />
      </div>
    );
  }

  if (error || !cat) {
    return (
      <DataLoadError
        title="Cat Profile Unavailable"
        message={error ? 'We couldn’t pull this fighter card right now. Give it another try in a moment.' : 'That cat profile isn’t available right now.'}
        onRetry={() => window.location.reload()}
        showRetryButton={!!error}
        backHref="/gallery"
        backLabel="Back to Gallery"
      />
    );
  }

  const r = getRarity(cat.rarity);
  const displayCount = (value: number) => (value > 0 ? value.toLocaleString() : '—');
  const hasBattles = Number(cat.battles_fought || 0) > 0;
  const winRateDisplay = hasBattles && typeof cat.win_rate === 'number' ? `${cat.win_rate}%` : '—';
  const fans = Number(cat.fan_count || 0);
  const skillLocked = !!cat.skill_locked;
  const equippedSkill = cat.equipped_skill || null;
  const statGrade = getStatGrade(cat.stats);
  const xpState = getXpProgress(cat.level, cat.xp);

  return (
    <div className="min-h-screen bg-black text-white pb-28 sm:pb-8">
      <div className={`fixed inset-0 pointer-events-none opacity-20 bg-gradient-to-br ${r.gradient}`} style={{ filter: 'blur(120px)' }} />

      <div className="relative z-10 max-w-lg mx-auto px-4 py-6">
        {from === 'gallery' ? (
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined' && window.history.length > 1) router.back();
              else router.push('/gallery');
            }}
            className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Gallery
          </button>
        ) : (
          <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm mb-6">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        )}

        {challengeBanner.active && (
          <div className="mb-4 rounded-2xl border border-rose-300/30 bg-rose-500/10 p-3.5">
            <p className="text-[11px] uppercase tracking-wider text-rose-200 font-bold">You Were Challenged</p>
            <p className="text-xs text-white/75 mt-1">This fighter was shared to challenge you.</p>
            {(guildFromRef === 'sun' || guildFromRef === 'moon') && (
              <p className="text-[11px] text-cyan-200 mt-1">
                Your friend is a Commander in {guildFromRef === 'sun' ? 'Solar Claw' : 'Lunar Paw'}. Join them for a +10% guild-start XP push.
              </p>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link href={`/submit?ref=${encodeURIComponent(challengeBanner.ref)}`} className="h-10 rounded-xl bg-white text-black text-xs font-bold inline-flex items-center justify-center">
                Submit a Cat
              </Link>
              <Link href="/" className="h-10 rounded-xl bg-white/10 border border-white/15 text-xs font-bold inline-flex items-center justify-center">
                Vote in Arena
              </Link>
            </div>
          </div>
        )}

        <div id="cat-profile-share-card" className={`relative overflow-hidden rounded-[1.9rem] border ${r.border} ${r.glow} bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] backdrop-blur-sm shadow-[0_28px_70px_rgba(0,0,0,0.42)]`}>
          {r.tier >= 4 ? (
            <div
              className="absolute inset-0 z-10 pointer-events-none opacity-10"
              style={{
                background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.4) 45%, transparent 50%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 3s ease-in-out infinite',
              }}
            />
          ) : null}

          <div className="relative h-[25rem] sm:h-[29rem]">
            <img
              src={cat.image_url || '/cat-placeholder.svg'}
              alt={cat.name}
              className="w-full h-full object-cover object-center"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/cat-placeholder.svg';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-black/5" />

            <div className="absolute top-4 left-4 flex gap-2">
              <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.28em] border ${r.border} ${r.bg} ${r.text} ${cat.rarity === 'God-Tier' ? 'shadow-[0_10px_30px_rgba(236,72,153,0.18)]' : 'shadow-[0_10px_24px_rgba(0,0,0,0.2)]'}`}>
                {cat.rarity === 'God-Tier' ? 'GOD TIER' : cat.rarity}
              </span>
              {cat.evolution && cat.evolution !== 'Kitten' ? (
                <span className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.22em] border border-white/10 bg-black/45 text-white/60 backdrop-blur-sm">
                  {cat.evolution}
                </span>
              ) : null}
            </div>

            <div className="absolute top-4 right-4 px-3 py-1.5 rounded-2xl bg-black/65 backdrop-blur-md border border-white/10">
              <span className="text-[10px] uppercase tracking-[0.24em] text-white/45">Level</span>
              <div className="text-lg font-black leading-none mt-1">LV {cat.level}</div>
            </div>

            <div className="absolute inset-x-0 bottom-0 p-5">
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0 max-w-[58%]">
                  <h1 className="text-[2rem] sm:text-[2.4rem] font-black tracking-tight leading-[0.92] text-white drop-shadow-[0_6px_18px_rgba(0,0,0,0.45)]">
                    {cat.name}
                  </h1>
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 backdrop-blur-sm">
                    <Sparkles className={`w-3.5 h-3.5 ${r.text}`} />
                    <span className="text-xs font-semibold text-white/82">{cat.ability || cat.power || 'Unknown ability'}</span>
                  </div>
                </div>
                <div className="shrink-0 rounded-[1.4rem] border border-white/10 bg-black/50 px-4 py-3 text-right backdrop-blur-md">
                  <p className="text-[10px] uppercase tracking-[0.26em] text-white/40">Power</p>
                  <div className={`text-5xl font-black leading-none ${r.text} drop-shadow-[0_0_20px_rgba(255,255,255,0.08)]`}>
                    {cat.total_power}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-5">
            <div className="grid grid-cols-4 divide-x divide-white/8 rounded-[1.4rem] border border-white/10 bg-white/[0.035]">
              <StatTile icon={<Swords className="w-4 h-4" />} label="Battles" value={displayCount(cat.battles_fought)} />
              <StatTile icon={<Trophy className="w-4 h-4" />} label="Wins" value={displayCount(cat.wins)} />
              <StatTile icon={<Shield className="w-4 h-4" />} label="Losses" value={displayCount(cat.losses)} />
              <StatTile icon={<Heart className="w-4 h-4" />} label="Win Rate" value={winRateDisplay} />
            </div>

            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-[0.24em] text-white/30">Combat Stats</h3>
                  <p className="mt-1 text-sm text-white/55">Built for the Arena, scored at a glance.</p>
                </div>
                <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-sm font-black text-white">
                  Grade {statGrade}
                </div>
              </div>
              <div className="space-y-3">
                <StatRow stat="attack" value={cat.stats.attack} />
                <StatRow stat="defense" value={cat.stats.defense} />
                <StatRow stat="speed" value={cat.stats.speed} />
                <StatRow stat="charisma" value={cat.stats.charisma} />
                <StatRow stat="chaos" value={cat.stats.chaos} />
              </div>
            </div>

            <div className="rounded-[1.4rem] border border-amber-300/20 bg-[linear-gradient(180deg,rgba(250,204,21,0.12),rgba(250,204,21,0.03))] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-[0.24em] text-amber-100/75">Experience</h3>
                  <p className="mt-2 text-3xl font-black text-white">
                    {cat.xp.toLocaleString()} <span className="text-lg font-semibold text-white/45">XP</span>
                  </p>
                  <p className="mt-1 text-sm text-amber-100/70">{Math.round(xpState.progress)}% to next level</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">To Next Level</p>
                  <p className="mt-2 text-lg font-bold text-amber-100">{xpState.remaining.toLocaleString()}</p>
                </div>
              </div>
              <div className="mt-4 h-3 rounded-full bg-black/25 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-400 transition-all duration-1000"
                  style={{ width: `${xpState.progress}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-amber-100/65">Keep battling to unlock the next power spike.</p>
            </div>

            <div className="rounded-[1.35rem] bg-white/[0.03] border border-white/8 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-white/30 mb-1">Equipped Skill</div>
                  {equippedSkill ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-white">{equippedSkill.name}</p>
                        {equippedSkill.is_counter ? (
                          <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-amber-200">
                            Counter
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-white/60 mt-1">{equippedSkill.trigger_label}</p>
                      <p className="text-[11px] text-cyan-200 mt-1">{formatSkillDelta(equippedSkill.delta)} win chance</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-white/70">No skill equipped</p>
                      <p className="text-xs text-white/45 mt-1">Choose a signature skill to sharpen this fighter card.</p>
                    </>
                  )}
                  {skillLocked ? <p className="text-[11px] text-amber-200 mt-2">Locked until Pulse resolves</p> : null}
                </div>
                {cat.viewer_is_owner && !skillLocked ? (
                  <button
                    type="button"
                    onClick={openSkillPicker}
                    className="shrink-0 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-100 hover:bg-cyan-500/20"
                  >
                    {equippedSkill ? 'Change' : 'Equip'}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[1.25rem] bg-white/[0.03] p-3.5 border border-white/8">
                <div className="text-[10px] uppercase tracking-[0.22em] text-white/30 mb-1">Stance</div>
                <div className="text-sm font-bold uppercase">{cat.stance || 'none'}</div>
              </div>
              <div className="rounded-[1.25rem] bg-white/[0.03] p-3.5 border border-white/8">
                <div className="text-[10px] uppercase tracking-[0.22em] text-white/30 mb-1">Fans</div>
                <div className="text-sm font-bold">{fans}</div>
                {fans === 0 ? <div className="mt-1 text-[10px] text-white/35">Be the first to fan this cat</div> : null}
              </div>
            </div>

            {viewerId && cat.owner_id === viewerId ? (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.22em] text-white/30 mb-2">Set Daily Stance</h3>
                <div className="grid grid-cols-3 gap-2">
                  {(['aggro', 'guard', 'chaos'] as const).map((stance) => (
                    <button
                      key={stance}
                      onClick={() => setStance(stance)}
                      disabled={!!settingStance}
                      className={`py-2 rounded-xl text-xs uppercase ${cat.stance === stance ? 'bg-cyan-500/30 text-cyan-100' : 'bg-white/10 hover:bg-white/20'} disabled:opacity-40`}
                    >
                      {settingStance === stance ? '...' : stance}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {cat.battle_history.length > 0 ? (
              <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
                <h3 className="text-xs font-bold uppercase tracking-[0.24em] text-white/30 mb-3">Battle Record</h3>
                <div className="space-y-2">
                  {cat.battle_history.map((battle) => (
                    <div
                      key={battle.match_id}
                      className={`flex items-center justify-between rounded-xl p-3 ${battle.won ? 'bg-green-500/[0.06] border border-green-500/12' : 'bg-red-500/[0.06] border border-red-500/12'}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${battle.won ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                          {battle.won ? 'W' : 'L'}
                        </span>
                        <span className="text-sm text-white/78">vs {battle.opponent_name}</span>
                      </div>
                      <span className="text-xs text-white/35">{battle.my_votes}-{battle.opp_votes}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.025] px-4 py-8 text-center">
                <Swords className="w-7 h-7 mx-auto mb-3 text-white/20" />
                <p className="text-base font-semibold text-white/72">No battles yet</p>
                <p className="mt-1 text-sm text-white/42">Take this fighter into the Arena.</p>
                <Link href="/arena" className="mt-4 inline-flex h-11 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-500/14 px-4 text-sm font-bold text-cyan-100">
                  Enter Arena
                </Link>
              </div>
            )}

            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-white/30 mb-1">Owner</div>
                  <div className="text-sm font-medium text-white/78">
                    {cat.owner_id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/profile/${cat.owner_id}`} className="hover:text-white underline-offset-2 hover:underline">
                          {cat.owner_username || cat.owner_id.slice(0, 8)}
                        </Link>
                        {cat.owner_title ? (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-500/15 text-yellow-300 break-words whitespace-normal">
                            {cat.owner_title}
                          </span>
                        ) : null}
                      </div>
                    ) : 'Unknown'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-white/30 mb-1">Created</div>
                  <div className="text-sm font-medium text-white/78">
                    {new Date(cat.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.24em] text-white/30 mb-3">Rivalries</h3>
              {cat.rivalries && cat.rivalries.length > 0 ? (
                <div className="space-y-1.5">
                  {cat.rivalries.map((rival) => (
                    <Link key={rival.cat_id} href={`/cat/${rival.cat_id}`} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06]">
                      <span className="text-sm">{rival.cat_name}</span>
                      <span className="text-xs text-white/40">{rival.battles} battles</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-white/30">No rivalries yet — keep battling to build them.</p>
              )}
            </div>
          </div>
        </div>

        {shareMenuOpen ? (
          <button type="button" aria-label="Close share menu" onClick={() => setShareMenuOpen(false)} className="fixed inset-0 z-30 bg-black/10" />
        ) : null}

        <div className="fixed bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+1rem)] right-4 z-40 flex flex-col items-end gap-2">
          {shareMenuOpen ? (
            <div className="rounded-2xl border border-white/10 bg-black/78 p-2 backdrop-blur-xl shadow-[0_18px_40px_rgba(0,0,0,0.38)]">
              <div className="flex flex-col gap-2">
                <button
                  onClick={openShareScreen}
                  disabled={mintingCard}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white disabled:opacity-50"
                  type="button"
                >
                  {mintingCard ? 'Saving...' : 'Save Image'}
                </button>
                <CatShareButton
                  catName={cat.name}
                  path={`/cat/${cat.id}`}
                  catId={cat.id}
                  captureSelector="#cat-profile-share-card"
                  className="h-11 rounded-xl border border-cyan-400/20 bg-cyan-500/12 px-4 text-sm font-bold text-cyan-100"
                />
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setShareMenuOpen((open) => !open)}
            className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 via-cyan-500 to-violet-500 text-white shadow-[0_18px_36px_rgba(56,189,248,0.25)]"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {skillPickerOpen && cat.viewer_is_owner ? (
        <div className="fixed inset-0 z-[150]" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0 bg-black/65" onClick={closeSkillPicker} aria-label="Close skill picker" />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border border-white/12 border-b-0 bg-neutral-950/96 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] max-w-lg mx-auto">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-bold text-white">Choose Skill</p>
                <p className="text-xs text-white/60 mt-0.5">One skill equipped at a time. Confirm to replace the current slot.</p>
              </div>
              <button
                type="button"
                className="h-8 w-8 rounded-full border border-white/15 bg-white/5 inline-flex items-center justify-center text-white/70"
                onClick={closeSkillPicker}
              >
                ×
              </button>
            </div>

            {skillPickerError ? (
              <div className="mb-3 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-100">
                {skillPickerError}
              </div>
            ) : null}

            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
              {availableSkills.map((skill) => {
                const selected = pendingSkillId === skill.id;
                return (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => setPendingSkillId(skill.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      selected ? 'border-cyan-400/30 bg-cyan-500/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-white">{skill.name}</p>
                          {skill.is_counter ? (
                            <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-amber-200">
                              Counter
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-white/60 mt-1">{skill.trigger_label}</p>
                        {skill.description ? <p className="text-[11px] text-white/40 mt-1">{skill.description}</p> : null}
                      </div>
                      <span className="shrink-0 rounded-lg bg-white/[0.04] px-2 py-1 text-xs font-bold text-cyan-200">
                        {formatSkillDelta(skill.delta)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                type="button"
                onClick={closeSkillPicker}
                className="rounded-xl border border-white/12 bg-white/5 px-3 py-3 text-sm font-bold text-white/70"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!pendingSkill || savingSkill}
                onClick={saveEquippedSkill}
                className="rounded-xl border border-cyan-400/30 bg-cyan-500/15 px-3 py-3 text-sm font-bold text-cyan-100 disabled:opacity-40"
              >
                {savingSkill ? 'Saving...' : pendingSkill ? `Equip ${pendingSkill.name}` : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
