'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugUrl, setDebugUrl] = useState<string | null>(null);

  async function onSubmit() {
    const value = identifier.trim();
    if (!value) return;
    setLoading(true);
    setMessage(null);
    setError(null);
    setDebugUrl(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Could not process request');
        return;
      }
      setMessage(String(data?.message || 'If an account exists, reset instructions have been sent.'));
      if (typeof data?.debug_reset_url === 'string' && data.debug_reset_url) {
        setDebugUrl(data.debug_reset_url);
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-md">
        <Link href="/login" className="group mb-8 inline-flex items-center gap-2 text-sm font-medium text-white/50 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" /> Back to Login
        </Link>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h1 className="mb-1.5 text-xl font-black tracking-tight text-white">Reset Password</h1>
          <p className="mb-5 text-xs leading-relaxed text-white/55">
            Enter your username or the email address associated with your account.
            If we find a match, we'll send password reset instructions.
          </p>

          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">Username or Email</label>
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="username or you@email.com"
            className="mb-4 h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 transition-all focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/20"
          />

          <button
            type="button"
            onClick={onSubmit}
            disabled={loading || !identifier.trim()}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 py-2 text-sm font-bold text-black transition-all hover:bg-cyan-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Send Reset Instructions
          </button>

          {message && (
            <div className="mt-5 rounded-xl border border-emerald-300/25 bg-emerald-500/10 p-3.5">
              <p className="text-xs font-medium text-emerald-300">{message}</p>
            </div>
          )}
          {error && (
            <div className="mt-5 rounded-xl border border-rose-300/25 bg-rose-500/10 p-3.5">
              <p className="text-xs font-medium text-rose-300">{error}</p>
            </div>
          )}
          {debugUrl && (
            <div className="mt-5 rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3.5">
              <p className="text-xs text-cyan-200">
                Dev reset link:{' '}
                <Link className="font-semibold underline hover:text-cyan-100" href={debugUrl}>
                  Open reset page
                </Link>
              </p>
            </div>
          )}

          <div className="mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
            <p className="text-xs font-medium text-white/60">Having trouble?</p>
            <p className="mt-1 text-xs text-white/45">
              Make sure you're using the correct username or the email you registered with.
              Contact support if you need further assistance.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
