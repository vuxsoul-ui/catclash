import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const DEFAULT_PROXY_URL = 'http://localhost:8787/v1/messages';

function parseErrorStatus(status: number): number {
  const normalized = Number(status || 500);
  return Math.min(Math.max(normalized, 400), 599);
}

async function toFormDataFromRequest(request: Request): Promise<FormData> {
  const contentType = String(request.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('multipart/form-data')) {
    return request.formData();
  }

  const body = await request.json().catch(() => null);
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) {
    throw new Error('Prompt is required');
  }
  const form = new FormData();
  form.set('prompt', prompt);
  if (typeof body?.context === 'string') form.set('context', body.context);
  if (typeof body?.task === 'string') form.set('task', body.task);
  if (typeof body?.constraints === 'string') form.set('constraints', body.constraints);
  if (typeof body?.output === 'string') form.set('output', body.output);
  return form;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const proxyUrl = String(process.env.CLAUDE_PROXY_URL || DEFAULT_PROXY_URL).trim();
  const proxyToken = String(process.env.CLAUDE_PROXY_TOKEN || '').trim();

  try {
    const form = await toFormDataFromRequest(request);

    console.info('[/api/claude] proxy request start', {
      proxyUrl,
      hasProxyToken: Boolean(proxyToken),
      nodeEnv: process.env.NODE_ENV,
    });

    const upstream = await fetch(proxyUrl, {
      method: 'POST',
      headers: proxyToken ? { Authorization: `Bearer ${proxyToken}` } : undefined,
      body: form,
    });

    const durationMs = Date.now() - startedAt;
    const upstreamContentType = String(upstream.headers.get('content-type') || '').toLowerCase();

    if (!upstream.ok) {
      const maybeJson = await upstream.json().catch(() => null);
      const maybeText = maybeJson ? null : await upstream.text().catch(() => '');
      const message =
        (maybeJson && typeof maybeJson?.error === 'string' && maybeJson.error) ||
        (typeof maybeText === 'string' && maybeText.trim()) ||
        'Claude proxy request failed';

      console.error('[/api/claude] proxy upstream failure', {
        proxyUrl,
        status: upstream.status,
        durationMs,
        error: message,
      });

      return NextResponse.json(
        {
          ok: false,
          error: message,
          status: upstream.status,
          upstream: maybeJson || maybeText || null,
        },
        { status: parseErrorStatus(upstream.status) }
      );
    }

    console.info('[/api/claude] proxy request complete', {
      proxyUrl,
      status: upstream.status,
      durationMs,
      contentType: upstreamContentType,
    });

    if (upstream.body && (upstreamContentType.includes('application/x-ndjson') || upstreamContentType.includes('text/event-stream'))) {
      const responseHeaders = new Headers();
      responseHeaders.set('Cache-Control', 'no-store');
      responseHeaders.set('Content-Type', upstreamContentType.includes('text/event-stream') ? 'text/event-stream; charset=utf-8' : 'application/x-ndjson; charset=utf-8');
      return new Response(upstream.body, {
        status: 200,
        headers: responseHeaders,
      });
    }

    const json = await upstream.json().catch(() => null);
    if (json && typeof json === 'object') {
      return NextResponse.json(json, { status: 200 });
    }

    const text = await upstream.text().catch(() => '');
    return NextResponse.json({ ok: true, text: String(text || '') }, { status: 200 });
  } catch (error: any) {
    const durationMs = Date.now() - startedAt;
    const message = typeof error?.message === 'string' && error.message ? error.message : 'Claude request failed';
    console.error('[/api/claude] proxy failure', {
      proxyUrl,
      durationMs,
      error: message,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
