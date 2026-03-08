'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Copy, Share2 } from 'lucide-react';
import { showGlobalToast } from '../../lib/global-toast';

type Payload = {
  ok: boolean;
  recruiter?: {
    id: string;
    username: string;
    guild: string | null;
    rank: string;
    next_rank: string | null;
    direct_qualified: number;
  };
  hero_cat?: {
    id: string;
    name: string;
    rarity: string;
    image_url: string;
  } | null;
  error?: string;
};

function guildName(g: string | null | undefined) {
  if (g === 'sun') return 'Solar Claw';
  if (g === 'moon') return 'Lunar Paw';
  return 'Arena';
}

export default function RecruitSharePage() {
  const params = useParams<{ username: string }>();
  const search = useSearchParams();
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(true);

  const username = String(params?.username || '').trim();
  const ref = String(search.get('ref') || '').trim();
  const guild = String(search.get('guild') || '').trim();
  const pitch = String(search.get('pitch') || 'challenger').trim();

  useEffect(() => {
    let live = true;
    setBusy(true);
    fetch(`/api/social/recruit-card/${encodeURIComponent(username)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (live) setData(d); })
      .catch(() => { if (live) setData({ ok: false, error: 'Failed to load recruiter card' }); })
      .finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [username]);

  useEffect(() => {
    fetch('/api/telemetry/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'recruit_share_opened', payload: { username } }),
    }).catch(() => null);
  }, [username]);

  const joinUrl = useMemo(() => {
    const qs = new URLSearchParams();
    if (ref) qs.set('ref', ref);
    if (guild) qs.set('guild', guild);
    if (pitch) qs.set('pitch', pitch);
    return `/?${qs.toString()}`;
  }, [ref, guild, pitch]);

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return `/r/${encodeURIComponent(username)}`;
    return window.location.href;
  }, [username]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      showGlobalToast('Link copied', 1800);
    } catch {
      showGlobalToast('Copy failed', 1800);
    }
  }

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${data?.recruiter?.username || username} is recruiting`,
          text: 'Join CatClash Arena and enter the faction war.',
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
      }
      fetch('/api/telemetry/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'recruit_shared', payload: { username } }),
      }).catch(() => null);
      showGlobalToast('Shared', 1800);
    } catch {
      showGlobalToast('Share canceled', 1800);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white px-4 pt-6 pb-20">
      <div className="max-w-md mx-auto">
        {busy ? (
          <div className="h-[72vh] rounded-3xl border border-white/10 bg-white/5 animate-pulse" />
        ) : !data?.ok || !data?.recruiter ? (
          <div className="rounded-2xl border border-red-300/25 bg-red-500/10 p-4 text-sm text-red-100">
            {data?.error || 'Recruit card unavailable'}
          </div>
        ) : (
          <>
            <section className="rounded-3xl border border-white/15 bg-gradient-to-b from-cyan-500/10 via-black to-black p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-200/85">CatClash Arena</p>
              <p className="text-xs text-white/60 mt-1">Recruit & Rule</p>
              <div className="mt-3 rounded-2xl overflow-hidden border border-white/10">
                <img
                  src={data.hero_cat?.image_url || '/cat-placeholder.svg'}
                  alt={data.hero_cat?.name || 'Recruit cat'}
                  className="w-full h-72 object-cover"
                />
              </div>
              <div className="mt-3">
                <h1 className="text-xl font-black">{data.recruiter.username}</h1>
                <p className="text-xs text-white/70">
                  {data.recruiter.rank} · {guildName(data.recruiter.guild)}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-center">
                    <p className="text-[10px] text-white/55">Direct Recruits</p>
                    <p className="text-sm font-bold">{data.recruiter.direct_qualified}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-center">
                    <p className="text-[10px] text-white/55">Join Window</p>
                    <p className="text-sm font-bold">48h</p>
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-cyan-200/85">Join within 48h to unlock your Recruit Tree start bonus.</p>
              </div>
            </section>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <button onClick={share} className="h-10 rounded-xl bg-emerald-400 text-black text-xs font-black inline-flex items-center justify-center gap-1.5">
                <Share2 className="w-3.5 h-3.5" /> Share
              </button>
              <button onClick={copyLink} className="h-10 rounded-xl bg-white/10 border border-white/15 text-xs font-bold inline-flex items-center justify-center gap-1.5">
                <Copy className="w-3.5 h-3.5" /> Copy
              </button>
              <Link href={joinUrl} className="h-10 rounded-xl bg-cyan-400 text-black text-xs font-black inline-flex items-center justify-center">
                Join Arena
              </Link>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link href={`/profile/${encodeURIComponent(data.recruiter.username)}`} className="h-10 rounded-xl border border-violet-300/20 bg-violet-400/10 text-xs font-bold text-violet-100 inline-flex items-center justify-center">
                View Trainer Profile
              </Link>
              <Link href={`/social?recruit=${encodeURIComponent(data.recruiter.username)}`} className="h-10 rounded-xl border border-white/15 bg-white/5 text-xs font-semibold text-white/80 inline-flex items-center justify-center">
                Recruit Loop
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
