'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Share2, Swords } from 'lucide-react';

type DuelCat = { id: string; name: string; image_url: string | null };
type DuelData = {
  id: string;
  status: string;
  challenger_user_id: string;
  challenged_user_id: string;
  challenger_username: string;
  challenged_username: string;
  challenger_cat: DuelCat | null;
  challenged_cat: DuelCat | null;
  votes: { cat_a: number; cat_b: number; total: number };
};

function formatCountdown(targetIso: string): string {
  const ms = Math.max(0, new Date(targetIso).getTime() - Date.now());
  const mm = Math.floor(ms / 60000);
  const ss = Math.floor((ms % 60000) / 1000);
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export default function DuelPreviewPage() {
  const params = useParams();
  const duelId = String(params?.id || '').trim();
  const [loading, setLoading] = useState(true);
  const [duel, setDuel] = useState<DuelData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState('02:00');
  const [votingAt, setVotingAt] = useState<string | null>(null);
  const [showClaim, setShowClaim] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [registering, setRegistering] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [hasCredentials, setHasCredentials] = useState(false);

  useEffect(() => {
    if (!duelId) return;
    const savedId = sessionStorage.getItem('challenge_duel_id');
    if (!savedId) sessionStorage.setItem('challenge_duel_id', duelId);

    Promise.all([
      fetch(`/api/duel/${duelId}`, { cache: 'no-store' }).then((r) => r.json().catch(() => ({}))),
      fetch('/api/me', { cache: 'no-store' }).then((r) => r.json().catch(() => ({}))),
    ])
      .then(([d, me]) => {
        if (!d?.ok || !d?.duel) {
          setError(d?.error || 'Duel not found');
          return;
        }
        setDuel(d.duel);
        const hasCred = !!me?.data?.has_credentials;
        setHasCredentials(hasCred);
        setShowClaim(!hasCred);
        const startsAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
        setVotingAt(startsAt);
        setCountdown(formatCountdown(startsAt));
      })
      .catch(() => setError('Failed to load duel'))
      .finally(() => setLoading(false));
  }, [duelId]);

  useEffect(() => {
    if (!votingAt) return;
    const id = window.setInterval(() => setCountdown(formatCountdown(votingAt)), 1000);
    return () => window.clearInterval(id);
  }, [votingAt]);

  const canRegister = useMemo(() => username.trim().length >= 3 && password.length >= 8, [username, password]);

  async function claimAccount() {
    if (!duel || !canRegister || registering) return;
    setRegistering(true);
    setClaimMessage(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          referrer_user_id: duel.challenger_user_id,
          duel_id: duel.id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setClaimMessage(data?.error || 'Failed to create account');
        return;
      }
      setHasCredentials(true);
      setShowClaim(false);
      setClaimMessage(data?.welcome_crate_granted ? 'Account claimed. Welcome crate roll unlocked.' : 'Account claimed.');
    } catch {
      setClaimMessage('Network error');
    } finally {
      setRegistering(false);
    }
  }

  async function shareDuel() {
    if (!duel) return;
    const url = `${window.location.origin}/d/${encodeURIComponent(duel.id)}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${duel.challenger_username} vs ${duel.challenged_username} • CatClash Duel`,
          text: 'Live duel in CatClash Arena',
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        setClaimMessage('Duel link copied');
      }
    } catch {
      // user canceled
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white grid place-items-center">
        <Loader2 className="w-10 h-10 animate-spin text-white/40" />
      </main>
    );
  }

  if (error || !duel) {
    return (
      <main className="min-h-screen bg-black text-white grid place-items-center px-4">
        <div className="text-center">
          <p className="text-white/70 mb-3">{error || 'Duel unavailable'}</p>
          <Link href="/duel" className="text-cyan-300 underline">Open Duel Arena</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white px-4 py-6 pb-28 sm:pb-6">
      <div className="max-w-2xl mx-auto">
        <Link href="/duel" className="inline-flex items-center gap-2 text-white/50 hover:text-white text-sm mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Duel Arena
        </Link>

        <section className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4 mb-4">
          <p className="text-[11px] uppercase tracking-wider text-cyan-200/80">Duel Initiated</p>
          <h1 className="text-xl font-black mt-1">Your Rivalry Is Live</h1>
          <p className="text-sm text-white/70 mt-1">Voting begins in <span className="font-bold text-cyan-200">{countdown}</span>. Get ready to defend your honor.</p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
            <div className="rounded-xl border border-white/10 bg-black/30 p-2">
              <img src={duel.challenger_cat?.image_url || '/cat-placeholder.svg'} alt={duel.challenger_cat?.name || 'Challenger'} className="w-full h-36 object-cover rounded-lg" />
              <p className="text-sm font-bold mt-2 truncate">{duel.challenger_cat?.name || 'Challenger Cat'}</p>
              <p className="text-xs text-white/55 truncate">by {duel.challenger_username}</p>
            </div>
            <div className="text-center">
              <Swords className="w-6 h-6 mx-auto text-cyan-300" />
              <p className="text-xs text-white/60 mt-1">VS</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-2">
              <img src={duel.challenged_cat?.image_url || '/cat-placeholder.svg'} alt={duel.challenged_cat?.name || 'Defender'} className="w-full h-36 object-cover rounded-lg" />
              <p className="text-sm font-bold mt-2 truncate">{duel.challenged_cat?.name || 'Your Cat'}</p>
              <p className="text-xs text-white/55 truncate">by {duel.challenged_username}</p>
            </div>
          </div>
        </section>
        <button
          onClick={shareDuel}
          className="mt-3 h-10 px-4 rounded-xl bg-emerald-300 text-black text-sm font-bold inline-flex items-center gap-2"
        >
          <Share2 className="w-4 h-4" />
          Share Duel
        </button>

        {showClaim && (
          <section className="fixed inset-x-0 bottom-0 z-50 sm:static sm:mt-4 sm:rounded-2xl sm:border sm:border-emerald-300/25 bg-zinc-950/95 sm:bg-emerald-500/10 backdrop-blur-xl p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:pb-4">
            <p className="text-[11px] uppercase tracking-wider text-emerald-200/90">Battle Logged!</p>
            <h2 className="text-lg font-black mt-1">Claim Your Account</h2>
            <p className="text-xs text-white/70 mt-1">Your duel against {duel.challenger_username} is active. Create your account to track results, claim rewards, and keep your cat identity.</p>
            <p className="text-xs text-emerald-200 mt-2 font-semibold">Sign up now to get a Welcome Crate roll.</p>
            <div className="grid grid-cols-1 gap-2 mt-3">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="h-10 rounded-lg bg-black/40 border border-white/15 px-3 text-sm"
              />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="Password (8+)"
                className="h-10 rounded-lg bg-black/40 border border-white/15 px-3 text-sm"
              />
              <button
                onClick={claimAccount}
                disabled={!canRegister || registering}
                className="h-10 rounded-lg bg-emerald-300 text-black text-sm font-bold disabled:opacity-40"
              >
                {registering ? 'Creating...' : 'Create Account'}
              </button>
              {claimMessage && <p className="text-xs text-white/70">{claimMessage}</p>}
            </div>
          </section>
        )}
        {!showClaim && hasCredentials && claimMessage && (
          <p className="mt-4 text-sm text-emerald-300">{claimMessage}</p>
        )}
      </div>
    </main>
  );
}
