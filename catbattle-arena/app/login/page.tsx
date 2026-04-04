'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';

type Mode = 'login' | 'register';

function normalizePostLoginPath(raw: string, fallbackProfilePath: string): string {
  const nextPath = String(raw || '/').trim();
  if (!nextPath.startsWith('/')) return '/';
  if (nextPath === '/login') return fallbackProfilePath;
  if (nextPath === '/profile') return fallbackProfilePath;
  if (/^\/profile\/(?:undefined|null)?$/i.test(nextPath)) return fallbackProfilePath;
  return nextPath;
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  async function handleSubmit() {
    const cleanUser = username.trim();
    const cleanEmail = email.trim().toLowerCase();
    if (mode === 'register') {
      if (!cleanUser || !password || !confirmPassword) {
        setError('Username, password, and confirm password are required.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    } else {
      if (!cleanUser || !password) {
        setError('Username and password are required.');
        return;
      }
    }
    setLoading(true);
    setMessage(null);
    setError(null);
    setRecoveryCodes([]);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      if (mode === 'register') {
        fetch('/api/telemetry/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'signup_started', payload: { screen: 'login_page' } }),
        }).catch(() => null);
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
                  username: cleanUser,
                  password,
                  ...(mode === 'register' && cleanEmail ? { email: cleanEmail } : {}),
                }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error || (mode === 'login' ? 'Login failed' : 'Create account failed'));
        return;
      }

      const meRes = await fetch('/api/me', { cache: 'no-store' });
      const me = await meRes.json().catch(() => ({}));
      const id = String(me?.guest_id || me?.data?.profile?.id || '').trim();
      const profilePath = id ? `/profile/${encodeURIComponent(id)}` : '/';
      const url = new URL(window.location.href);
      const nextRaw = String(url.searchParams.get('next') || '/');
      const nextPath = normalizePostLoginPath(nextRaw, profilePath);
      window.location.href = nextPath;
      return;
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-md">
        <Link href="/" className="group mb-8 inline-flex items-center gap-2 text-sm font-medium text-white/50 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" /> Back
        </Link>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h1 className="mb-1.5 text-xl font-black tracking-tight text-white">{mode === 'login' ? 'Welcome Back' : 'Join CatClash'}</h1>
          <p className="mb-5 text-xs leading-relaxed text-white/55">
            {mode === 'login'
              ? 'Sign in to continue your arena journey.'
              : 'Create your trainer identity and enter the arena.'}
          </p>

          <div className="my-5 flex gap-1.5 rounded-xl bg-white/[0.03] p-1">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${mode === 'login' ? 'bg-white text-black shadow' : 'text-white/50 hover:text-white/80'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${mode === 'register' ? 'bg-emerald-400 text-black shadow' : 'text-white/50 hover:text-white/80'}`}
            >
              Create
            </button>
          </div>

          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="harry"
            className="mb-3 h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 transition-all focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/20"
          />

          {mode === 'register' && (
            <>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">Email (optional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mb-3 h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 transition-all focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/20"
              />
                  <p className="mb-3 text-xs text-white/45">Used for password recovery and account notifications.</p>
            </>
          )}

          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="mb-3 h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 transition-all focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/20"
          />

          {mode === 'register' && (
            <>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="mb-4 h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 transition-all focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/20"
              />
            </>
          )}

          {mode === 'login' ? (
            <div className="mb-4 flex justify-end">
              <Link href="/forgot-password" className="text-xs font-medium text-cyan-300/90 hover:text-cyan-200 transition-colors">
                Forgot password?
              </Link>
            </div>
          ) : null}

          <button
            disabled={loading || !username.trim() || !password || (mode === 'register' && (!confirmPassword || password !== confirmPassword))}
            onClick={handleSubmit}
            className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-black transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${mode === 'login' ? 'bg-cyan-400 hover:bg-cyan-300' : 'bg-emerald-400 hover:bg-emerald-300'}`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          {message && (
            <div className="mt-4 rounded-xl border border-emerald-300/25 bg-emerald-500/10 p-3.5">
              <p className="text-xs font-medium text-emerald-300">{message}</p>
            </div>
          )}
          {error && (
            <div className="mt-4 rounded-xl border border-rose-300/25 bg-rose-500/10 p-3.5">
              <p className="text-xs font-medium text-rose-300">{error}</p>
            </div>
          )}
          {recoveryCodes.length > 0 ? (
            <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-500/10 p-3.5">
              <p className="mb-2 text-xs font-semibold text-amber-200">Save these recovery codes (shown once):</p>
              <pre className="rounded-lg bg-black/30 p-2.5 text-xs font-mono text-amber-100">{recoveryCodes.join('\n')}</pre>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
