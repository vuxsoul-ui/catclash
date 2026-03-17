// REPLACE: app/cat/[id]/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Loader2, Swords, Shield, Zap,
  Wind, Sparkles, Skull, Heart, Star,
} from 'lucide-react';
import Link from 'next/link';
import CatShareButton from '../../components/CatShareButton';

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

  const challengeTargetCatId = (targetParam && targetParam.length > 10) ? targetParam : catId;

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
      } catch { setError('Failed to load'); }
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
        setCat((prev) => prev ? { ...prev, stance } : prev);
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
          setCat((prev) => prev ? { ...prev, skill_locked: true } : prev);
          return;
        }
        setSkillPickerError(data?.message || data?.error || 'Failed to equip skill');
        return;
      }
      const selected = availableSkills.find((skill) => skill.id === pendingSkillId) || null;
      setCat((prev) => prev ? { ...prev, equipped_skill: selected } : prev);
      setSkillPickerOpen(false);
      setPendingSkillId(null);
    } catch {
      setSkillPickerError('Failed to equip skill');
    } finally {
      setSavingSkill(false);
    }
  }

  function openSkillPicker() {
    setPendingSkillId(equippedSkill?.id || availableSkills[0]?.id || null);
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
  const displayCount = (value: number) => (value > 0 ? value.toLocaleString() : '—');
  const hasBattles = Number(cat.battles_fought || 0) > 0;
  const winRateDisplay = hasBattles && typeof cat.win_rate === 'number' ? `${cat.win_rate}%` : '—';
  const fans = Number(cat.fan_count || 0);
  const skillLocked = !!cat.skill_locked;
  const equippedSkill = cat.equipped_skill || null;

  return (
    <div className="min-h-screen bg-black text-white pb-28 sm:pb-6">
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
        <div className="mb-4">
          {challengeBanner.active && (
            <div className="mb-3 rounded-xl border border-rose-300/30 bg-rose-500/10 p-3">
              <p className="text-[11px] uppercase tracking-wider text-rose-200 font-bold">You Were Challenged</p>
              <p className="text-xs text-white/75 mt-1">
                This fighter was shared to challenge you.
              </p>
              {(guildFromRef === 'sun' || guildFromRef === 'moon') && (
                <p className="text-[11px] text-cyan-200 mt-1">
                  Your friend is a Commander in {guildFromRef === 'sun' ? 'Solar Claw' : 'Lunar Paw'}. Join them for a +10% guild-start XP push.
                </p>
              )}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Link href={`/submit?ref=${encodeURIComponent(challengeBanner.ref)}`} className="h-9 rounded-lg bg-white text-black text-xs font-bold inline-flex items-center justify-center">
                  Submit a Cat to Fight
                </Link>
                <Link href="/" className="h-9 rounded-lg bg-white/10 border border-white/15 text-xs font-bold inline-flex items-center justify-center">
                  Vote in Main Arena
                </Link>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <CatShareButton
              catName={cat.name}
              path={`/cat/${cat.id}`}
              catId={cat.id}
              captureSelector="#cat-profile-share-card"
            />
            <button
              onClick={openShareScreen}
              disabled={mintingCard}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-100 disabled:opacity-50"
              type="button"
            >
              {mintingCard ? 'Minting...' : 'Fighter Card'}
            </button>
          </div>
        </div>

        <div id="cat-profile-share-card" className={`relative rounded-2xl overflow-hidden border ${r.border} ${r.glow} bg-black/60 backdrop-blur-sm`}>
          {r.tier >= 4 && (
            <div className="absolute inset-0 z-10 pointer-events-none opacity-10"
              style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.4) 45%, transparent 50%)', backgroundSize: '200% 100%', animation: 'shimmer 3s ease-in-out infinite' }} />
          )}

          {/* Cat Image */}
          <div className="relative h-72 sm:h-80">
            <img src={cat.image_url || '/cat-placeholder.svg'} alt={cat.name}
              className="w-full h-full object-cover object-center"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/cat-placeholder.svg'; }} />
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
                <div className="text-lg font-bold">{displayCount(cat.battles_fought)}</div>
                <div className="text-[10px] uppercase tracking-wider text-white/30">Battles</div>
              </div>
              <div className="rounded-xl bg-green-500/[0.06] p-3">
                <div className="text-lg font-bold text-green-400">{displayCount(cat.wins)}</div>
                <div className="text-[10px] uppercase tracking-wider text-white/30">Wins</div>
              </div>
              <div className="rounded-xl bg-red-500/[0.06] p-3">
                <div className="text-lg font-bold text-red-400">{displayCount(cat.losses)}</div>
                <div className="text-[10px] uppercase tracking-wider text-white/30">Losses</div>
              </div>
              <div className="rounded-xl bg-white/[0.03] p-3">
                <div className="text-lg font-bold">{winRateDisplay}</div>
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

            <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Equipped Skill</div>
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
                      <p className="text-xs text-white/45 mt-1">Choose one skill identity for this cat.</p>
                    </>
                  )}
                  {skillLocked ? (
                    <p className="text-[11px] text-amber-200 mt-2">Locked until Pulse resolves</p>
                  ) : null}
                </div>
                {cat.viewer_is_owner && !skillLocked ? (
                  <button
                    type="button"
                    onClick={openSkillPicker}
                    className="shrink-0 rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-100 hover:bg-cyan-500/20"
                  >
                    {equippedSkill ? 'Change' : 'Choose Skill'}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/[0.03] p-3">
                <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Stance</div>
                <div className="text-sm font-bold uppercase">{cat.stance || 'none'}</div>
              </div>
              <div className="rounded-xl bg-white/[0.03] p-3">
                <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Fans</div>
                <div className="text-sm font-bold">{fans}</div>
                {fans === 0 && (
                  <div className="mt-1 text-[10px] text-white/35">Be the first to fan this cat</div>
                )}
              </div>
            </div>
            {viewerId && cat.owner_id === viewerId && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/30 mb-2">Set Daily Stance</h3>
                <div className="grid grid-cols-3 gap-2">
                  {(['aggro', 'guard', 'chaos'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStance(s)}
                      disabled={!!settingStance}
                      className={`py-1.5 rounded-lg text-xs uppercase ${cat.stance === s ? 'bg-cyan-500/30 text-cyan-100' : 'bg-white/10 hover:bg-white/20'} disabled:opacity-40`}
                    >
                      {settingStance === s ? '...' : s}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                <div className="text-sm font-medium text-white/70">
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
                <p className="text-sm text-white/30">No battles yet. Enter the Arena to start fighting.</p>
              </div>
            )}

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white/30 mb-3">Rivalries</h3>
              {cat.rivalries && cat.rivalries.length > 0 ? (
                <div className="space-y-1.5">
                  {cat.rivalries.map((rival) => (
                    <Link key={rival.cat_id} href={`/cat/${rival.cat_id}`} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.03] border border-white/5 hover:bg-white/[0.06]">
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
