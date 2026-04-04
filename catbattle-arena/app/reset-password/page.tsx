'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';

type ResetMode = 'token' | 'recovery';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordFallback() {
  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h1 className="mb-2 text-xl font-black">Set New Password</h1>
          <p className="text-xs text-white/65">Loading reset form...</p>
        </div>
      </div>
    </main>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const initialToken = useMemo(() => String(searchParams?.get('token') || '').trim(), [searchParams]);
  const [mode, setMode] = useState<ResetMode>(initialToken ? 'token' : 'recovery');
  const [token, setToken] = useState(initialToken);
  const [identifier, setIdentifier] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setMessage(null);
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!password.trim()) {
      setError('Enter a new password.');
      return;
    }
    if (mode === 'token' && !token.trim()) {
      setError('Reset token is required.');
      return;
    }
    if (mode === 'recovery' && (!identifier.trim() || !recoveryCode.trim())) {
      setError('Identifier and recovery code are required.');
      return;
    }

    setLoading(true);
    try {
      const payload =
        mode === 'token'
          ? { token: token.trim(), new_password: password }
          : { identifier: identifier.trim(), recovery_code: recoveryCode.trim(), new_password: password };
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Could not reset password.');
        return;
      }
      setMessage(String(data?.message || 'Password reset successful. You can now sign in.'));
      setPassword('');
      setConfirmPassword('');
      setRecoveryCode('');
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-md">
        <Link href="/login" className="focus-ring mb-5 inline-flex items-center gap-2 text-sm text-white/50 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to Login
        </Link>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h1 className="mb-2 text-xl font-black">Set New Password</h1>
          <p className="mb-4 text-xs text-white/65">Use a reset token or one-time recovery code.</p>

          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('token')}
              className={`h-9 rounded-lg text-xs font-bold ${mode === 'token' ? 'bg-white text-black' : 'bg-white/10 text-white/75'}`}
            >
              Reset Token
            </button>
            <button
              type="button"
              onClick={() => setMode('recovery')}
              className={`h-9 rounded-lg text-xs font-bold ${mode === 'recovery' ? 'bg-white text-black' : 'bg-white/10 text-white/75'}`}
            >
              Recovery Code
            </button>
          </div>

          {mode === 'token' ? (
            <>
              <label className="mb-1 block text-xs text-white/70">Reset Token</label>
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste reset token"
                className="input-focus mb-3 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm"
              />
            </>
          ) : (
            <>
              <label className="mb-1 block text-xs text-white/70">Username or Email</label>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="username or you@email.com"
                className="input-focus mb-3 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm"
              />
              <label className="mb-1 block text-xs text-white/70">Recovery Code</label>
              <input
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                placeholder="ABCDE-12345"
                className="input-focus mb-3 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm uppercase"
              />
            </>
          )}

          <label className="mb-1 block text-xs text-white/70">New Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-focus mb-3 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm"
          />

          <label className="mb-1 block text-xs text-white/70">Confirm New Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input-focus mb-3 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm"
          />

          <button
            type="button"
            onClick={onSubmit}
            disabled={loading}
            className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-300 py-2 text-sm font-bold text-black disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Reset Password
          </button>

          {message ? <p className="mt-3 text-xs text-emerald-300">{message}</p> : null}
          {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}
        </div>
      </div>
    </main>
  );
}
