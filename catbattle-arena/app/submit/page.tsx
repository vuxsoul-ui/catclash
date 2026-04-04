'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Upload, Loader2, Sparkles, Swords, Shield, Wind, Heart, Skull, Zap, Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ECONOMY } from '@/app/api/_lib/economyConstants';
import { LoadingState } from '../components/LoadingState';
import { PostSubmitSuccess } from '../components/PostSubmitSuccess';
import SigilBalanceChip from '../components/SigilBalanceChip';
import { buttonStyles } from '../components/ui/primitives';

const RARITIES = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic', 'God-Tier'];
const RARITY_COLORS: Record<string, string> = {
  Common: 'text-zinc-400 border-zinc-500/40 bg-zinc-500/10',
  Rare: 'text-blue-400 border-blue-500/40 bg-blue-500/10',
  Epic: 'text-purple-400 border-purple-500/40 bg-purple-500/10',
  Legendary: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10',
  Mythic: 'text-red-400 border-red-500/40 bg-red-500/10',
  'God-Tier': 'text-pink-400 border-pink-500/40 bg-pink-500/10',
};
const RARITY_WEIGHTS = [50, 25, 15, 7, 2.5, 0.5];

function rollRarity(): string {
  const roll = Math.random() * 100;
  let cum = 0;
  for (let i = 0; i < RARITIES.length; i += 1) {
    cum += RARITY_WEIGHTS[i];
    if (roll < cum) return RARITIES[i];
  }
  return 'Common';
}

const STAT_RANGES: Record<string, [number, number]> = {
  Common: [30, 55],
  Rare: [45, 70],
  Epic: [55, 82],
  Legendary: [68, 92],
  Mythic: [78, 96],
  'God-Tier': [88, 99],
};

function rollStats(rarity: string): Record<string, number> {
  const [min, max] = STAT_RANGES[rarity] || [30, 55];
  const roll = () => min + Math.floor(Math.random() * (max - min + 1));
  return { attack: roll(), defense: roll(), speed: roll(), charisma: roll(), chaos: roll() };
}

const STAT_ICONS: Record<string, React.ReactNode> = {
  attack: <Swords className="w-3.5 h-3.5" />,
  defense: <Shield className="w-3.5 h-3.5" />,
  speed: <Wind className="w-3.5 h-3.5" />,
  charisma: <Heart className="w-3.5 h-3.5" />,
  chaos: <Skull className="w-3.5 h-3.5" />,
};
const STAT_COLORS: Record<string, string> = {
  attack: 'text-red-400',
  defense: 'text-blue-400',
  speed: 'text-green-400',
  charisma: 'text-pink-400',
  chaos: 'text-orange-400',
};
const STAT_BAR_COLORS: Record<string, string> = {
  attack: 'bg-red-400',
  defense: 'bg-blue-400',
  speed: 'bg-green-400',
  charisma: 'bg-pink-400',
  chaos: 'bg-orange-400',
};

const POWERS = ['Laser Eyes', 'Ultimate Fluff', 'Chaos Mode', 'Nine Lives', 'Royal Aura', 'Underdog Boost', 'Shadow Step', 'Thunder Paws', 'Frost Bite', 'Hypno Purr'];

type SubmitPhase = 'choose' | 'form' | 'rolling' | 'reveal' | 'submitting' | 'done';

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default function SubmitPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<SubmitPhase>('choose');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null);
  const [cropPendingFile, setCropPendingFile] = useState<File | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropX, setCropX] = useState(50);
  const [cropY, setCropY] = useState(50);
  const [cropApplying, setCropApplying] = useState(false);

  const [rarity, setRarity] = useState('');
  const [stats, setStats] = useState<Record<string, number>>({});
  const [power, setPower] = useState('');
  const [rollingText, setRollingText] = useState('');
  const [rollingName, setRollingName] = useState('');
  const [rollingPreview, setRollingPreview] = useState<string | null>(null);

  const [rerollCount, setRerollCount] = useState(0);
  const [sigils, setSigils] = useState(0);

  const [mintingShare, setMintingShare] = useState(false);

  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [savingNotify, setSavingNotify] = useState(false);
  const [hasUsername, setHasUsername] = useState<boolean | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const cropSourceRef = useRef<string | null>(null);

  const loadState = useCallback(async () => {
    try {
      const [meRes, prefRes] = await Promise.all([
        fetch('/api/me', { cache: 'no-store' }),
        fetch('/api/notifications/preferences', { cache: 'no-store' }),
      ]);
      const me = await meRes.json().catch(() => ({}));
      const pref = await prefRes.json().catch(() => ({}));
      const resolvedHasUsername = !!String(me?.data?.profile?.username || '').trim();
      setSigils(me?.data?.progress?.sigils || 0);
      setHasUsername(resolvedHasUsername);
      if (prefRes.ok && pref?.ok) {
        setNotifyEnabled(!!pref.preference?.cat_photo_approved_enabled);
        setNotifyEmail(pref.preference?.email || '');
      }
      return resolvedHasUsername;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    let retryTimerA: number | null = null;
    let retryTimerB: number | null = null;

    const refreshState = async () => {
      const resolved = await loadState();
      if (!alive) return;
      if (!resolved) {
        retryTimerA = window.setTimeout(() => { void loadState(); }, 350);
        retryTimerB = window.setTimeout(() => { void loadState(); }, 1200);
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) void loadState();
    };
    const handleWindowFocus = () => { void loadState(); };
    const handlePageShow = () => { void loadState(); };

    void refreshState();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('pageshow', handlePageShow);
      if (retryTimerA) window.clearTimeout(retryTimerA);
      if (retryTimerB) window.clearTimeout(retryTimerB);
    };
  }, [loadState]);

  useEffect(() => {
    if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:') && previewUrlRef.current !== preview) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = preview;
  }, [preview]);

  useEffect(() => {
    if (cropSourceRef.current && cropSourceRef.current.startsWith('blob:') && cropSourceRef.current !== cropSourceUrl) {
      URL.revokeObjectURL(cropSourceRef.current);
    }
    cropSourceRef.current = cropSourceUrl;
  }, [cropSourceUrl]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current && previewUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      if (cropSourceRef.current && cropSourceRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(cropSourceRef.current);
      }
    };
  }, []);

  async function persistNotifyPreferenceIfNeeded(): Promise<boolean> {
    if (!notifyEnabled) return true;
    const email = notifyEmail.trim().toLowerCase();
    if (!validEmail(email)) {
      setError('Enter a valid email to enable photo-approved notifications.');
      return false;
    }
    setSavingNotify(true);
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          cat_photo_approved_enabled: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Failed to save notification preference.');
        return false;
      }
      return true;
    } catch {
      setError('Failed to save notification preference.');
      return false;
    } finally {
      setSavingNotify(false);
    }
  }

  async function disableNotifyPreference() {
    if (notifyEnabled) return;
    try {
      await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: notifyEmail.trim().toLowerCase(),
          cat_photo_approved_enabled: false,
        }),
      });
    } catch {
      // ignore
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      setError('Max 5MB');
      return;
    }
    const source = URL.createObjectURL(f);
    setCropPendingFile(f);
    setCropSourceUrl(source);
    setCropZoom(1);
    setCropX(50);
    setCropY(50);
    setCropModalOpen(true);
    setError(null);
    if (e.target) e.target.value = '';
  }

  async function applyCrop() {
    if (!cropPendingFile || !cropSourceUrl || cropApplying) return;
    setCropApplying(true);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = cropSourceUrl;
      });

      const sourceW = image.naturalWidth || image.width;
      const sourceH = image.naturalHeight || image.height;
      const cx = (clamp(cropX, 0, 100) / 100) * sourceW;
      const cy = (clamp(cropY, 0, 100) / 100) * sourceH;
      const cropSide = Math.max(64, Math.min(sourceW, sourceH) / clamp(cropZoom, 1, 3));
      const sx = clamp(cx - cropSide / 2, 0, Math.max(0, sourceW - cropSide));
      const sy = clamp(cy - cropSide / 2, 0, Math.max(0, sourceH - cropSide));

      const outSize = 1080;
      const canvas = document.createElement('canvas');
      canvas.width = outSize;
      canvas.height = outSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.drawImage(image, sx, sy, cropSide, cropSide, 0, 0, outSize, outSize);

      const inputType = (cropPendingFile.type || '').toLowerCase();
      const outputType = inputType === 'image/png' || inputType === 'image/webp' ? inputType : 'image/jpeg';
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, outputType, outputType === 'image/jpeg' ? 0.92 : 0.9);
      });
      if (!blob) throw new Error('Failed to crop');

      const ext = outputType === 'image/png' ? 'png' : outputType === 'image/webp' ? 'webp' : 'jpg';
      const croppedFile = new File([blob], `${(cropPendingFile.name || 'cat').replace(/\.[^.]+$/, '')}-cropped.${ext}`, { type: outputType });
      const croppedPreview = URL.createObjectURL(blob);

      setFile(croppedFile);
      setPreview(croppedPreview);
      setCropModalOpen(false);
      setCropPendingFile(null);
      setCropSourceUrl(null);
      setError(null);
    } catch {
      setError('Failed to crop image');
    } finally {
      setCropApplying(false);
    }
  }

  async function startRoll() {
    if (!name.trim() || !file) {
      setError('Name and image required');
      return;
    }
    setError(null);
    setRollingName(name.trim());
    setRollingPreview(preview);
    setPhase('rolling');

    const finalRarity = rollRarity();
    for (let i = 0; i < 15; i += 1) {
      const fakeRarity = RARITIES[Math.floor(Math.random() * RARITIES.length)];
      setRollingText(fakeRarity);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 80 + i * 20));
    }
    setRarity(finalRarity);
    setRollingText(finalRarity);
    await new Promise((r) => setTimeout(r, 350));

    setStats(rollStats(finalRarity));
    setPower(POWERS[Math.floor(Math.random() * POWERS.length)]);
    setPhase('reveal');
  }

  async function submitCat() {
    if (phase !== 'reveal') return;
    if (hasUsername !== true) {
      setError('Set a username before submitting a cat.');
      router.push('/login?next=%2Fsubmit');
      return;
    }
    setError(null);

    if (notifyEnabled) {
      const ok = await persistNotifyPreferenceIfNeeded();
      if (!ok) return;
    } else {
      await disableNotifyPreference();
    }

    setPhase('submitting');
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('image', file!);
      formData.append('rarity', rarity);
      formData.append('attack', String(stats.attack));
      formData.append('defense', String(stats.defense));
      formData.append('speed', String(stats.speed));
      formData.append('charisma', String(stats.charisma));
      formData.append('chaos', String(stats.chaos));
      formData.append('power', power);
      if (description.trim()) formData.append('description', description.trim());
      formData.append('reroll_count', String(rerollCount));

      const res = await fetch('/api/cats/submit', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'Submission failed');
        setPhase('reveal');
        return;
      }
      const createdCatId = String(data?.cat_id || '');
      if (createdCatId) {
        const slug = await mintShareCard(createdCatId);
        if (slug) {
          window.location.href = `/c/${slug}/share?new_cat=1`;
          return;
        }
      }
      setPhase('done');
    } catch {
      setError('Network error');
      setPhase('reveal');
    }
  }

  async function mintShareCard(catId: string): Promise<string | null> {
    const id = String(catId || '').trim();
    if (!id) return null;
    setMintingShare(true);
    try {
      const res = await fetch('/api/cards/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cat_id: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok || !data?.card?.publicSlug) {
        setError(data?.error || 'Failed to mint share card');
        return null;
      }
      const slug = String(data.card.publicSlug || '');
      return slug;
    } catch {
      setError('Failed to mint share card');
      return null;
    } finally {
      setMintingShare(false);
    }
  }

  const rarityStyle = RARITY_COLORS[rarity] || RARITY_COLORS.Common;
  const usernameResolved = hasUsername !== null;
  const nextRerollCost = (rerollCount + 1) * ECONOMY.REROLL_COST_SIGILS;
  const canAffordReroll = sigils >= nextRerollCost;
  const sigilsNeededForReroll = Math.max(0, nextRerollCost - sigils);

  return (
    <div className="min-h-screen bg-black text-white pb-28 sm:pb-6">
      <div className="mx-auto max-w-lg px-3 py-6 sm:px-4 sm:py-8">
        <Link href="/" className="group mb-6 inline-flex items-center gap-2 text-sm font-medium text-white/45 hover:text-white/80 sm:mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" /> Back
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-black tracking-tight text-white">Build Your Cat Entry</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-white/55">Submit your own cat, roll stats, and jump straight into Arena play.</p>
        </div>

        <div className="mb-5 flex items-center justify-between gap-3">
          <SigilBalanceChip balance={sigils} size="sm" className="shrink-0" />
          <span className="text-xs text-white/40">Your currency for rerolls & boosts</span>
        </div>

        {hasUsername === null && (
          <LoadingState
            compact
            icon="✨"
            message="Checking trainer access..."
            className="mb-5 rounded-xl border border-cyan-300/20 bg-cyan-500/8 px-4 py-4 shadow-[0_14px_34px_rgba(8,145,178,0.12)]"
          />
        )}
        {hasUsername === false && (
          <div className="mb-5 overflow-hidden rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-500/12 via-amber-500/8 to-amber-600/10 p-4 shadow-[0_12px_40px_rgba(245,158,11,0.15)]">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-300/30 bg-amber-400/20">
                <span className="text-lg">🔐</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-100">Claim Your Trainer Identity</p>
                <p className="mt-0.5 text-xs leading-relaxed text-amber-200/70">Set your username to unlock cat submissions and enter the arena.</p>
                <Link
                  href="/login?next=%2Fsubmit"
                  className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 text-sm font-bold tracking-wide text-black shadow-lg shadow-amber-500/25 transition-all hover:shadow-xl hover:shadow-amber-400/30 active:scale-[0.98]"
                >
                  Claim Username
                </Link>
              </div>
            </div>
          </div>
        )}

        <details className="group mb-6 overflow-hidden rounded-2xl border border-white/5 bg-white/[0.025] sm:mb-8">
          <summary className="list-none cursor-pointer select-none flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-white/[0.03]">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">📜</span>
              <p className="text-sm font-bold text-white/90">How It Works</p>
            </div>
            <span className="text-xs text-white/40 group-open:hidden">Open</span>
            <span className="text-xs text-white/40 hidden group-open:inline">Close</span>
          </summary>
          <div className="space-y-2 border-t border-white/5 px-4 py-3.5 text-sm leading-relaxed text-white/55">
            <p><span className="text-cyan-300 font-semibold">Vote & Predict:</span> Earn XP and sigils in active arenas.</p>
            <p><span className="text-emerald-300 font-semibold">Submit:</span> Upload your cat to enter live battles.</p>
            <p><span className="text-orange-300 font-semibold">Roll Stats:</span> Each cat gets a unique ability + 5 stat profile.</p>
            <p><span className="text-yellow-300 font-semibold">Photo Review:</span> Admin approval required before public display.</p>
          </div>
        </details>

        {error && (
          <div className="mb-5 overflow-hidden rounded-xl border border-red-400/30 bg-red-500/10 p-3.5 text-sm text-red-100 shadow-[0_8px_24px_rgba(239,68,68,0.12)]">
            {error}
          </div>
        )}

        {phase === 'choose' && (
          <div className="space-y-4">
            <button
              onClick={() => {
                if (hasUsername !== true) {
                  setError('Set a username before submitting a cat.');
                  router.push('/login?next=%2Fsubmit');
                  return;
                }
                setPhase('form');
              }}
              disabled={hasUsername !== true}
              className="group w-full overflow-hidden rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-cyan-500/15 via-cyan-500/10 to-cyan-600/10 p-5 text-left shadow-[0_12px_40px_rgba(6,182,212,0.12)] transition-all hover:border-cyan-300/40 hover:shadow-[0_16px_48px_rgba(6,182,212,0.18)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-400/20 group-hover:scale-105 transition-transform">
                  <Sparkles className="h-5 w-5 text-cyan-200" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold text-cyan-100">Forge Your Cat</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/60">
                    {usernameResolved
                      ? 'Upload your cat, roll unique stats & abilities, and enter the arena.'
                      : 'Complete your trainer profile to unlock cat forging.'}
                  </p>
                </div>
              </div>
            </button>

            <div className="overflow-hidden rounded-xl border border-white/5 bg-white/[0.025] p-4">
              <div className="mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-300" />
                <p className="text-sm font-bold text-white/90">Stay Updated</p>
              </div>
              <p className="mb-3 text-sm leading-relaxed text-white/55">Get notified when your cat photo passes review.</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input-focus flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/20"
                />
                <label className="group flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-white/75 transition-all hover:border-white/20 hover:bg-white/[0.08]">
                  <input
                    type="checkbox"
                    checked={notifyEnabled}
                    onChange={(e) => setNotifyEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-white/10 text-cyan-400 focus:ring-cyan-400/30"
                  />
                  <span className="font-medium group-hover:text-white/90">Notify me</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {phase === 'form' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/35">Submit Flow</p>
              <button onClick={() => setPhase('choose')} className="text-xs font-medium px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors">Back</button>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">Cat Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={30}
                placeholder="e.g. Sir Whiskers III"
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white placeholder:text-white/25 transition-all focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">Portrait</label>
              <input type="file" ref={fileRef} accept="image/*" onChange={handleFile} className="hidden" />
              {preview ? (
                <div className="group relative overflow-hidden rounded-xl cursor-pointer" onClick={() => fileRef.current?.click()}>
                  <div className="aspect-square">
                    <img src={preview} alt="Preview" className="w-full h-full object-cover object-center" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
                    <span className="text-sm font-bold text-white drop-shadow-lg">Change Photo</span>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/10 bg-white/[0.02] transition-all duration-200 hover:border-cyan-400/30 hover:bg-cyan-500/[0.04] active:translate-y-[1px]"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 group-hover:bg-cyan-400/10 transition-colors">
                    <Upload className="w-6 h-6 text-white/30 group-hover:text-cyan-300 transition-colors" />
                  </div>
                  <span className="text-sm font-medium text-white/60 group-hover:text-white/80">Tap to upload</span>
                  <span className="text-xs text-white/35">JPG, PNG, max 5MB</span>
                </button>
              )}
              {preview && file && (
                <div className="mt-2.5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setCropPendingFile(file);
                      setCropSourceUrl(preview);
                      setCropZoom(1);
                      setCropX(50);
                      setCropY(50);
                      setCropModalOpen(true);
                    }}
                    className="h-9 rounded-lg border border-white/15 bg-white/[0.06] px-3 text-xs font-semibold text-white/80 transition-all hover:bg-white/10 hover:border-white/25 active:translate-y-[1px]"
                  >
                    Re-crop Photo
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">Description <span className="text-white/35">(optional)</span></label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={200}
                placeholder="A fearsome floof with a taste for chaos..."
                rows={2}
                className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/25 transition-all focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/20"
              />
              <span className="mt-1 block text-right text-[10px] text-white/30">{description.length}/200</span>
            </div>

            <button
              onClick={startRoll}
              disabled={!name.trim() || !file || savingNotify}
              className="group relative h-12 w-full overflow-hidden rounded-xl bg-gradient-to-r from-cyan-400 via-emerald-400 to-cyan-400 text-sm font-bold tracking-wide text-black shadow-lg shadow-cyan-500/25 transition-all hover:shadow-xl hover:shadow-cyan-400/35 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-300 via-emerald-300 to-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative inline-flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4" /> Roll Stats
              </span>
            </button>
          </div>
        )}

        {phase === 'rolling' && (
          <div className="text-center py-12">
            <div className="mb-6">
              {rollingPreview && (
                <div className="group mx-auto w-32 h-32 rounded-xl overflow-hidden mb-4 animate-pulse shadow-[0_0_40px_rgba(34,211,238,0.2)]">
                  <img src={rollingPreview} alt="" className="w-full h-full object-cover object-center" />
                </div>
              )}
              <h2 className="mb-2 text-2xl font-black tracking-tight text-white">{rollingName}</h2>
            </div>
            <div className="text-3xl font-black animate-pulse drop-shadow-[0_0_25px_rgba(255,255,255,0.15)]">
              <span className={RARITY_COLORS[rollingText]?.split(' ')[0] || 'text-white'}>{rollingText}</span>
            </div>
            <p className="mt-4 text-sm text-white/50">Rolling rarity...</p>
          </div>
        )}

        {phase === 'reveal' && (
          <div className="space-y-5">
            <div className={`group overflow-hidden rounded-2xl border ${rarityStyle.split(' ')[1]} bg-gradient-to-br from-black/60 via-black/40 to-black/50 shadow-[0_20px_60px_rgba(0,0,0,0.4)]`}>
              {preview && (
                <div className="relative h-56">
                  <img src={preview} alt={name} className="w-full h-full object-cover object-center" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
                  <div className="absolute top-3 left-3">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border shadow-lg ${rarityStyle} ${rarity === 'God-Tier' ? 'shadow-[0_0_20px_rgba(236,72,153,0.3)]' : 'shadow-[0_0_16px_rgba(0,0,0,0.3)]'}`}>
                      {rarity === 'God-Tier' ? '✦ GOD TIER' : rarity}
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3">
                    <h2 className="text-2xl font-black text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]">{name}</h2>
                    <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-2.5 py-1 backdrop-blur-sm">
                      <Zap className="w-3.5 h-3.5 text-yellow-400" />
                      <span className="text-xs font-medium text-white/80">{power}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3.5 p-5 sm:p-6">
                {description && (
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2.5">
                    <p className="text-sm italic leading-relaxed text-white/55">&ldquo;{description}&rdquo;</p>
                  </div>
                )}
                {Object.entries(stats).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2.5">
                    <div className={`flex items-center gap-1.5 w-16 ${STAT_COLORS[key]}`}>
                      {STAT_ICONS[key]}
                      <span className="text-[10px] font-black uppercase tracking-wide">{key.slice(0, 3)}</span>
                    </div>
                    <div className="flex-1 h-2.5 bg-white/[0.05] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${STAT_BAR_COLORS[key]} shadow-[0_0_10px_currentColor]`} style={{ width: `${val}%`, opacity: 0.75, transition: 'width 1s ease-out' }} />
                    </div>
                    <span className="w-8 text-right text-xs font-mono font-bold text-white/70">{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {rerollCount > 0 && (
              <div className="text-center text-sm text-amber-300/70">
                {rerollCount} re-roll{rerollCount > 1 ? 's' : ''} used · <span className="font-semibold text-amber-200">{rerollCount * ECONOMY.REROLL_COST_SIGILS} sigils</span> will be charged on submit
              </div>
            )}

            <div className="flex gap-3">
              {canAffordReroll ? (
                <button
                  onClick={() => {
                    setRerollCount((prev) => prev + 1);
                    setPhase('form');
                    setRarity('');
                    setStats({});
                    setPower('');
                    setError(null);
                  }}
                  className="group relative h-11 flex-1 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] text-sm font-bold text-white/85 transition-all hover:border-white/20 hover:bg-white/[0.06] hover:text-white active:scale-[0.98]"
                >
                  Re-Roll ({ECONOMY.REROLL_COST_SIGILS} ✦)
                </button>
              ) : (
                <div className="flex flex-1 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-500/8 px-3 text-center text-sm text-amber-200/75">
                  Need {sigilsNeededForReroll} more ✦ to re-roll
                </div>
              )}
              <button
                onClick={submitCat}
                className="group relative h-11 flex-1 overflow-hidden rounded-xl bg-gradient-to-r from-cyan-400 via-emerald-400 to-cyan-400 text-sm font-bold tracking-wide text-black shadow-lg shadow-cyan-500/25 transition-all hover:shadow-xl hover:shadow-cyan-400/35 active:scale-[0.98]"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-300 via-emerald-300 to-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative inline-flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4" /> Submit{rerollCount > 0 ? ` (-${rerollCount * ECONOMY.REROLL_COST_SIGILS} ✦)` : ''}
                </span>
              </button>
            </div>
          </div>
        )}

        {phase === 'submitting' && (
          <LoadingState
            icon="🔥"
            message="Forging your cat..."
            className="py-12"
          />
        )}

        {phase === 'done' && (
          <PostSubmitSuccess
            catName={name}
            onDismiss={() => {
              setPhase('choose');
              setName('');
              setDescription('');
              setFile(null);
              setPreview(null);
              setRarity('');
              setStats({});
              setPower('');
              setRerollCount(0);
              setError(null);
            }}
          />
        )}

        {(phase === 'form' || phase === 'choose') && (
          <div className="mt-8 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
            <p className="text-center text-[10px] font-medium uppercase tracking-wider text-white/35">Drop Rates</p>
            <p className="mt-1 text-center text-xs text-white/45">50% Common · 25% Rare · 15% Epic · 7% Legendary · 2.5% Mythic · 0.5% God-Tier</p>
          </div>
        )}
      </div>

      {cropModalOpen && cropSourceUrl && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0f0f13] via-[#0a0a0f] to-[#0d0d0f] p-5 sm:p-6 shadow-[0_40px_120px_rgba(0,0,0,0.6)]">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-400/10">
                <Sparkles className="h-4 w-4 text-cyan-300" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Crop Your Cat</h3>
                <p className="text-xs text-white/45">Position and zoom to frame perfectly</p>
              </div>
            </div>

            <div className="relative w-full aspect-square overflow-hidden rounded-xl border border-white/10 bg-black shadow-[inset_0_0_40px_rgba(0,0,0,0.6)] mb-4">
              <img
                src={cropSourceUrl}
                alt="Crop preview"
                className="w-full h-full object-cover select-none pointer-events-none"
                style={{
                  transform: `scale(${cropZoom})`,
                  transformOrigin: `${cropX}% ${cropY}%`,
                  objectPosition: `${cropX}% ${cropY}%`,
                }}
              />
              <div className="absolute inset-0 rounded-xl border-2 border-white/20 pointer-events-none shadow-[inset_0_0_30px_rgba(0,0,0,0.4)]" />
            </div>

            <div className="space-y-3 mb-5">
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45">Zoom</span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={cropZoom}
                  onChange={(e) => setCropZoom(Number(e.target.value))}
                  className="w-full mt-1 h-1.5 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(34,211,238,0.5)]"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45">Horizontal</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.1}
                  value={cropX}
                  onChange={(e) => setCropX(Number(e.target.value))}
                  className="w-full mt-1 h-1.5 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(34,211,238,0.5)]"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45">Vertical</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.1}
                  value={cropY}
                  onChange={(e) => setCropY(Number(e.target.value))}
                  className="w-full mt-1 h-1.5 rounded-full bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(34,211,238,0.5)]"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setCropModalOpen(false);
                  setCropPendingFile(null);
                  setCropSourceUrl(null);
                }}
                className="h-11 rounded-xl border border-white/10 bg-white/[0.04] text-sm font-semibold text-white/80 transition-all hover:bg-white/10 hover:border-white/20"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={cropApplying}
                onClick={applyCrop}
                className="group relative h-11 overflow-hidden rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 text-sm font-bold text-black shadow-lg shadow-cyan-500/20 transition-all hover:shadow-xl hover:shadow-cyan-400/30 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-300 to-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                {cropApplying ? <Loader2 className="relative w-4 h-4 animate-spin" /> : <Check className="relative w-4 h-4" />}
                <span className="relative">Apply Crop</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
