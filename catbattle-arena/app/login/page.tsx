'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const cleanUser = username.trim();
    if (!cleanUser || !password) return;
    setLoading(true);
    setMessage(null);
    setError(null);
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
        body: JSON.stringify({ username: cleanUser, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error || (mode === 'login' ? 'Login failed' : 'Create account failed'));
        return;
      }

      const meRes = await fetch('/api/me', { cache: 'no-store' });
      const me = await meRes.json().catch(() => ({}));
      const id = me?.guest_id;
      const url = new URL(window.location.href);
      const nextRaw = String(url.searchParams.get('next') || '/');
      const nextPath = nextRaw.startsWith('/') ? nextRaw : '/';
      if (id) {
        window.location.href = nextPath && nextPath !== '/login' ? nextPath : `/profile/${id}`;
        return;
      }
      setMessage(mode === 'login' ? 'Signed in.' : 'Account created.');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white px-4 py-8">
      <div className="max-w-md mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-white/50 hover:text-white text-sm mb-5">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h1 className="text-xl font-black mb-2">{mode === 'login' ? 'Login' : 'Create Account'}</h1>
          <p className="text-xs text-white/65 mb-4">
            {mode === 'login'
              ? 'Sign in with your username and password.'
              : 'Create credentials for this account to use it across devices.'}
          </p>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={() => setMode('login')}
              className={`h-9 rounded-lg text-xs font-bold ${mode === 'login' ? 'bg-white text-black' : 'bg-white/10 text-white/80'}`}
            >
              Login
            </button>
            <button
              onClick={() => setMode('register')}
              className={`h-9 rounded-lg text-xs font-bold ${mode === 'register' ? 'bg-emerald-300 text-black' : 'bg-white/10 text-white/80'}`}
            >
              Create
            </button>
          </div>

          <label className="text-xs text-white/70 block mb-1">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="harry"
            className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/15 text-sm focus:outline-none focus:border-white/30 mb-3"
          />

          <label className="text-xs text-white/70 block mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/15 text-sm focus:outline-none focus:border-white/30 mb-3"
          />

          <button
            disabled={loading || !username.trim() || !password}
            onClick={handleSubmit}
            className="w-full py-2 rounded-lg bg-emerald-300 text-black font-bold text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          {message && <p className="text-xs text-emerald-300 mt-3">{message}</p>}
          {error && <p className="text-xs text-red-300 mt-3">{error}</p>}
        </div>
      </div>
    </main>
  );
}
