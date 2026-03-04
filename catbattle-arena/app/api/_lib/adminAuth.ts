import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

function parseBearer(value: string | null): string {
  const raw = String(value || '').trim();
  const match = raw.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

function weakSecret(secret: string): boolean {
  const clean = String(secret || '').trim();
  if (!clean) return true;
  if (clean.length < 16) return true;
  const lower = clean.toLowerCase();
  return lower.includes('change-me') || lower.includes('changeme') || lower.includes('admin-secret');
}

function safeEq(a: string, b: string): boolean {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function getAllowedSecrets(): string[] {
  const adminToken = String(process.env.ADMIN_TOKEN || '').trim();
  const adminSecret = String(process.env.ADMIN_SECRET || '').trim();
  const cronSecret = String(process.env.CRON_SECRET || '').trim();
  const list = [adminToken, adminSecret, cronSecret].filter(Boolean);
  return Array.from(new Set(list));
}

function isSecretConfigUsable(): { ok: true } | { ok: false; reason: string } {
  const adminToken = String(process.env.ADMIN_TOKEN || '').trim();
  // Fail closed to avoid accidental public admin access when token env is unset.
  if (!adminToken) return { ok: false, reason: 'ADMIN_TOKEN is required' };

  const secrets = getAllowedSecrets();
  if (process.env.NODE_ENV === 'production') {
    const adminSecret = String(process.env.ADMIN_SECRET || '').trim();
    const cronSecret = String(process.env.CRON_SECRET || '').trim();
    if (!adminSecret) return { ok: false, reason: 'ADMIN_SECRET is required in production' };
    if (weakSecret(adminSecret)) return { ok: false, reason: 'ADMIN_SECRET is weak in production' };
    if (!cronSecret) return { ok: false, reason: 'CRON_SECRET is required in production' };
    if (weakSecret(cronSecret)) return { ok: false, reason: 'CRON_SECRET is weak in production' };
  }
  if (secrets.length === 0) return { ok: false, reason: 'Missing admin secrets' };
  return { ok: true };
}

export function isAdminAuthorized(req: NextRequest): boolean {
  const secretCheck = isSecretConfigUsable();
  if (!secretCheck.ok) return false;

  const bearer = parseBearer(req.headers.get('authorization'));
  if (!bearer) return false;
  return getAllowedSecrets().some((secret) => safeEq(secret, bearer));
}

export function requireAdmin(req: NextRequest): { ok: true } | NextResponse {
  const secretCheck = isSecretConfigUsable();
  if (!secretCheck.ok) {
    return NextResponse.json(
      { ok: false, error: process.env.NODE_ENV === 'production' ? 'Unauthorized' : secretCheck.reason },
      { status: 401 }
    );
  }
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  return { ok: true };
}
