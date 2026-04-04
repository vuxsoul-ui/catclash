'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { notFound } from 'next/navigation';

type RequestStatus = 'idle' | 'uploading' | 'sending' | 'streaming' | 'complete' | 'failed';

type PromptSections = {
  context: string;
  task: string;
  constraints: string;
  output: string;
};

type HistoryItem = {
  id: string;
  sections: PromptSections;
  response: string;
  createdAt: number;
  imageNames: string[];
};

type ImageAttachment = {
  id: string;
  file: File;
  previewUrl: string;
};

const SECTION_KEYS: Array<keyof PromptSections> = ['context', 'task', 'constraints', 'output'];

const STATUS_LABEL: Record<RequestStatus, string> = {
  idle: 'Idle',
  uploading: 'Uploading',
  sending: 'Sending',
  streaming: 'Streaming',
  complete: 'Complete',
  failed: 'Failed',
};

function buildPrompt(sections: PromptSections): string {
  return [
    `Context:\n${sections.context.trim()}`,
    `Task:\n${sections.task.trim()}`,
    `Constraints:\n${sections.constraints.trim()}`,
    `Output:\n${sections.output.trim()}`,
  ].join('\n\n');
}

function parseChunkLine(line: string): { type: string; text?: string; error?: string; status?: number } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const payload = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
  if (!payload || payload === '[DONE]') return null;
  try {
    const parsed = JSON.parse(payload);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return { type: 'delta', text: payload };
  }
}

function autoResize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = '0px';
  el.style.height = `${Math.min(el.scrollHeight, 340)}px`;
}

export default function DevClaudePage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const [sections, setSections] = useState<PromptSections>({
    context: '',
    task: '',
    constraints: '',
    output: '',
  });
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const [response, setResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastStatus, setLastStatus] = useState<number | null>(null);
  const [status, setStatus] = useState<RequestStatus>('idle');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [mounted, setMounted] = useState(false);

  const controllerRef = useRef<AbortController | null>(null);
  const textareasRef = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const combinedPrompt = useMemo(() => buildPrompt(sections), [sections]);
  const hasPrompt = useMemo(() => SECTION_KEYS.some((key) => sections[key].trim().length > 0), [sections]);
  const canSend = hasPrompt && status !== 'sending' && status !== 'streaming' && status !== 'uploading';

  useEffect(() => {
    setMounted(true);
  }, []);

  function bindTextareaRef(key: keyof PromptSections) {
    return (el: HTMLTextAreaElement | null) => {
      textareasRef.current[key] = el;
      autoResize(el);
    };
  }

  function onSectionChange(key: keyof PromptSections, value: string) {
    setSections((prev) => ({ ...prev, [key]: value }));
    requestAnimationFrame(() => autoResize(textareasRef.current[key]));
  }

  function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    setAttachments((prev) => [
      ...prev,
      ...files.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
    event.target.value = '';
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  }

  function restoreHistoryItem(item: HistoryItem) {
    setSections(item.sections);
    setResponse(item.response);
    setError(null);
    setStatus('idle');
  }

  function abortRequest() {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!hasPrompt || status === 'sending' || status === 'streaming' || status === 'uploading') return;

    setError(null);
    setResponse('');
    setLastStatus(null);

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      setStatus(attachments.length > 0 ? 'uploading' : 'sending');

      const form = new FormData();
      form.set('context', sections.context);
      form.set('task', sections.task);
      form.set('constraints', sections.constraints);
      form.set('output', sections.output);
      form.set('prompt', combinedPrompt);
      for (const item of attachments) {
        form.append('images', item.file, item.file.name);
      }

      setStatus('sending');
      const res = await fetch('/api/claude', {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });
      setLastStatus(res.status);

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Request failed (${res.status})`);
      }

      const contentType = String(res.headers.get('content-type') || '').toLowerCase();
      if (res.body && (contentType.includes('application/x-ndjson') || contentType.includes('text/event-stream'))) {
        setStatus('streaming');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let full = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const evt = parseChunkLine(line);
            if (!evt) continue;
            if (evt.type === 'delta' && typeof evt.text === 'string') {
              full += evt.text;
              setResponse(full);
              continue;
            }
            if (evt.type === 'done' && typeof evt.text === 'string') {
              full = evt.text;
              setResponse(full);
              continue;
            }
            if (evt.type === 'error') {
              throw new Error(evt.error || 'Streaming failed');
            }
          }
        }

        setHistory((prev) => [
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            sections,
            response: full,
            createdAt: Date.now(),
            imageNames: attachments.map((a) => a.file.name),
          },
          ...prev,
        ]);
        setStatus('complete');
      } else {
        const data = await res.json().catch(() => null);
        const text = String(data?.text || '');
        setResponse(text);
        setHistory((prev) => [
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            sections,
            response: text,
            createdAt: Date.now(),
            imageNames: attachments.map((a) => a.file.name),
          },
          ...prev,
        ]);
        setStatus('complete');
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setError('Request aborted');
      } else {
        setError(typeof err?.message === 'string' ? err.message : 'Request failed');
      }
      setStatus('failed');
    } finally {
      controllerRef.current = null;
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-[0_10px_28px_rgba(0,0,0,0.35)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold">Claude Dev Panel</h1>
              <p className="mt-1 text-xs text-slate-400">
                Internal CatClash console powered by <code>/api/claude</code>.
              </p>
            </div>
            <span className="rounded-full border border-cyan-300/35 bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-200">
              {STATUS_LABEL[status]}
            </span>
          </div>

          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            {(SECTION_KEYS as Array<keyof PromptSections>).map((key) => (
              <div key={key}>
                <label htmlFor={`claude-${key}`} className="mb-1 block text-xs font-medium text-slate-300 capitalize">
                  {key}
                </label>
                <textarea
                  id={`claude-${key}`}
                  ref={bindTextareaRef(key)}
                  value={sections[key]}
                  onChange={(e) => onSectionChange(key, e.target.value)}
                  rows={2}
                  className="w-full resize-none overflow-y-auto rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-cyan-300/45"
                  placeholder={`Write ${key}...`}
                />
              </div>
            ))}

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Images</label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={onImageChange}
                  className="block w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-cyan-500/85 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-slate-950"
                />
              </div>
              {attachments.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {attachments.map((item) => (
                    <div key={item.id} className="relative overflow-hidden rounded-lg border border-white/15">
                      <img src={item.previewUrl} alt={item.file.name} className="h-16 w-16 object-cover" />
                      <button
                        type="button"
                        onClick={() => removeAttachment(item.id)}
                        className="absolute right-0 top-0 rounded-bl-md bg-black/70 px-1.5 py-0.5 text-[10px] text-white/85"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={mounted ? !canSend : false}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-cyan-500/85 px-4 text-sm font-semibold text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send
              </button>
              <button
                type="button"
                onClick={abortRequest}
                disabled={status !== 'sending' && status !== 'streaming' && status !== 'uploading'}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-white/90 transition disabled:cursor-not-allowed disabled:opacity-45"
              >
                Abort
              </button>
            </div>
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
              {response || (status === 'streaming' ? 'Streaming…' : 'No response yet.')}
            </pre>
          </div>
        </section>

        <aside className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <h2 className="text-sm font-semibold">Prompt History</h2>
          <p className="mt-1 text-[11px] text-slate-400">Current tab only, newest first.</p>
          <div className="mt-3 space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {history.length === 0 ? (
              <p className="text-xs text-slate-500">No prompts yet.</p>
            ) : (
              history.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] text-slate-500">
                      {new Date(item.createdAt).toLocaleTimeString()}
                    </div>
                    <button
                      type="button"
                      onClick={() => restoreHistoryItem(item)}
                      className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[10px] text-slate-200 hover:bg-white/10"
                    >
                      Restore
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-300 line-clamp-4 whitespace-pre-wrap">
                    {buildPrompt(item.sections)}
                  </p>
                  {item.imageNames.length > 0 ? (
                    <p className="mt-1 text-[10px] text-slate-500">Images: {item.imageNames.join(', ')}</p>
                  ) : null}
                  <p className="mt-2 text-[11px] text-slate-400 line-clamp-4 whitespace-pre-wrap">{item.response}</p>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
