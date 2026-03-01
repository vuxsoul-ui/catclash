import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitRule = {
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSec: number;
  remaining: number;
  limit: number;
};

const store = new Map<string, Bucket>();
let lastSweepAt = 0;

function nowMs() {
  return Date.now();
}

function sweepExpired(now: number) {
  // Keep overhead low: sweep at most once per 30s.
  if (now - lastSweepAt < 30_000) return;
  lastSweepAt = now;
  for (const [k, v] of store.entries()) {
    if (v.resetAt <= now) store.delete(k);
  }
}

function checkAndConsume(rule: RateLimitRule): RateLimitResult {
  const now = nowMs();
  sweepExpired(now);

  const existing = store.get(rule.key);
  if (!existing || existing.resetAt <= now) {
    store.set(rule.key, { count: 1, resetAt: now + rule.windowMs });
    return {
      allowed: true,
      retryAfterSec: 0,
      remaining: Math.max(0, rule.limit - 1),
      limit: rule.limit,
    };
  }

  if (existing.count >= rule.limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      remaining: 0,
      limit: rule.limit,
    };
  }

  existing.count += 1;
  store.set(rule.key, existing);
  return {
    allowed: true,
    retryAfterSec: 0,
    remaining: Math.max(0, rule.limit - existing.count),
    limit: rule.limit,
  };
}

export function checkRateLimit(rule: RateLimitRule): RateLimitResult {
  return checkAndConsume(rule);
}

export function checkRateLimitMany(rules: RateLimitRule[]): RateLimitResult {
  let worstBlocked: RateLimitResult | null = null;
  for (const rule of rules) {
    const result = checkAndConsume(rule);
    if (!result.allowed) {
      if (!worstBlocked || result.retryAfterSec > worstBlocked.retryAfterSec) {
        worstBlocked = result;
      }
    }
  }
  return (
    worstBlocked || {
      allowed: true,
      retryAfterSec: 0,
      remaining: Math.min(...rules.map((r) => r.limit)),
      limit: Math.min(...rules.map((r) => r.limit)),
    }
  );
}

export function getClientIp(req: { headers: Headers }): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const xr = req.headers.get('x-real-ip');
  if (xr) return xr.trim();
  return null;
}

export function getClientIpPrefix(req: { headers: Headers }): string | null {
  const ip = String(getClientIp(req) || '').trim();
  if (!ip) return null;
  if (ip.includes(':')) {
    const chunks = ip.split(':').filter(Boolean).slice(0, 4);
    return chunks.join(':');
  }
  const parts = ip.split('.').map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 4) return ip;
  return `${parts[0]}.${parts[1]}.${parts[2]}`;
}

export function hashValue(input: string | null | undefined): string | null {
  if (!input) return null;
  return crypto.createHash('sha256').update(input).digest('hex');
}

type PersistentRateLimitRule = RateLimitRule;

function getSupabaseForRateLimit() {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function checkAndConsumePersistent(rule: PersistentRateLimitRule): Promise<RateLimitResult> {
  const sb = getSupabaseForRateLimit();
  if (!sb) return checkAndConsume(rule);

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const windowStart = new Date(now - rule.windowMs).toISOString();

  const { data: row, error: readErr } = await sb
    .from('rate_limits')
    .select('key,count,window_start')
    .eq('key', rule.key)
    .maybeSingle();

  if (readErr) return checkAndConsume(rule);

  const existingCount = Number((row as { count?: number } | null)?.count || 0);
  const existingWindowStart = Date.parse(String((row as { window_start?: string } | null)?.window_start || ''));
  const inWindow = Number.isFinite(existingWindowStart) && existingWindowStart >= Date.parse(windowStart);

  if (!row || !inWindow) {
    await sb
      .from('rate_limits')
      .upsert({ key: rule.key, count: 1, window_start: nowIso, updated_at: nowIso }, { onConflict: 'key' });
    return {
      allowed: true,
      retryAfterSec: 0,
      remaining: Math.max(0, rule.limit - 1),
      limit: rule.limit,
    };
  }

  if (existingCount >= rule.limit) {
    const resetMs = existingWindowStart + rule.windowMs;
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((resetMs - now) / 1000)),
      remaining: 0,
      limit: rule.limit,
    };
  }

  const nextCount = existingCount + 1;
  await sb
    .from('rate_limits')
    .upsert({ key: rule.key, count: nextCount, window_start: new Date(existingWindowStart).toISOString(), updated_at: nowIso }, { onConflict: 'key' });

  return {
    allowed: true,
    retryAfterSec: 0,
    remaining: Math.max(0, rule.limit - nextCount),
    limit: rule.limit,
  };
}

export async function checkRateLimitManyPersistent(rules: PersistentRateLimitRule[]): Promise<RateLimitResult> {
  let worstBlocked: RateLimitResult | null = null;
  for (const rule of rules) {
    const result = await checkAndConsumePersistent(rule);
    if (!result.allowed) {
      if (!worstBlocked || result.retryAfterSec > worstBlocked.retryAfterSec) worstBlocked = result;
    }
  }
  return (
    worstBlocked || {
      allowed: true,
      retryAfterSec: 0,
      remaining: Math.min(...rules.map((r) => r.limit)),
      limit: Math.min(...rules.map((r) => r.limit)),
    }
  );
}
