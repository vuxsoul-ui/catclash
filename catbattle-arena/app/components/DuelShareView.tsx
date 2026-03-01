'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Copy, Download, Share2, X } from 'lucide-react';
import DuelShareCard from './DuelShareCard';
import type { PublicDuel } from '../d/_lib/duels';
import { showGlobalToast } from '../lib/global-toast';

export default function DuelShareView({ duel, duelId }: { duel: PublicDuel; duelId: string }) {
  const [busy, setBusy] = useState(false);
  const publicUrl = useMemo(() => {
    const path = `/d/${encodeURIComponent(duelId)}`;
    if (typeof window === 'undefined') return path;
    return `${window.location.origin}${path}`;
  }, [duelId]);

  function notify(msg: string) {
    showGlobalToast(msg, 1800);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      notify('Duel link copied');
    } catch {
      notify('Copy failed');
    }
  }

  async function shareNative() {
    if (!navigator.share) {
      await copyLink();
      return;
    }
    try {
      await navigator.share({
        title: `${duel.challenger_username} vs ${duel.challenged_username} • CatClash Duel`,
        text: 'Live duel in CatClash Arena',
        url: publicUrl,
      });
    } catch {
      // user cancelled
    }
  }

  async function downloadImage() {
    if (busy) return;
    const card = document.getElementById('duel-share-card');
    if (!card) return;
    setBusy(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(card, { backgroundColor: null, scale: 2, useCORS: true });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `CatClash_Duel_${duelId}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      notify('Image downloaded');
    } catch {
      notify('Download failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white px-3 py-4 pb-28">
      <div className="max-w-md mx-auto">
        <div className="mb-3 flex items-center justify-between">
          <Link href="/duel" className="text-sm text-white/65 hover:text-white">Close</Link>
          <p className="text-sm font-bold">Share Duel</p>
          <span className="text-[11px] text-white/35">/d/{duelId.slice(0, 8)}</span>
        </div>

        <div className="flex justify-center">
          <DuelShareCard duel={duel} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={shareNative} className="h-11 rounded-xl bg-emerald-300 text-black text-sm font-bold inline-flex items-center justify-center gap-1.5">
            <Share2 className="w-4 h-4" /> Share
          </button>
          <button onClick={downloadImage} className="h-11 rounded-xl bg-white/10 border border-white/20 text-sm font-bold inline-flex items-center justify-center gap-1.5">
            <Download className="w-4 h-4" /> Download
          </button>
          <button onClick={copyLink} className="h-11 rounded-xl bg-white/10 border border-white/20 text-sm font-bold inline-flex items-center justify-center gap-1.5">
            <Copy className="w-4 h-4" /> Copy Link
          </button>
          <Link href="/duel" className="h-11 rounded-xl bg-white/10 border border-white/20 text-sm font-bold inline-flex items-center justify-center gap-1.5">
            <X className="w-4 h-4" /> Close
          </Link>
        </div>
      </div>
    </main>
  );
}
