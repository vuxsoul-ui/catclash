import { createHmac, timingSafeEqual } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { type NextRequest, type NextResponse } from 'next/server';

export const GUEST_COOKIE_NAME = 'guest';
export const LEGACY_GUEST_COOKIE_NAME = 'guest_id';
export const DEFAULT_GUEST_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 year

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getGuestSecret(): string {
  const secret = String(process.env.GUEST_SECRET || '').trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('GUEST_SECRET is required in production');
  }
  // Dev/test fallback keeps local workflows functional while production remains fail-closed.
  return 'dev-guest-secret-local-only-change-me';
}

function toB64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function fromB64Url(value: string): string | null {
  try {
    return Buffer.from(value, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

function signPayload(payloadB64: string, secret: string): string {
  return createHmac('sha256', secret).update(payloadB64).digest('base64url');
}

function isUuid(value: string): boolean {
  return UUID_V4_RE.test(String(value || '').trim());
}

export function issueGuestToken(guestId: string, ttlSeconds: number): string {
  const cleanGuestId = String(guestId || '').trim();
  if (!isUuid(cleanGuestId)) throw new Error('Invalid guest id');
  const secret = getGuestSecret();
  if (!secret) throw new Error('Missing guest signing secret');

  const expUnix = Math.floor(Date.now() / 1000) + Math.max(60, Math.floor(Number(ttlSeconds || 0)));
  const payloadB64 = toB64Url(`${cleanGuestId}:${expUnix}`);
  const sigB64 = signPayload(payloadB64, secret);
  return `${payloadB64}.${sigB64}`;
}

export function verifyGuestToken(token: string): { guestId: string } | null {
  const value = String(token || '').trim();
  if (!value) return null;
  const [payloadB64, sigB64] = value.split('.');
  if (!payloadB64 || !sigB64) return null;

  const secret = getGuestSecret();
  if (!secret) return null;

  const expectedSig = signPayload(payloadB64, secret);
  const got = Buffer.from(sigB64);
  const expected = Buffer.from(expectedSig);
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;

  const payload = fromB64Url(payloadB64);
  if (!payload) return null;
  const [guestIdRaw, expRaw] = payload.split(':');
  const guestId = String(guestIdRaw || '').trim();
  const expUnix = Number(expRaw);
  if (!isUuid(guestId)) return null;
  if (!Number.isFinite(expUnix) || Math.floor(Date.now() / 1000) >= expUnix) return null;

  return { guestId };
}

function setCookieValue(
  cookiesApi: CookieWriter,
  guestId: string,
  ttlSeconds = DEFAULT_GUEST_TTL_SECONDS
) {
  const token = issueGuestToken(guestId, ttlSeconds);
  cookiesApi.set(GUEST_COOKIE_NAME, token, {
    maxAge: ttlSeconds,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  cookiesApi.delete(LEGACY_GUEST_COOKIE_NAME);
}

export function setGuestCookie(res: NextResponse, guestId: string, ttlSeconds = DEFAULT_GUEST_TTL_SECONDS): void {
  setCookieValue(res.cookies, guestId, ttlSeconds);
}

export function setGuestCookieOnStore(
  cookieStore: CookieWriter,
  guestId: string,
  ttlSeconds = DEFAULT_GUEST_TTL_SECONDS
): void {
  setCookieValue(cookieStore, guestId, ttlSeconds);
}

export function getVerifiedGuestId(req: NextRequest): string | null {
  const token = req.cookies.get(GUEST_COOKIE_NAME)?.value || '';
  return verifyGuestToken(token)?.guestId || null;
}

export function mintGuestId(): string {
  return uuidv4();
}
type CookieWriter = {
  set: (name: string, value: string, options: {
    maxAge: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'lax';
    path: string;
  }) => void;
  delete: (name: string) => void;
};
