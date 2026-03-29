'use client';

import { FormEvent, useMemo, useState } from 'react';
import { notFound } from 'next/navigation';

type HistoryItem = {
  id: string;
  prompt: string;
  response: string;
  createdAt: number;
};

const MAX_PROMPT_CHARS = 2000;

export default function DevClaudePage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastStatus, setLastStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const remaining = useMemo(
    () => MAX_PROMPT_CHARS - prompt.length,
    [prompt.length]
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);
    setResponse('');
    setLastStatus(null);

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 20000);
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed }),
        signal: controller.signal,
      });
      window.clearTimeout(timeout);
      setLastStatus(res.status);

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        const upstream =
          data?.upstream != null
            ? ` | upstream: ${typeof data.upstream === 'string' ? data.upstream : JSON.stringify(data.upstream)}`
            : '';
        throw new Error(`[${res.status}] ${data?.error || 'Request failed'}${upstream}`);
      }

      const text = String(data?.text || '');
      setResponse(text);
      setHistory((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          prompt: trimmed,
          response: text,
          createdAt: Date.now(),
        },
        ...prev,
      ]);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setError('Request timed out after 20s');
        return;
      }
      setError(typeof err?.message === 'string' ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-[0_10px_28px_rgba(0,0,0,0.35)]">
          <h1 className="text-lg font-semibold">Claude Dev Panel</h1>
          <p className="mt-1 text-xs text-slate-400">
            Sends the latest prompt only to <code>/api/claude</code>.
          </p>

          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <div>
              <label htmlFor="claude-prompt" className="block text-xs text-slate-300 mb-1">
                Prompt
              </label>
              <textarea
                id="claude-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value.slice(0, MAX_PROMPT_CHARS))}
                maxLength={MAX_PROMPT_CHARS}
                rows={8}
                placeholder="Ask Claude something..."
                className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-cyan-300/45"
              />
              <div className="mt-1 text-[11px] text-slate-500">{remaining} chars left</div>
            </div>

            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-cyan-500/85 px-4 text-sm font-semibold text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send'}
            </button>
          </form>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          {!error && lastStatus ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
              Last status: {lastStatus}
            </div>
          ) : null}

          <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/60 p-3">
            <div className="mb-1 text-xs text-slate-400">Response</div>
            <pre className="whitespace-pre-wrap break-words text-sm text-slate-100 min-h-24">
              {response || (loading ? 'Waiting for Claude…' : 'No response yet.')}
            </pre>
          </div>
        </section>

        <aside className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <h2 className="text-sm font-semibold">Session History</h2>
          <p className="mt-1 text-[11px] text-slate-400">Current tab only, newest first.</p>
          <div className="mt-3 space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {history.length === 0 ? (
              <p className="text-xs text-slate-500">No prompts yet.</p>
            ) : (
              history.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-2.5">
                  <div className="text-[10px] text-slate-500">
                    {new Date(item.createdAt).toLocaleTimeString()}
                  </div>
                  <p className="mt-1 text-xs text-slate-200 line-clamp-3">{item.prompt}</p>
                  <p className="mt-2 text-[11px] text-slate-400 line-clamp-4">{item.response}</p>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
