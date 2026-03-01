'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Upload, Loader2, Sparkles, Swords, Shield, Wind, Heart, Skull, Zap, Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SigilBalanceChip from '../components/SigilBalanceChip';

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
  const REROLL_COST = 25;

  const [submittedCatId, setSubmittedCatId] = useState<string | null>(null);
  const [mintingShare, setMintingShare] = useState(false);

  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [savingNotify, setSavingNotify] = useState(false);
  const [hasUsername, setHasUsername] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const cropSourceRef = useRef<string | null>(null);

  useEffect(() => {
    async function loadState() {
      try {
        const [meRes, prefRes] = await Promise.all([
          fetch('/api/me', { cache: 'no-store' }),
          fetch('/api/notifications/preferences', { cache: 'no-store' }),
        ]);
        const me = await meRes.json().catch(() => ({}));
        const pref = await prefRes.json().catch(() => ({}));
        setSigils(me?.data?.progress?.sigils || 0);
        setHasUsername(!!String(me?.data?.profile?.username || '').trim());
        if (prefRes.ok && pref?.ok) {
          setNotifyEnabled(!!pref.preference?.cat_photo_approved_enabled);
          setNotifyEmail(pref.preference?.email || '');
        }
      } catch {
        // ignore
      }
    }
    loadState();
  }, []);

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
    if (!hasUsername) {
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
      setSubmittedCatId(createdCatId);
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

  return (
    <div className="min-h-screen bg-black text-white pb-28 sm:pb-6">
      <div className="max-w-lg mx-auto px-4 py-6">
        <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <h1 className="text-2xl font-bold mb-2">Build Your Cat Entry</h1>
        <div className="flex items-start justify-between mb-5 gap-3">
          <p className="text-white/40 text-sm">Submit your own cat, roll stats, and jump straight into Arena play.</p>
          <SigilBalanceChip balance={sigils} size="sm" className="shrink-0" />
        </div>
        {!hasUsername && (
          <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
            <p className="text-xs text-amber-100">
              Choose a username to unlock submissions.
            </p>
            <Link
              href="/login?next=%2Fsubmit"
              className="mt-2 inline-flex h-9 items-center rounded-lg bg-amber-300 px-3 text-xs font-bold text-black"
            >
              Claim Username
            </Link>
          </div>
        )}

        <details className="mb-5 rounded-xl border border-white/10 bg-white/[0.03] p-3 group">
          <summary className="list-none cursor-pointer select-none flex items-center justify-between">
            <p className="text-xs font-bold text-white">Tutorial</p>
            <span className="text-[11px] text-white/45 group-open:hidden">Open</span>
            <span className="text-[11px] text-white/45 hidden group-open:inline">Close</span>
          </summary>
          <div className="space-y-1.5 text-xs text-white/65 mt-2">
            <p><span className="text-cyan-300 font-bold">How it works:</span> Vote and predict in active arenas to earn XP and sigils.</p>
            <p><span className="text-emerald-300 font-bold">Submission:</span> upload your own cat to enter live arenas.</p>
            <p><span className="text-orange-300 font-bold">Skills and stats:</span> each cat gets an ability plus Attack/Defense/Speed/Charisma/Chaos profile.</p>
            <p><span className="text-yellow-300 font-bold">Photo review:</span> uploads need admin review before they appear publicly.</p>
          </div>
        </details>

        {error && <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-200 text-sm">{error}</div>}

        {phase === 'choose' && (
          <div className="space-y-3">
            <button
              onClick={() => {
                if (!hasUsername) {
                  setError('Set a username before submitting a cat.');
                  router.push('/login?next=%2Fsubmit');
                  return;
                }
                setPhase('form');
              }}
              disabled={!hasUsername}
              className="w-full text-left rounded-xl border border-blue-400/30 bg-blue-500/10 p-4"
            >
              <p className="text-sm font-bold text-blue-200">Submit Your Own Cat (Personal Start)</p>
              <p className="text-xs text-white/60 mt-1">Upload your own cat photo, roll stats/ability, and build identity.</p>
            </button>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-xs font-bold text-white mb-2">Optional Email</p>
              <p className="text-xs text-white/60 mb-2">Get notified when your cat photo is approved.</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm focus:outline-none focus:border-white/30"
                />
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-xs">
                  <input
                    type="checkbox"
                    checked={notifyEnabled}
                    onChange={(e) => setNotifyEnabled(e.target.checked)}
                  />
                  Notify me
                </label>
              </div>
            </div>
          </div>
        )}

        {phase === 'form' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/40 uppercase tracking-wider">Submit Flow</p>
              <button onClick={() => setPhase('choose')} className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20">Back</button>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-white/30 mb-1 block">Cat Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={30}
                placeholder="e.g. Sir Whiskers III"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:border-yellow-500/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-white/30 mb-1 block">Portrait</label>
              <input type="file" ref={fileRef} accept="image/*" onChange={handleFile} className="hidden" />
              {preview ? (
                <div className="relative rounded-xl overflow-hidden cursor-pointer" onClick={() => fileRef.current?.click()}>
                  <div className="aspect-square">
                    <img src={preview} alt="Preview" className="w-full h-full object-cover object-center" />
                  </div>
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <span className="text-sm font-bold">Change Photo</span>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full aspect-[4/3] rounded-xl border-2 border-dashed border-white/10 hover:border-white/20 flex flex-col items-center justify-center gap-2 transition-colors"
                >
                  <Upload className="w-8 h-8 text-white/20" />
                  <span className="text-sm text-white/30">Tap to upload</span>
                  <span className="text-xs text-white/15">JPG, PNG, max 5MB</span>
                </button>
              )}
              {preview && file && (
                <div className="mt-2 flex justify-end">
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
                    className="h-8 px-3 rounded-lg bg-white/10 border border-white/15 text-[11px] font-semibold hover:bg-white/15"
                  >
                    Re-crop Photo
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-white/30 mb-1 block">Description <span className="text-white/15">(optional)</span></label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={200}
                placeholder="A fearsome floof with a taste for chaos..."
                rows={2}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:border-yellow-500/50 focus:outline-none resize-none text-sm"
              />
              <span className="text-[10px] text-white/15 mt-0.5 block text-right">{description.length}/200</span>
            </div>

            <button
              onClick={startRoll}
              disabled={!name.trim() || !file || savingNotify}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-400 to-rose-400 text-black font-bold hover:from-orange-300 hover:to-rose-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" /> Roll Stats
            </button>
          </div>
        )}

        {phase === 'rolling' && (
          <div className="text-center py-12">
            <div className="mb-6">
              {rollingPreview && (
                <div className="w-32 h-32 mx-auto rounded-xl overflow-hidden mb-4 animate-pulse">
                  <img src={rollingPreview} alt="" className="w-full h-full object-cover object-center" />
                </div>
              )}
              <h2 className="text-xl font-bold mb-2">{rollingName}</h2>
            </div>
            <div className="text-3xl font-black animate-pulse">
              <span className={RARITY_COLORS[rollingText]?.split(' ')[0] || 'text-white'}>{rollingText}</span>
            </div>
            <p className="text-xs text-white/30 mt-4">Rolling rarity...</p>
          </div>
        )}

        {phase === 'reveal' && (
          <div className="space-y-4">
            <div className={`rounded-2xl overflow-hidden border ${rarityStyle.split(' ')[1]} bg-black/40`}>
              {preview && (
                <div className="relative h-56">
                  <img src={preview} alt={name} className="w-full h-full object-cover object-center" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                  <div className="absolute top-3 left-3">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${rarityStyle}`}>
                      {rarity === 'God-Tier' ? '✦ GOD TIER' : rarity}
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-3">
                    <h2 className="text-xl font-black">{name}</h2>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Zap className="w-3 h-3 text-yellow-400" />
                      <span className="text-xs text-white/60">{power}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 space-y-3">
                {description && (
                  <p className="text-xs text-white/40 italic pb-2 border-b border-white/5">&ldquo;{description}&rdquo;</p>
                )}
                {Object.entries(stats).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2">
                    <div className={`flex items-center gap-1 w-14 ${STAT_COLORS[key]}`}>
                      {STAT_ICONS[key]}
                      <span className="text-[10px] font-bold uppercase">{key.slice(0, 3)}</span>
                    </div>
                    <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${STAT_BAR_COLORS[key]}`} style={{ width: `${val}%`, opacity: 0.7, transition: 'width 1s ease-out' }} />
                    </div>
                    <span className="text-xs font-mono text-white/50 w-7 text-right">{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {rerollCount > 0 && (
              <div className="text-center text-xs text-yellow-400/60">
                {rerollCount} re-roll{rerollCount > 1 ? 's' : ''} used · {rerollCount * REROLL_COST} sigils will be charged on submit
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  const nextCost = (rerollCount + 1) * REROLL_COST;
                  if (sigils < nextCost) {
                    setError(`Not enough sigils for re-roll. Need ${REROLL_COST} more, have ${sigils - rerollCount * REROLL_COST} remaining.`);
                    return;
                  }
                  setRerollCount((prev) => prev + 1);
                  setPhase('form');
                  setRarity('');
                  setStats({});
                  setPower('');
                  setError(null);
                }}
                className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 font-bold text-sm transition-colors"
              >
                Re-Roll ({REROLL_COST} ✦)
              </button>
              <button
                onClick={submitCat}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 text-black font-bold hover:from-cyan-300 hover:to-emerald-300 transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> Submit{rerollCount > 0 ? ` (-${rerollCount * REROLL_COST} ✦)` : ''}
              </button>
            </div>
          </div>
        )}

        {phase === 'submitting' && (
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 animate-spin text-yellow-400 mx-auto mb-4" />
            <p className="text-white/60">Submitting your warrior...</p>
          </div>
        )}

        {phase === 'done' && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-xl font-bold mb-2">Submitted!</h2>
            <p className="text-white/50 text-sm mb-6">{name} is live now. The photo stays hidden until admin approval, then appears across Gallery and profiles.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setPhase('choose');
                  setName('');
                  setDescription('');
                  setFile(null);
                  setPreview(null);
                  setRarity('');
                  setStats({});
                  setPower('');
                  setRerollCount(0);
                  setSubmittedCatId(null);
                  setError(null);
                }}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-bold transition-colors"
              >
                Add Another Cat
              </button>
              <Link href="/tournament" className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-400 to-rose-400 text-black text-sm font-bold hover:from-orange-300 hover:to-rose-300 transition-colors">
                Open Arenas
              </Link>
            </div>
          </div>
        )}

        {(phase === 'form' || phase === 'choose') && (
          <p className="text-center text-xs text-white/15 mt-6">Drop rates: 50% Common · 25% Rare · 15% Epic · 7% Legendary · 2.5% Mythic · 0.5% God-Tier</p>
        )}
      </div>

      {cropModalOpen && cropSourceUrl && (
        <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-sm px-4 py-6 flex items-center justify-center">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0d0d0d] p-4">
            <h3 className="text-sm font-bold mb-2">Crop your cat photo</h3>
            <p className="text-[11px] text-white/55 mb-3">Move and zoom before submitting.</p>

            <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-white/10 bg-black mb-3">
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
              <div className="absolute inset-0 border border-white/25 pointer-events-none" />
            </div>

            <div className="space-y-2 mb-4">
              <label className="block text-[11px] text-white/60">
                Zoom
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={cropZoom}
                  onChange={(e) => setCropZoom(Number(e.target.value))}
                  className="w-full mt-1"
                />
              </label>
              <label className="block text-[11px] text-white/60">
                Horizontal
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.1}
                  value={cropX}
                  onChange={(e) => setCropX(Number(e.target.value))}
                  className="w-full mt-1"
                />
              </label>
              <label className="block text-[11px] text-white/60">
                Vertical
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.1}
                  value={cropY}
                  onChange={(e) => setCropY(Number(e.target.value))}
                  className="w-full mt-1"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setCropModalOpen(false);
                  setCropPendingFile(null);
                  setCropSourceUrl(null);
                }}
                className="h-10 rounded-xl bg-white/10 border border-white/15 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={cropApplying}
                onClick={applyCrop}
                className="h-10 rounded-xl bg-cyan-300 text-black text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {cropApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Apply Crop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
