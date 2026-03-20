'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, LockKeyhole, Sparkles, Swords } from 'lucide-react';
import { buttonStyles } from '../components/ui/primitives';

export default function LaunchPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextTarget, setNextTarget] = useState('/arena');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = String(new URLSearchParams(window.location.search).get('next') || '/arena').trim();
    setNextTarget(raw.startsWith('/') ? raw : '/arena');
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (window.history.length > 1) {
        router.back();
      } else {
        router.push('/');
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router]);

  async function unlockArena() {
    const value = password.trim();
    if (!value || busy) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/launch/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setPassword('');
        setError(data?.error || 'Unable to unlock Arena right now.');
        return;
      }
      router.replace(nextTarget || '/arena');
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-black px-3 py-6 text-white sm:px-4 sm:py-8">
      <div className="mx-auto max-w-md">
        <button
          type="button"
          onClick={() => {
            if (window.history.length > 1) {
              router.back();
            } else {
              router.push('/');
            }
          }}
          className="mb-6 inline-flex items-center gap-2 text-sm text-white/55 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <section className="rounded-[1.6rem] border border-emerald-300/20 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),rgba(4,10,18,0.94)_52%),linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.45)] sm:p-6">
          <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/30 bg-emerald-400/12 text-emerald-200">
            <LockKeyhole className="h-5 w-5" />
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-200/78">
            Cat Clash Early Access
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
            Cat forging is open.
          </h1>
          <p className="mt-2 text-sm leading-6 text-white/72">
            Submit your fighters and browse the roster now. Arena battles are rolling out behind a launch password while we tune the soft launch.
          </p>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 sm:p-5">
            <label htmlFor="launch-password" className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-white/55">
              Unlock Arena
            </label>
            <input
              id="launch-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void unlockArena();
                }
              }}
              placeholder="Enter launch password"
              className="input-focus w-full rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/28"
              autoFocus
            />
            {error ? <p className="mt-2 text-sm text-red-200">{error}</p> : null}

            <button
              type="button"
              onClick={() => void unlockArena()}
              disabled={busy || !password.trim()}
              className={buttonStyles({ variant: 'primary', size: 'xl', className: 'mt-3 w-full gap-2 font-black' })}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
              Unlock Arena
            </button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Link
              href="/submit"
              className="interactive-card focus-ring rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-colors hover:bg-white/[0.07]"
            >
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/12 text-emerald-200">
                <Sparkles className="h-4 w-4" />
              </div>
              <p className="mt-3 text-sm font-bold text-white">Have a cat? Submit now</p>
              <p className="mt-1 text-xs leading-5 text-white/60">
                Forge a new fighter and lock in your first roster spot.
              </p>
            </Link>

            <Link
              href="/gallery"
              className="interactive-card focus-ring rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition-colors hover:bg-white/[0.07]"
            >
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/12 text-cyan-200">
                <Swords className="h-4 w-4" />
              </div>
              <p className="mt-3 text-sm font-bold text-white">Visit the gallery</p>
              <p className="mt-1 text-xs leading-5 text-white/60">
                Browse the roster, check your pending cats, and prep your next move.
              </p>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
