'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Gift, ArrowLeft, Sparkles, Zap, Star, Crown } from 'lucide-react';
import Link from 'next/link';
import SigilIcon from '../components/icons/SigilIcon';
import SigilBalanceChip from '../components/SigilBalanceChip';
import { useRouter } from 'next/navigation';
import CrateReveal from '../components/CrateReveal';

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
  used_bonus_roll?: boolean;
  remaining_bonus_rolls?: number;
  paid_crate_cost?: number;
  sigils_after?: number;
  cat_drop?: {
    id: string;
    name: string;
    image_url: string;
    rarity: string;
    guild_affinity?: 'sun' | 'moon';
    stats?: { power?: number; speed?: number; chaos?: number };
    special_ability_id?: string;
    special_ability_name?: string;
    special_ability_description?: string;
    is_new?: boolean;
  };
  cat_drop_blocked_reason?: 'DAILY_CAP' | 'PAID_CAP' | 'GLOBAL_CAP';
  cat_drop_converted?: boolean;
  cat_drop_conversion_reward?: { type: string; amount: number };
  duplicate_special_ability_id?: string;
  error?: string;
  opening?: {
    id: string;
    status: 'pending' | 'complete';
    cat_id?: string | null;
  };
}

type OpenStage = 'idle' | 'opening' | 'burst' | 'reveal' | 'settle';
type OpenMode = 'daily' | 'paid' | 'epic';

type RevealTiming = {
  openingMs: number;
  burstMs: number;
  revealMs: number;
  totalMs: number;
};

const RARITY_STYLES: Record<string, { bg: string; border: string; text: string; glow: string; particle: string; rays: string }> = {
  xp_sigils: { bg: 'bg-zinc-800', border: 'border-zinc-500', text: 'text-zinc-300', glow: '', particle: '#a1a1aa', rays: '#d4d4d8' },
  duplicate: { bg: 'bg-zinc-800', border: 'border-zinc-500', text: 'text-zinc-300', glow: '', particle: '#a1a1aa', rays: '#d4d4d8' },
  Common: { bg: 'bg-zinc-900', border: 'border-zinc-500', text: 'text-zinc-300', glow: '', particle: '#a1a1aa', rays: '#f4f4f5' },
  Rare: { bg: 'bg-blue-950', border: 'border-blue-500', text: 'text-blue-300', glow: 'shadow-[0_0_40px_rgba(59,130,246,0.3)]', particle: '#3b82f6', rays: '#60a5fa' },
  Epic: { bg: 'bg-purple-950', border: 'border-purple-500', text: 'text-purple-300', glow: 'shadow-[0_0_50px_rgba(147,51,234,0.4)]', particle: '#9333ea', rays: '#c084fc' },
  Legendary: { bg: 'bg-yellow-950', border: 'border-yellow-500', text: 'text-yellow-300', glow: 'shadow-[0_0_60px_rgba(234,179,8,0.5)]', particle: '#eab308', rays: '#facc15' },
  Mythic: { bg: 'bg-fuchsia-950', border: 'border-fuchsia-500', text: 'text-fuchsia-300', glow: 'shadow-[0_0_65px_rgba(217,70,239,0.5)]', particle: '#d946ef', rays: '#f0abfc' },
  'God-Tier': { bg: 'bg-cyan-950', border: 'border-cyan-500', text: 'text-cyan-200', glow: 'shadow-[0_0_70px_rgba(34,211,238,0.5)]', particle: '#22d3ee', rays: '#67e8f9' },
};

function getStyle(rarity: string) {
  return RARITY_STYLES[rarity] || RARITY_STYLES.Common;
}

const CATEGORY_LABELS: Record<string, string> = {
  cat_title: 'Cat Title',
  cat_border: 'Cat Border',
  cat_color: 'Cat Color',
  voter_badge: 'Voter Badge',
  vote_effect: 'Vote Effect',
};

export default function CratePage() {
  const router = useRouter();
  const [stage, setStage] = useState<OpenStage>('idle');
  const [reward, setReward] = useState<CrateReward | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sigils, setSigils] = useState(0);
  const [showTip, setShowTip] = useState(false);
  const [canClaim, setCanClaim] = useState(false);
  const [cardFace, setCardFace] = useState<'front' | 'back'>('back');
  const [shakeScreen, setShakeScreen] = useState(false);
  const [sparkBursts, setSparkBursts] = useState<{ id: number; x: number; y: number; d: number }[]>([]);
  const [pledgedGuild, setPledgedGuild] = useState<'sun' | 'moon' | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [skipReady, setSkipReady] = useState(false);
  const timersRef = useRef<number[]>([]);
  const sequenceStartRef = useRef<number | null>(null);
  const sequenceTimingRef = useRef<RevealTiming>(getRevealTiming('Common', false));
  const PAID_CRATE_COST = 90;
  const EPIC_CRATE_COST = 280;
  const [epicLegendaryBoostIn, setEpicLegendaryBoostIn] = useState<number | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const overlayActive = stage !== 'idle';
  const rarityStyle = reward ? getStyle(reward.rarity) : getStyle('Common');
  const isBigHit = reward ? ['Epic', 'Legendary', 'Mythic', 'God-Tier'].includes(reward.rarity) : false;
  const isCommonHit = reward ? ['Common', 'xp_sigils', 'duplicate'].includes(reward.rarity) : false;
  const shouldFlip = Boolean(reward?.cosmetic && reward?.reward_type !== 'duplicate');
  const rarityForFx = reward?.rarity || 'Common';
  const fx = getFxIntensity(rarityForFx);

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
  }, []);

  const refreshSigils = useCallback(async () => {
    try {
      const res = await fetch('/api/me', { cache: 'no-store' });
      const data = await res.json();
      setSigils(data.data?.progress?.sigils || 0);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refreshSigils();
    fetch('/api/me', { cache: 'no-store' })
      .then((r) => r.json().catch(() => ({})))
      .then((d) => {
        setPledgedGuild((d?.data?.profile?.guild === 'sun' || d?.data?.profile?.guild === 'moon') ? d.data.profile.guild : null);
        setViewerId(String(d?.guest_id || '').trim() || null);
      })
      .catch(() => {});
  }, [refreshSigils]);

  useEffect(() => {
    fetch('/api/crates/latest', { cache: 'no-store' })
      .then((r) => r.json().catch(() => null))
      .then((d) => {
        if (!d?.ok || !d?.opening || !d?.reward) return;
        const savedReward = d.reward as CrateReward;
        setOpeningId(String(d.opening.id || ''));
        setReward(savedReward);
        setError(null);
        clearTimers();
        setStage('reveal');
        setSkipReady(true);
        setCanClaim(false);
        setCardFace('back');
        const flipTimer = window.setTimeout(() => setCardFace('front'), 180);
        const settleTimer = window.setTimeout(() => {
          setStage('settle');
          setCanClaim(true);
        }, 260);
        timersRef.current.push(flipTimer, settleTimer);
      })
      .catch(() => {});
  }, [clearTimers]);

  useEffect(() => {
    fetch('/api/crate/pity?crate_type=epic', { cache: 'no-store' })
      .then((r) => r.json().catch(() => null))
      .then((d) => {
        if (d?.ok) setEpicLegendaryBoostIn(Number(d.legendary_boost_in || 0));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const hidden = localStorage.getItem('tip_crate_v2') === '1';
    setShowTip(!hidden);
  }, []);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 2600);
    return () => window.clearTimeout(t);
  }, [notice]);

  const spawnSparks = useCallback((count = 28) => {
    const next = Array.from({ length: count }, (_, i) => ({
      id: Date.now() + i,
      x: 50 + (Math.random() - 0.5) * 72,
      y: 50 + (Math.random() - 0.5) * 72,
      d: Math.random() * 0.25,
    }));
    setSparkBursts(next);
    const t = window.setTimeout(() => setSparkBursts([]), 1200);
    timersRef.current.push(t);
  }, []);

  const runSequence = useCallback((timing: RevealTiming) => {
    clearTimers();
    sequenceStartRef.current = Date.now();
    sequenceTimingRef.current = timing;
    setStage('opening');
    setSkipReady(false);
    setCanClaim(false);
    setCardFace('back');
    spawnSparks(timing.totalMs >= 1800 ? 28 : 16);

    timersRef.current.push(window.setTimeout(() => {
      setSkipReady(true);
    }, 600));

    timersRef.current.push(window.setTimeout(() => {
      setStage('burst');
      setShakeScreen(true);
      spawnSparks(timing.totalMs >= 1800 ? 34 : 20);
      timersRef.current.push(window.setTimeout(() => setShakeScreen(false), 220));
    }, timing.openingMs));

    timersRef.current.push(window.setTimeout(() => {
      setStage('reveal');
    }, timing.openingMs + timing.burstMs));

    timersRef.current.push(window.setTimeout(() => {
      setStage('settle');
    }, timing.totalMs));
  }, [clearTimers, spawnSparks]);

  const resyncSequenceForRarity = useCallback((rarity: string) => {
    if (!sequenceStartRef.current) return;
    if (stage === 'idle' || stage === 'settle') return;

    const timing = getRevealTiming(rarity, reducedMotion);
    sequenceTimingRef.current = timing;
    const elapsed = Date.now() - sequenceStartRef.current;
    clearTimers();

    timersRef.current.push(window.setTimeout(() => setSkipReady(true), Math.max(0, 600 - elapsed)));

    if (elapsed < timing.openingMs) {
      setStage('opening');
      timersRef.current.push(window.setTimeout(() => {
        setStage('burst');
        setShakeScreen(true);
        spawnSparks(timing.totalMs >= 1800 ? 34 : 20);
        timersRef.current.push(window.setTimeout(() => setShakeScreen(false), 220));
      }, timing.openingMs - elapsed));
      timersRef.current.push(window.setTimeout(() => setStage('reveal'), timing.openingMs + timing.burstMs - elapsed));
      timersRef.current.push(window.setTimeout(() => setStage('settle'), timing.totalMs - elapsed));
      return;
    }

    if (elapsed < timing.openingMs + timing.burstMs) {
      setStage('burst');
      timersRef.current.push(window.setTimeout(() => setStage('reveal'), timing.openingMs + timing.burstMs - elapsed));
      timersRef.current.push(window.setTimeout(() => setStage('settle'), timing.totalMs - elapsed));
      return;
    }

    if (elapsed < timing.totalMs) {
      setStage('reveal');
      timersRef.current.push(window.setTimeout(() => setStage('settle'), timing.totalMs - elapsed));
      return;
    }

    setStage('settle');
  }, [clearTimers, reducedMotion, spawnSparks, stage]);

  useEffect(() => {
    if (stage !== 'reveal' || !reward) return;
    const landingTimer = window.setTimeout(() => {
      if (shouldFlip) {
        setCardFace('back');
        const flipTimer = window.setTimeout(() => setCardFace('front'), 320);
        timersRef.current.push(flipTimer);
      } else {
        setCardFace('front');
      }
    }, 120);
    timersRef.current.push(landingTimer);
  }, [stage, reward, shouldFlip]);

  useEffect(() => {
    if (stage !== 'settle') return;
    setCanClaim(true);
  }, [stage]);

  async function requestReward(mode: OpenMode) {
    const payload =
      mode === 'paid' ? { mode: 'paid', crate_type: 'premium' } :
      mode === 'epic' ? { mode: 'epic', crate_type: 'epic' } :
      undefined;
    const res = await fetch('/api/crates/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  async function openCrate(mode: OpenMode) {
    if (stage !== 'idle') return;
    setError(null);
    setNotice(null);
    setReward(null);
    runSequence(getRevealTiming('Common', reducedMotion));

    try {
      const { status, data } = await requestReward(mode);
      if (!data.success && !data.ok) {
        clearTimers();
        setStage('idle');
        if (status === 409 && data?.pending) {
          setError('Crate opening is finalizing. Please retry in a moment.');
          return;
        }
        setError(data.error || 'Failed to open crate');
        return;
      }
      setReward(data);
      setOpeningId(String(data?.opening?.id || ''));
      resyncSequenceForRarity(String(data?.rarity || 'Common'));
      if (data?.cat_drop_blocked_reason) {
        setNotice('Cat drop limit reached (resets at UTC midnight).');
      } else if (data?.cat_drop_converted) {
        setNotice('Duplicate ability -> converted to Chaos Bonus.');
      }
      refreshSigils();
    } catch {
      clearTimers();
      setStage('idle');
      setError('Network error');
    }
  }

  function skipSequence() {
    if (stage === 'idle' || stage === 'settle' || !skipReady) return;
    clearTimers();
    setStage('reveal');
    if (reward) {
      if (shouldFlip) {
        setCardFace('back');
        const t = window.setTimeout(() => setCardFace('front'), 180);
        timersRef.current.push(t);
      } else {
        setCardFace('front');
      }
      const c = window.setTimeout(() => {
        setStage('settle');
        setCanClaim(true);
      }, 200);
      timersRef.current.push(c);
    } else {
      timersRef.current.push(window.setTimeout(() => setStage('settle'), 200));
    }
  }

  async function claimAndClose() {
    if (openingId) {
      fetch('/api/crates/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openingId }),
      }).catch(() => null);
    }
    clearTimers();
    setStage('idle');
    setReward(null);
    setOpeningId(null);
    setCanClaim(false);
    setCardFace('back');
    setShakeScreen(false);
  }

  async function equipDroppedCosmetic() {
    if (!reward?.cosmetic?.slug) {
      claimAndClose();
      return;
    }
    try {
      const res = await fetch('/api/shop/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: reward.cosmetic.slug }),
      });
      const data = await res.json().catch(() => ({}));
      setNotice(res.ok && data?.ok ? 'Cosmetic equipped.' : 'Could not equip right now.');
    } catch {
      setNotice('Could not equip right now.');
    } finally {
      claimAndClose();
    }
  }

  async function flexCatDrop() {
    if (!reward?.cat_drop?.id) return;
    try {
      const mintRes = await fetch('/api/cards/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cat_id: reward.cat_drop.id }),
      });
      const mintData = await mintRes.json().catch(() => ({}));
      const slug = String(mintData?.card?.publicSlug || '').trim() || reward.cat_drop.id;
      const url = `${window.location.origin}/c/${encodeURIComponent(slug)}${viewerId ? `?ref=${encodeURIComponent(viewerId)}` : ''}`;
      const text = `I just pulled ${reward.cat_drop.name} (${reward.cat_drop.rarity}) with ${reward.cat_drop.special_ability_name || 'a special ability'} in CatClash.`;
      if (navigator.share) {
        await navigator.share({ title: `${reward.cat_drop.name} • CatClash`, text, url });
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
      }
    } catch {
      // ignore share cancel
    }
  }

  return (
    <div className="min-h-screen bg-black text-white pb-28 sm:pb-6">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <SigilBalanceChip balance={sigils} size="sm" />
        </div>

        <h1 className="text-2xl font-bold text-center mb-2">Daily Crate</h1>
        <p className="text-center text-white/40 text-sm mb-8">Open once per day. Cosmetics, XP, and Sigils await.</p>
        {showTip && (
          <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs text-white/65">Tips: prediction streak milestones can grant bonus rolls that bypass the daily crate lock.</p>
              <button
                onClick={() => { localStorage.setItem('tip_crate_v2', '1'); setShowTip(false); }}
                className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
              >
                Got it
              </button>
            </div>
          </div>
        )}

        <div className="relative flex items-center justify-center" style={{ minHeight: 320 }}>
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => openCrate('daily')}
              disabled={overlayActive}
              className="group relative w-48 h-48 rounded-2xl border-2 border-dashed border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10 hover:border-yellow-500/50 transition-all hover:scale-[1.03] disabled:opacity-50 flex flex-col items-center justify-center gap-3"
            >
              <Gift className="w-16 h-16 text-yellow-400 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-bold text-yellow-400">Open Daily Crate</span>
            </button>
            <button
              onClick={() => openCrate('paid')}
              disabled={sigils < PAID_CRATE_COST || overlayActive}
              className="px-4 py-2 rounded-lg bg-cyan-400/20 hover:bg-cyan-400/30 text-cyan-200 text-xs font-bold disabled:opacity-40"
            >
              Buy Extra Crate ({PAID_CRATE_COST} sigils)
            </button>
            <button
              onClick={() => openCrate('epic')}
              disabled={sigils < EPIC_CRATE_COST || overlayActive}
              className="px-4 py-2 rounded-lg border border-purple-300/35 bg-purple-500/20 hover:bg-purple-500/30 text-purple-100 text-xs font-bold disabled:opacity-40"
            >
              ⚡ Epic Chaos Crate ({EPIC_CRATE_COST} sigils)
            </button>
            <p className="text-[11px] text-purple-200/85">High-Voltage Odds</p>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-200 text-sm text-center">{error}</div>
        )}

        <div className="mt-8 text-center space-y-1">
          <p className="text-xs text-white/25">Daily rates: 62% XP/Sigils · 20% Common · 10% Rare · 5% Epic · 2% Legendary · 0.8% Mythic · 0.2% God-Tier</p>
          <p className="text-xs text-cyan-300/55">Paid rates: 45% XP/Sigils · 24% Common · 16% Rare · 9% Epic · 4.5% Legendary · 1.2% Mythic · 0.3% God-Tier</p>
          <details className="mx-auto mt-2 max-w-md text-left rounded-lg border border-purple-300/20 bg-purple-500/10 px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-purple-100">Epic Chaos Crate Odds / Drop Table</summary>
            <p className="mt-1 text-[11px] text-purple-100/85">30% Common · 28% Rare · 20% Epic · 12% Legendary · 7% Mythic · 3% God-Tier</p>
            <p className="mt-1 text-[11px] text-white/70">Value floor: Rare+ cosmetic minimum or equivalent bundle.</p>
            <p className="mt-1 text-[11px] text-white/70">Daily cap: 8 Epic crates.</p>
            <p className="mt-1 text-[11px] text-white/70">
              Pity tracker: Legendary boost in {epicLegendaryBoostIn == null ? '…' : epicLegendaryBoostIn} crates
            </p>
          </details>
        </div>
      </div>

      <CrateReveal
        active={overlayActive}
        stage={stage}
        skipReady={skipReady}
        shakeScreen={shakeScreen}
        fx={fx}
        onSkip={skipSequence}
      >
            {(stage === 'opening' || stage === 'burst') && (
              <div className="relative w-[220px] h-[220px] flex items-center justify-center">
                {sparkBursts.map((p) => (
                  <div
                    key={p.id}
                    className="absolute spark-particle"
                    style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${p.d}s`, color: '#67e8f9' }}
                  >
                    <SigilIcon className="w-3.5 h-3.5" />
                  </div>
                ))}
                <div className={`crate-3d guild-${pledgedGuild || 'neutral'} ${stage === 'opening' ? 'crate-rumble crate-glow' : ''} ${stage === 'burst' ? 'crate-blast' : ''}`}>
                  <div className={`crate-lid-3d ${stage === 'burst' ? 'lid-fly' : ''}`} />
                  <div className="crate-body-3d" />
                  <div className={`crate-leak ${stage === 'opening' || stage === 'burst' ? 'leak-on' : ''}`} />
                </div>
              </div>
            )}

            {(stage === 'reveal' || stage === 'settle') && (
              <div className="relative w-full max-w-sm">
                <div
                  className="sunburst"
                  style={{ ['--ray-color' as string]: rarityStyle.rays }}
                />

                {isBigHit && (
                  <div className="absolute inset-0 pointer-events-none">
                    {Array.from({ length: fx.confettiCount }).map((_, i) => (
                      <span key={i} className="confetti" style={{ left: `${8 + Math.random() * 84}%`, animationDelay: `${Math.random() * 0.35}s` }} />
                    ))}
                  </div>
                )}

                <div className={`loot-card-wrap ${canClaim ? 'landed' : 'rising'} ${isCommonHit ? 'common-shimmer' : ''}`}>
                  <div className={`loot-card-flip ${cardFace === 'front' ? 'flip-front' : ''}`}>
                    <div className="loot-card-face loot-card-back">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">CatClash Loot</p>
                      <Gift className="w-10 h-10 text-yellow-300 mt-2" />
                      <p className="text-xs text-white/70 mt-2">Unsealing...</p>
                    </div>

                    <div className={`loot-card-face loot-card-front border-2 ${rarityStyle.border} ${rarityStyle.bg} ${rarityStyle.glow}`}>
                      {!reward ? (
                        <div className="h-full grid place-items-center text-sm text-white/70">Finalizing reward...</div>
                      ) : (
                        <div className="p-5 text-center h-full flex flex-col justify-between">
                          <div>
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${rarityStyle.text} ${rarityStyle.border} border`}>
                              {reward.rarity === 'Legendary' && <Crown className="w-3 h-3" />}
                              {reward.rarity === 'Epic' && <Star className="w-3 h-3" />}
                              {reward.rarity === 'Rare' && <Zap className="w-3 h-3" />}
                              {(reward.rarity === 'xp_sigils' || reward.rarity === 'duplicate') ? 'BONUS' : reward.rarity}
                            </span>
                            {isCommonHit && <p className="mt-1 text-[10px] text-white/60 uppercase tracking-wide">Quick pop reveal</p>}
                            {reward.cosmetic && (
                              <div className="mt-3">
                                <h3 className={`text-xl font-black ${rarityStyle.text}`}>{reward.cosmetic.name}</h3>
                                <p className="text-xs text-white/55 mt-1">{CATEGORY_LABELS[reward.cosmetic.category] || reward.cosmetic.category}</p>
                                <p className="text-sm text-white/60 mt-2 line-clamp-2">{reward.cosmetic.description}</p>
                              </div>
                            )}
                            {reward.cat_drop && (
                              <div className="mt-3 rounded-xl border border-white/20 bg-black/25 p-2.5 text-left">
                                <div className="flex items-center gap-2">
                                  <img src={reward.cat_drop.image_url || '/cat-placeholder.svg'} alt={reward.cat_drop.name} className="w-11 h-11 rounded-lg object-cover border border-white/20" />
                                  <div className="min-w-0">
                                    <p className="text-sm font-black truncate">{reward.cat_drop.name} {reward.cat_drop.is_new ? <span className="text-[10px] ml-1 px-1.5 py-0.5 rounded bg-emerald-400/20 text-emerald-200">NEW</span> : null}</p>
                                    <p className="text-[10px] text-white/65 uppercase tracking-wide">{reward.cat_drop.guild_affinity === 'sun' ? 'Solar Affinity' : reward.cat_drop.guild_affinity === 'moon' ? 'Lunar Affinity' : 'Arena Affinity'}</p>
                                  </div>
                                </div>
                                <div className="mt-2 rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-2 py-1.5">
                                  <p className="text-[10px] text-cyan-100/85 uppercase tracking-wider">Special Ability</p>
                                  <p className="text-xs font-bold text-cyan-100 mt-0.5">{reward.cat_drop.special_ability_name || 'Unknown Ability'}</p>
                                  <p className="text-[11px] text-white/75 mt-0.5">{reward.cat_drop.special_ability_description || 'Ability data unavailable.'}</p>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-center gap-3 mt-4">
                            {reward.xp_gained > 0 && (
                              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5">
                                <Zap className="w-4 h-4 text-blue-400" />
                                <span className="text-sm font-bold text-blue-300">+{reward.xp_gained} XP</span>
                              </div>
                            )}
                            {reward.sigils_gained > 0 && (
                              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5">
                                <span className="text-sm font-bold text-cyan-100 inline-flex items-center gap-1"><SigilIcon className="w-3.5 h-3.5" />+{reward.sigils_gained}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 text-center">
                  {reward?.cat_drop ? (
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); router.push(`/c/${reward.cat_drop!.id}/share?new_cat=1`); }}
                        disabled={!canClaim || !reward}
                        className="px-4 py-2.5 rounded-xl bg-white text-black font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Go to Cat
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); flexCatDrop(); }}
                        disabled={!canClaim || !reward}
                        className="px-4 py-2.5 rounded-xl bg-emerald-400 text-black font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Share to Flex
                      </button>
                    </div>
                  ) : reward?.cosmetic ? (
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); equipDroppedCosmetic(); }}
                        disabled={!canClaim || !reward}
                        className="px-4 py-2.5 rounded-xl bg-cyan-300 text-black font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Equip
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); claimAndClose(); }}
                        disabled={!canClaim || !reward}
                        className="px-4 py-2.5 rounded-xl bg-white/15 text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Done
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); claimAndClose(); }}
                      disabled={!canClaim || !reward}
                      className="px-6 py-2.5 rounded-xl bg-white text-black font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Done
                    </button>
                  )}
                  <div className="mt-2 text-[11px] text-white/55">
                    {reward ? (reward.used_bonus_roll ? `Bonus roll consumed. Remaining: ${reward.remaining_bonus_rolls || 0}` : `Bonus rolls: ${reward.remaining_bonus_rolls || 0}`) : 'Rolling...'}
                  </div>
                </div>
              </div>
            )}
      </CrateReveal>

      {notice && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[140] rounded-lg border border-cyan-300/35 bg-black/80 px-3 py-2 text-xs text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.18)]">
          {notice}
        </div>
      )}

      <style jsx>{`
        .screen-shake {
          animation: screenShake 260ms linear;
        }

        .spark-particle {
          transform: translate(-50%, -50%) scale(0.65);
          opacity: 0;
          animation: sparkOut var(--fx-spark-duration, 760ms) ease-out forwards;
        }

        .crate-3d {
          width: 180px;
          height: 180px;
          position: relative;
          transform: translateZ(0);
        }

        .crate-body-3d {
          position: absolute;
          left: 16px;
          right: 16px;
          bottom: 20px;
          height: 120px;
          border-radius: 16px;
          background: linear-gradient(160deg, #6b4425 0%, #44210f 65%, #2a160b 100%);
          border: 2px solid rgba(253, 186, 116, 0.35);
          box-shadow: inset 0 -10px 20px rgba(0, 0, 0, 0.35), 0 14px 28px rgba(0, 0, 0, 0.45);
        }
        .crate-3d.guild-sun .crate-body-3d {
          background: linear-gradient(160deg, #8a4f20 0%, #5a2f13 65%, #2f160a 100%);
          border-color: rgba(251, 191, 36, 0.45);
        }
        .crate-3d.guild-sun .crate-lid-3d {
          background: linear-gradient(180deg, #b86423 0%, #6a3512 100%);
          border-color: rgba(251, 191, 36, 0.55);
        }
        .crate-3d.guild-moon .crate-body-3d {
          background: linear-gradient(160deg, #204a8a 0%, #112c55 65%, #0a1630 100%);
          border-color: rgba(103, 232, 249, 0.45);
        }
        .crate-3d.guild-moon .crate-lid-3d {
          background: linear-gradient(180deg, #2f6acc 0%, #1b3c7d 100%);
          border-color: rgba(103, 232, 249, 0.55);
        }

        .crate-lid-3d {
          position: absolute;
          left: 22px;
          right: 22px;
          top: 28px;
          height: 42px;
          border-radius: 12px;
          background: linear-gradient(180deg, #8a5a34 0%, #4e2a15 100%);
          border: 2px solid rgba(251, 191, 36, 0.35);
          transform-origin: center center;
        }

        .crate-rumble {
          animation: crateRumble 180ms ease-in-out infinite;
        }

        .crate-glow .crate-leak {
          opacity: 1;
        }

        .crate-blast {
          animation: cratePop 320ms ease-out forwards;
        }

        .crate-leak {
          position: absolute;
          inset: 18px 26px 22px 26px;
          border-radius: 16px;
          pointer-events: none;
          opacity: 0;
          box-shadow: 0 0 0 rgba(255, 255, 255, 0);
          transition: opacity 180ms ease-out;
        }

        .crate-leak.leak-on {
          opacity: 1;
          box-shadow: 0 0 var(--fx-leak-glow, 55px) 20px rgba(255, 255, 255, 0.85);
        }

        .lid-fly {
          animation: lidFly 420ms ease-out forwards;
        }

        .sunburst {
          position: absolute;
          left: 50%;
          top: 42%;
          width: 280px;
          height: 280px;
          transform: translate(-50%, -50%);
          border-radius: 999px;
          background: repeating-conic-gradient(
            from 0deg,
            color-mix(in oklab, var(--ray-color), transparent 45%) 0deg 8deg,
            transparent 8deg 16deg
          );
          filter: blur(0.2px) drop-shadow(0 0 14px color-mix(in oklab, var(--ray-color), black 20%));
          animation: raysSpin 10s linear infinite;
          opacity: var(--fx-ray-opacity, 0.85);
          pointer-events: none;
        }

        .loot-card-wrap {
          position: relative;
          z-index: 2;
          perspective: 1000px;
        }

        .loot-card-wrap.rising {
          transform: scale(0.65) translateY(70px);
          opacity: 0;
          animation: cardBurst 560ms cubic-bezier(0.2, 0.9, 0.25, 1.08) forwards;
        }

        .loot-card-wrap.landed {
          transform: scale(1) translateY(0);
          opacity: 1;
        }

        .loot-card-flip {
          position: relative;
          width: 100%;
          height: 340px;
          transform-style: preserve-3d;
          transition: transform 620ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .loot-card-flip.flip-front {
          transform: rotateY(180deg);
        }

        .loot-card-face {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border-radius: 18px;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }

        .loot-card-back {
          border: 2px solid rgba(255, 255, 255, 0.28);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.04) 100%);
          display: grid;
          place-content: center;
          text-align: center;
        }

        .loot-card-front {
          transform: rotateY(180deg);
          overflow: hidden;
        }

        .common-shimmer .loot-card-front {
          animation: commonShimmer 460ms ease-out both;
        }

        .confetti {
          position: absolute;
          top: 4%;
          width: 5px;
          height: 12px;
          border-radius: 2px;
          background: linear-gradient(180deg, #fff, #67e8f9);
          opacity: 0;
          animation: confettiFall var(--fx-confetti-duration, 1200ms) ease-out forwards;
        }

        @keyframes crateRumble {
          0% { transform: translate3d(-2px, 1px, 0) scale(calc(var(--fx-rumble-scale, 1.08) - 0.06)) rotate(-1deg); }
          25% { transform: translate3d(2px, -2px, 0) scale(calc(var(--fx-rumble-scale, 1.08) - 0.03)) rotate(1deg); }
          50% { transform: translate3d(-3px, 2px, 0) scale(var(--fx-rumble-scale, 1.08)) rotate(-1.2deg); }
          75% { transform: translate3d(3px, -1px, 0) scale(calc(var(--fx-rumble-scale, 1.08) + 0.02)) rotate(1.2deg); }
          100% { transform: translate3d(-2px, 1px, 0) scale(calc(var(--fx-rumble-scale, 1.08) - 0.02)) rotate(-0.8deg); }
        }

        @keyframes cratePop {
          0% { transform: scale(1); }
          100% { transform: scale(var(--fx-pop-scale, 1.04)); }
        }

        @keyframes lidFly {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(-200px) rotate(-16deg); opacity: 0; }
        }

        @keyframes screenShake {
          0% { transform: translateX(0); }
          25% { transform: translateX(calc(var(--fx-shake-x, 10px) * -1)); }
          50% { transform: translateX(var(--fx-shake-x, 10px)); }
          75% { transform: translateX(calc(var(--fx-shake-x, 10px) * -0.7)); }
          100% { transform: translateX(0); }
        }

        @keyframes sparkOut {
          0% { transform: translate(-50%, -50%) scale(0.4); opacity: 0.9; }
          100% { transform: translate(-50%, -140%) scale(1.2); opacity: 0; }
        }

        @keyframes cardBurst {
          0% { transform: scale(0.65) translateY(70px); opacity: 0; }
          65% { transform: scale(1.03) translateY(-6px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }

        @keyframes commonShimmer {
          0% { box-shadow: 0 0 0 rgba(255,255,255,0); }
          50% { box-shadow: 0 0 28px rgba(244,244,245,0.22); }
          100% { box-shadow: 0 0 0 rgba(255,255,255,0); }
        }

        @keyframes raysSpin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }

        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 0.95; }
          100% { transform: translateY(260px) rotate(240deg); opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .screen-shake,
          .crate-rumble,
          .crate-blast,
          .lid-fly,
          .spark-particle,
          .sunburst,
          .loot-card-wrap.rising,
          .loot-card-flip,
          .confetti,
          .common-shimmer .loot-card-front {
            animation: none !important;
            transition: none !important;
          }
          .sunburst {
            opacity: 0.4;
          }
        }
      `}</style>
    </div>
  );
}

function getFxIntensity(rarity: string) {
  switch (rarity) {
    case 'God-Tier':
      return { screenShakePx: 14, rumbleScale: 1.16, popScale: 1.1, leakGlowPx: 95, rayOpacity: 0.98, sparkDurationMs: 980, confettiDurationMs: 1800, confettiCount: 42 };
    case 'Mythic':
      return { screenShakePx: 12, rumbleScale: 1.14, popScale: 1.085, leakGlowPx: 84, rayOpacity: 0.95, sparkDurationMs: 920, confettiDurationMs: 1600, confettiCount: 36 };
    case 'Legendary':
      return { screenShakePx: 10, rumbleScale: 1.12, popScale: 1.07, leakGlowPx: 74, rayOpacity: 0.92, sparkDurationMs: 860, confettiDurationMs: 1450, confettiCount: 30 };
    case 'Epic':
      return { screenShakePx: 8, rumbleScale: 1.1, popScale: 1.06, leakGlowPx: 64, rayOpacity: 0.9, sparkDurationMs: 820, confettiDurationMs: 1300, confettiCount: 24 };
    case 'Rare':
      return { screenShakePx: 6, rumbleScale: 1.08, popScale: 1.05, leakGlowPx: 56, rayOpacity: 0.87, sparkDurationMs: 780, confettiDurationMs: 1200, confettiCount: 0 };
    default:
      return { screenShakePx: 5, rumbleScale: 1.07, popScale: 1.04, leakGlowPx: 52, rayOpacity: 0.84, sparkDurationMs: 740, confettiDurationMs: 1100, confettiCount: 0 };
  }
}

function getRevealTiming(rarity: string, reducedMotion: boolean): RevealTiming {
  const norm = String(rarity || 'Common');
  const base: Record<string, RevealTiming> = {
    Common: { openingMs: 540, burstMs: 200, revealMs: 220, totalMs: 980 },
    Rare: { openingMs: 760, burstMs: 240, revealMs: 260, totalMs: 1380 },
    Epic: { openingMs: 1040, burstMs: 280, revealMs: 300, totalMs: 1880 },
    Legendary: { openingMs: 1320, burstMs: 320, revealMs: 360, totalMs: 2380 },
    Mythic: { openingMs: 1720, burstMs: 340, revealMs: 360, totalMs: 3000 },
    'God-Tier': { openingMs: 1940, burstMs: 360, revealMs: 380, totalMs: 3280 },
  };
  const selected = base[norm] || base.Common;
  if (!reducedMotion) return selected;
  return {
    openingMs: Math.max(260, Math.round(selected.openingMs * 0.62)),
    burstMs: Math.max(120, Math.round(selected.burstMs * 0.6)),
    revealMs: Math.max(140, Math.round(selected.revealMs * 0.65)),
    totalMs: Math.max(760, Math.round(selected.totalMs * 0.62)),
  };
}
