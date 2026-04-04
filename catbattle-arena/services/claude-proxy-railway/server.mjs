import express from 'express';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
const port = Number(process.env.PORT || 8787);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: Number(process.env.MAX_IMAGE_FILES || 8),
    fileSize: Number(process.env.MAX_IMAGE_BYTES || 8 * 1024 * 1024),
  },
});

const authToken = String(process.env.CLAUDE_PROXY_TOKEN || '').trim();

function now() {
  return Date.now();
}

function readBodyValue(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function composePrompt({ context, task, constraints, output, prompt }) {
  if (prompt) return prompt;
  return [
    `Context:\n${context}`,
    `Task:\n${task}`,
    `Constraints:\n${constraints}`,
    `Output:\n${output}`,
  ].join('\n\n').trim();
}

function requestDenied(req, res) {
  if (!authToken) return false;
  const incoming = String(req.headers.authorization || '').trim();
  if (incoming === `Bearer ${authToken}`) return false;
  res.status(401).json({ ok: false, error: 'Unauthorized' });
  return true;
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'catclash-claude-proxy' });
});

app.post('/v1/messages', upload.array('images'), async (req, res) => {
  const startedAt = now();
  if (requestDenied(req, res)) return;

  const context = readBodyValue(req.body?.context);
  const task = readBodyValue(req.body?.task);
  const constraints = readBodyValue(req.body?.constraints);
  const output = readBodyValue(req.body?.output);
  const prompt = readBodyValue(req.body?.prompt);
  const model = readBodyValue(req.body?.model) || process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
  const maxTokens = Number(req.body?.max_tokens || process.env.CLAUDE_MAX_TOKENS || 1600);

  const userPrompt = composePrompt({ context, task, constraints, output, prompt });
  if (!userPrompt) {
    res.status(400).json({ ok: false, error: 'Prompt is required' });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ ok: false, error: 'Missing ANTHROPIC_API_KEY' });
    return;
  }

  const files = Array.isArray(req.files) ? req.files : [];
  const imageBlocks = files
    .filter((file) => file?.buffer && typeof file.mimetype === 'string' && file.mimetype.startsWith('image/'))
    .map((file) => ({
      type: 'image',
      source: {
        type: 'base64',
        media_type: file.mimetype,
        data: file.buffer.toString('base64'),
      },
    }));

  const content = [{ type: 'text', text: userPrompt }, ...imageBlocks];

  let statusCode = 200;
  let streamedChars = 0;
  let ended = false;

  req.on('close', () => {
    ended = true;
  });

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL,
    });

    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }
    res.write(JSON.stringify({ type: 'status', phase: 'streaming' }) + '\n');

    const stream = await anthropic.messages.create({
      model,
      max_tokens: Math.max(128, Math.min(maxTokens, 8192)),
      system:
        'You are helping design and audit a mobile-first game UI called CatClash. Be concise, practical, and avoid fluff. Focus on UX, hierarchy, and game feel. Output in short structured bullets.',
      messages: [{ role: 'user', content }],
      stream: true,
    });

    let full = '';

    for await (const event of stream) {
      if (ended) break;
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        const delta = String(event.delta.text || '');
        if (!delta) continue;
        full += delta;
        streamedChars += delta.length;
        res.write(JSON.stringify({ type: 'delta', text: delta }) + '\n');
      }

      if (event.type === 'message_stop') {
        res.write(JSON.stringify({ type: 'done', text: full }) + '\n');
      }
    }

    if (!ended) res.end();

    console.info('[railway/claude-proxy] request complete', {
      route: '/v1/messages',
      statusCode,
      durationMs: now() - startedAt,
      imageCount: imageBlocks.length,
      streamedChars,
      model,
    });
  } catch (error) {
    const message = typeof error?.message === 'string' ? error.message : 'Claude proxy failed';
    statusCode = Number(error?.status || error?.statusCode || error?.response?.status || 500);
    statusCode = Math.min(Math.max(statusCode, 400), 599);

    console.error('[railway/claude-proxy] request failure', {
      route: '/v1/messages',
      statusCode,
      durationMs: now() - startedAt,
      error: message,
      model,
    });

    if (!res.headersSent) {
      res.status(statusCode).json({ ok: false, error: message, status: statusCode });
      return;
    }

    if (!ended) {
      res.write(JSON.stringify({ type: 'error', error: message, status: statusCode }) + '\n');
      res.end();
    }
  }
});

app.use((err, _req, res, _next) => {
  const message = typeof err?.message === 'string' ? err.message : 'Bad request';
  const status = Number(err?.status || err?.statusCode || 400);
  res.status(Math.min(Math.max(status, 400), 599)).json({ ok: false, error: message });
});

app.listen(port, () => {
  console.info(`[railway/claude-proxy] listening on :${port}`);
});
