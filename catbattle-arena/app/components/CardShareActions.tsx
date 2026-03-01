'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Link2, Share2, X, Rocket } from 'lucide-react';
import FighterCard, { FighterCardView } from './FighterCard';
import { showGlobalToast } from '../lib/global-toast';

const SHARE_REWARD_COOLDOWN_SECONDS = 60;

export default function CardShareActions({
  card,
  publicUrl: _publicUrl,
  screenshotOnly = false,
  isNewCat = false,
}: {
  card: FighterCardView;
  publicUrl: string;
  screenshotOnly?: boolean;
  isNewCat?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [screenshotMode, setScreenshotMode] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [didCelebrate, setDidCelebrate] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const filename = useMemo(() => `CatWars_${card.name.replace(/[^a-z0-9]+/gi, '_')}_${card.rarity}.png`, [card.name, card.rarity]);
  const shareUrl = useMemo(() => {
    const target = `/c/${encodeURIComponent(card.slug)}`;
    const ref = viewerId ? `?ref=${encodeURIComponent(viewerId)}` : '';
    if (typeof window === 'undefined') return `${target}${ref}`;
    return `${window.location.origin}${target}${ref}`;
  }, [card.slug, viewerId]);

  function showToast(msg: string) {
    showGlobalToast(msg, 2000);
  }

  useEffect(() => {
    fetch('/api/me', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setViewerId(d?.guest_id || null))
      .catch(() => setViewerId(null));
  }, []);

  useEffect(() => {
    if (!isNewCat || didCelebrate) return;
    setDidCelebrate(true);
    setShowCelebration(true);
    window.setTimeout(() => setShowCelebration(false), 2000);
    showToast('New Recruit! Your fighter card is live.');
    try {
      const A = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (A) {
        const ctx = new A();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = 620;
        o.connect(g);
        g.connect(ctx.destination);
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
        o.start();
        o.stop(ctx.currentTime + 0.24);
      }
    } catch {
      // ignore audio failures
    }
  }, [didCelebrate, isNewCat]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const id = window.setInterval(() => {
      setCooldownSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldownSeconds]);

  const claimShareReward = useCallback(async (method: 'share' | 'copy') => {
    if (!card.catId) return;
    try {
      const res = await fetch('/api/rewards/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cat_id: card.catId, method }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) return;

      if (data.rewarded) {
        setCooldownSeconds(Number(data.cooldown_seconds || SHARE_REWARD_COOLDOWN_SECONDS));
        showToast(`+${Number(data.sigils_awarded || 0)} Sigils for sharing`);
        return;
      }
      if (data.reason === 'cooldown') {
        setCooldownSeconds(Number(data.cooldown_seconds || 0));
        showToast(`Next reward in ${Number(data.cooldown_seconds || 0)}s`);
        return;
      }
      if (data.reason === 'daily_cap_reached') {
        showToast('Daily share reward cap reached (3/3)');
      }
    } catch {
      // ignore reward errors
    }
  }, [card.catId]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('Challenge link copied');
      window.setTimeout(() => {
        claimShareReward('copy');
      }, 5000);
    } catch {
      showToast('Copy failed');
    }
  }

  async function shareNative() {
    if (!navigator.share) {
      await copyLink();
      return;
    }
    try {
      await navigator.share({
        title: `${card.name} — ${card.rarity} Cat Fighter`,
        text: `Power ${card.powerRating} • Level ${card.level} • Can your cat beat this?`,
        url: shareUrl,
      });
      await claimShareReward('share');
    } catch {
      // no-op
    }
  }

  async function flexShare() {
    if (cooldownSeconds > 0) {
      showToast(`Next reward in ${cooldownSeconds}s`);
      return;
    }
    await shareNative();
  }

  async function downloadPng() {
    if (!wrapRef.current || busy) return;
    setBusy(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(wrapRef.current, { backgroundColor: null, scale: 2, useCORS: true });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('PNG downloaded');
    } catch {
      showToast('Download failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>

      {!screenshotMode && (
        <div className="space-y-3">
          {isNewCat && (
            <div className="rounded-2xl border border-emerald-300/25 bg-gradient-to-r from-emerald-500/15 to-cyan-500/15 p-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-200/85">Meet Your New Champion!</p>
              <p className="text-xs text-white/70 mt-1">Share this fighter card to challenge friends and grow your arena.</p>
            </div>
          )}

          <div ref={wrapRef} className="relative">
            <FighterCard card={card} id="share-fighter-card" />
            {showCelebration && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
                {Array.from({ length: 32 }).map((_, i) => (
                  <span key={i} className="new-confetti" style={{ left: `${6 + Math.random() * 88}%`, animationDelay: `${Math.random() * 0.2}s` }} />
                ))}
              </div>
            )}
          </div>

          {!screenshotOnly && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={flexShare}
                className="col-span-2 h-11 rounded-xl bg-gradient-to-r from-emerald-300 to-cyan-300 text-black text-sm font-black inline-flex items-center justify-center gap-1.5"
              >
                <Rocket className="w-4 h-4" />
                {cooldownSeconds > 0 ? `Next reward in ${cooldownSeconds}s` : 'Flex on your Friends (+25 Sigils)'}
              </button>
              <button onClick={shareNative} className="h-10 rounded-xl bg-emerald-400 text-black text-sm font-bold inline-flex items-center justify-center gap-1.5"><Share2 className="w-4 h-4" /> Share...</button>
              <button onClick={copyLink} className="h-10 rounded-xl bg-white/10 border border-white/15 text-white text-sm font-bold inline-flex items-center justify-center gap-1.5"><Link2 className="w-4 h-4" /> Copy link</button>
              <button onClick={downloadPng} disabled={busy} className="h-10 rounded-xl bg-white/10 border border-white/15 text-white text-sm font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"><Download className="w-4 h-4" /> Download PNG</button>
              <button onClick={() => setScreenshotMode(true)} className="h-10 rounded-xl bg-cyan-500/20 border border-cyan-300/30 text-cyan-100 text-sm font-bold">Screenshot Mode</button>
            </div>
          )}
        </div>
      )}

      {screenshotMode && (
        <div className="fixed inset-0 z-50 bg-gradient-to-b from-black to-zinc-950">
          <button onClick={() => setScreenshotMode(false)} className="absolute top-4 right-4 h-9 w-9 rounded-full bg-white/10 border border-white/20 inline-flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
          <div className="absolute inset-0 flex items-center justify-center p-5">
            <div className="w-full max-w-sm transform transition-all duration-300 ease-out scale-100">
              <FighterCard card={card} id="share-fighter-card-screenshot" />
            </div>
          </div>
          <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xs text-white/65">Screenshot to share</p>
        </div>
      )}

      <style jsx>{`
        .new-confetti {
          position: absolute;
          top: 6%;
          width: 5px;
          height: 12px;
          border-radius: 2px;
          background: linear-gradient(180deg, #fef08a, #22d3ee);
          opacity: 0;
          animation: newConfettiFall 1000ms ease-out forwards;
        }
        @keyframes newConfettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 0.95; }
          100% { transform: translateY(210px) rotate(220deg); opacity: 0; }
        }
      `}</style>
    </>
  );
}
