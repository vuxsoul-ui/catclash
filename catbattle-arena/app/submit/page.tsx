// REPLACE: app/submit/page.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Upload, Loader2, Sparkles, Swords, Shield, Wind, Heart, Skull, Zap, Check, Coins } from 'lucide-react';
import Link from 'next/link';

const RARITIES = ['Common','Rare','Epic','Legendary','Mythic','God-Tier'];
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
  for (let i = 0; i < RARITIES.length; i++) {
    cum += RARITY_WEIGHTS[i];
    if (roll < cum) return RARITIES[i];
  }
  return 'Common';
}

const STAT_RANGES: Record<string, [number, number]> = {
  Common: [30, 55], Rare: [45, 70], Epic: [55, 82],
  Legendary: [68, 92], Mythic: [78, 96], 'God-Tier': [88, 99],
};

function rollStats(rarity: string): Record<string, number> {
  const [min, max] = STAT_RANGES[rarity] || [30, 55];
  const roll = () => min + Math.floor(Math.random() * (max - min + 1));
  return { attack: roll(), defense: roll(), speed: roll(), charisma: roll(), chaos: roll() };
}

const STAT_ICONS: Record<string, React.ReactNode> = {
  attack: <Swords className="w-3.5 h-3.5" />, defense: <Shield className="w-3.5 h-3.5" />,
  speed: <Wind className="w-3.5 h-3.5" />, charisma: <Heart className="w-3.5 h-3.5" />,
  chaos: <Skull className="w-3.5 h-3.5" />,
};
const STAT_COLORS: Record<string, string> = {
  attack: 'text-red-400', defense: 'text-blue-400', speed: 'text-green-400',
  charisma: 'text-pink-400', chaos: 'text-orange-400',
};
const STAT_BAR_COLORS: Record<string, string> = {
  attack: 'bg-red-400', defense: 'bg-blue-400', speed: 'bg-green-400',
  charisma: 'bg-pink-400', chaos: 'bg-orange-400',
};

const POWERS = ['Laser Eyes','Ultimate Fluff','Chaos Mode','Nine Lives','Royal Aura','Underdog Boost','Shadow Step','Thunder Paws','Frost Bite','Hypno Purr'];

const REROLL_COST = 50;

export default function SubmitPage() {
  const [phase, setPhase] = useState<'form'|'rolling'|'reveal'|'submitting'|'done'>('form');
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Rolled values
  const [catId, setCatId] = useState<string | null>(null);
  const [rarity, setRarity] = useState('');
  const [stats, setStats] = useState<Record<string, number>>({});
  const [power, setPower] = useState('');
  const [rollingText, setRollingText] = useState('');

  // Sigils
  const [sigils, setSigils] = useState<number>(0);
  const [isRerolling, setIsRerolling] = useState(false);
  const [rerollCount, setRerollCount] = useState(0);

  const fileRef = useRef<HTMLInputElement>(null);

  // Fetch user's sigils on mount
  useEffect(() => {
    fetchSigils();
  }, []);

  async function fetchSigils() {
    try {
      const res = await fetch('/api/me');
      const data = await res.json();
      if (data.data?.progress?.sigils !== undefined) {
        setSigils(data.data.progress.sigils);
      }
    } catch (e) {
      console.error('Failed to fetch sigils:', e);
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setError('Max 5MB'); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError(null);
  }

  async function startRoll() {
    if (!name.trim() || !file) { setError('Name and image required'); return; }
    setError(null);
    setPhase('rolling');

    // Rarity roll animation
    const finalRarity = rollRarity();
    for (let i = 0; i < 15; i++) {
      const fakeRarity = RARITIES[Math.floor(Math.random() * RARITIES.length)];
      setRollingText(fakeRarity);
      await new Promise(r => setTimeout(r, 80 + i * 20));
    }
    setRarity(finalRarity);
    setRollingText(finalRarity);
    await new Promise(r => setTimeout(r, 400));

    // Stats roll
    const finalStats = rollStats(finalRarity);
    setStats(finalStats);

    // Power roll
    const finalPower = POWERS[Math.floor(Math.random() * POWERS.length)];
    setPower(finalPower);

    // Create draft cat in database
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('image', file);
      formData.append('rarity', finalRarity);
      formData.append('attack', String(finalStats.attack));
      formData.append('defense', String(finalStats.defense));
      formData.append('speed', String(finalStats.speed));
      formData.append('charisma', String(finalStats.charisma));
      formData.append('chaos', String(finalStats.chaos));
      formData.append('power', finalPower);
      formData.append('isDraft', 'true'); // Important: create as draft

      const res = await fetch('/api/cats/submit', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error || 'Failed to create cat');
        setPhase('form');
        return;
      }

      setCatId(data.cat_id);
      setPhase('reveal');
    } catch {
      setError('Network error');
      setPhase('form');
    }
  }  // <-- THIS CLOSING BRACE WAS MISSING

  async function handleReroll() {
    if (!catId || isRerolling) return;
    if (sigils < REROLL_COST) {
      setError(`Not enough sigils! Need ${REROLL_COST}, have ${sigils}`);
      return;
    }

    setIsRerolling(true);
    setError(null);

    try {
      const res = await fetch('/api/cats/reroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catId }),
      });

      const data = await res.json();

      if (!data.ok) {
        setError(data.error || 'Reroll failed');
        if (data.currentSigils !== undefined) {
          setSigils(data.currentSigils);
        }
        setIsRerolling(false);
        return;
      }

      // Update stats with new values
      setStats({
        attack: data.stats.attack,
        defense: data.stats.defense,
        speed: data.stats.speed,
        charisma: data.stats.charisma,
        chaos: data.stats.chaos,
      });
      setPower(data.stats.power);
      setSigils(data.remainingSigils);
      setRerollCount(prev => prev + 1);

      // Brief animation
      setPhase('rolling');
      await new Promise(r => setTimeout(r, 300));
      setPhase('reveal');

    } catch {
      setError('Reroll failed');
    } finally {
      setIsRerolling(false);
    }
  }

  async function submitCat() {
    if (phase !== 'reveal' || !catId) return;
    setPhase('submitting');
    
    try {
      const res = await fetch('/api/cats/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catId }),
      });
      // ... rest
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error || 'Submission failed');
        setPhase('reveal');
        return;
      }

      setPhase('done');
    } catch {
      setError('Network error');
      setPhase('reveal');
    }
  }

  const rarityStyle = RARITY_COLORS[rarity] || RARITY_COLORS['Common'];

  const canReroll = sigils >= REROLL_COST && !isRerolling;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-lg mx-auto px-4 py-6">
        <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <h1 className="text-2xl font-bold mb-2">Submit Your Cat</h1>
        <p className="text-white/40 text-sm mb-6">Name your warrior, upload their portrait, and let fate decide their power.</p>

        {error && <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-200 text-sm">{error}</div>}

        {/* FORM PHASE */}
        {phase === 'form' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-white/30 mb-1 block">Cat Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} maxLength={30}
                placeholder="e.g. Sir Whiskers III"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:border-yellow-500/50 focus:outline-none" />
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
                <button onClick={() => fileRef.current?.click()}
                  className="w-full aspect-[4/3] rounded-xl border-2 border-dashed border-white/10 hover:border-white/20 flex flex-col items-center justify-center gap-2 transition-colors">
                  <Upload className="w-8 h-8 text-white/20" />
                  <span className="text-sm text-white/30">Tap to upload</span>
                  <span className="text-xs text-white/15">JPG, PNG, max 5MB</span>
                </button>
              )}
            </div>

            <button onClick={startRoll} disabled={!name.trim() || !file}
              className="w-full py-3 rounded-xl bg-yellow-500 text-black font-bold hover:bg-yellow-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" /> Roll Stats
            </button>
          </div>
        )}

        {/* ROLLING PHASE */}
        {phase === 'rolling' && (
          <div className="text-center py-12">
            <div className="mb-6">
              {preview && (
                <div className="w-32 h-32 mx-auto rounded-xl overflow-hidden mb-4 animate-pulse">
                  <img src={preview} alt="" className="w-full h-full object-cover object-center" />
                </div>
              )}
              <h2 className="text-xl font-bold mb-2">{name}</h2>
            </div>
            <div className="text-3xl font-black animate-pulse">
              <span className={RARITY_COLORS[rollingText]?.split(' ')[0] || 'text-white'}>{rollingText}</span>
            </div>
            <p className="text-xs text-white/30 mt-4">Rolling rarity...</p>
          </div>
        )}

        {/* REVEAL PHASE */}
        {phase === 'reveal' && (
          <div className="space-y-4">
            {/* Sigils Bar */}
            <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-white/60">Your Sigils</span>
              </div>
              <span className="font-bold text-yellow-400">{sigils}</span>
            </div>

            {/* Cat card preview */}
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
                {Object.entries(stats).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2">
                    <div className={`flex items-center gap-1 w-14 ${STAT_COLORS[key]}`}>
                      {STAT_ICONS[key]}
                      <span className="text-[10px] font-bold uppercase">{key.slice(0, 3)}</span>
                    </div>
                    <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${STAT_BAR_COLORS[key]}`}
                        style={{ width: `${val}%`, opacity: 0.7, transition: 'width 1s ease-out' }} />
                    </div>
                    <span className="text-xs font-mono text-white/50 w-7 text-right">{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reroll Info */}
            {rerollCount > 0 && (
              <p className="text-center text-xs text-white/30">
                Rerolled {rerollCount} time{rerollCount !== 1 ? 's' : ''}
              </p>
            )}

            <div className="flex gap-3">
              <button 
                onClick={handleReroll}
                disabled={!canReroll}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 ${
                  canReroll 
                    ? 'bg-white/10 hover:bg-white/20 text-white' 
                    : 'bg-white/5 text-white/30 cursor-not-allowed'
                }`}
              >
                {isRerolling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Re-Roll
                    <span className="text-xs opacity-60">({REROLL_COST})</span>
                  </>
                )}
              </button>
              
              <button onClick={submitCat}
                className="flex-1 py-3 rounded-xl bg-yellow-500 text-black font-bold hover:bg-yellow-400 transition-colors flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> Submit
              </button>
            </div>

            {!canReroll && sigils < REROLL_COST && (
              <p className="text-center text-xs text-red-400/60">
                Not enough sigils! Vote in matches to earn more.
              </p>
            )}
          </div>
        )}

        {/* SUBMITTING */}
        {phase === 'submitting' && (
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 animate-spin text-yellow-400 mx-auto mb-4" />
            <p className="text-white/60">Submitting your warrior...</p>
          </div>
        )}

        {/* DONE */}
        {phase === 'done' && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-xl font-bold mb-2">Submitted!</h2>
            <p className="text-white/50 text-sm mb-6">{name} is awaiting approval. Once approved, they&apos;ll enter the arena.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => { 
                setPhase('form'); 
                setName(''); 
                setFile(null); 
                setPreview(null); 
                setRarity(''); 
                setStats({}); 
                setPower(''); 
                setCatId(null);
                setRerollCount(0);
              }}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-bold transition-colors">
                Submit Another
              </button>
              <Link href="/" className="px-5 py-2.5 rounded-xl bg-yellow-500 text-black text-sm font-bold hover:bg-yellow-400 transition-colors">
                Back to Arena
              </Link>
            </div>
          </div>
        )}

        {phase === 'form' && (
          <p className="text-center text-xs text-white/15 mt-6">Drop rates: 50% Common · 25% Rare · 15% Epic · 7% Legendary · 2.5% Mythic · 0.5% God-Tier</p>
        )}
      </div>
    </div>
  );
}