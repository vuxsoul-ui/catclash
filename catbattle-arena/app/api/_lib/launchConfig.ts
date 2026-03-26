function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (!raw) return fallback;
  const v = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return fallback;
}

function parseIntSafe(raw: string | undefined, fallback: number): number {
  const n = Number(raw || '');
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function parseDurationMs(raw: string | undefined, fallbackMs: number): number {
  const n = Number(raw || '');
  return Number.isFinite(n) && n >= 60_000 ? Math.floor(n) : fallbackMs;
}

export const LAUNCH_CONFIG = {
  enableSpikeStacking: parseBool(process.env.FEATURE_LAUNCH_SPIKE_STACKING, true),
  hotMatchBiasEnabled: parseBool(process.env.FEATURE_HOT_MATCH_BIAS, true),
  spotlightRotationEnabled: parseBool(process.env.FEATURE_SPOTLIGHT_ROTATION, true),
  spotlightRotationHours: parseIntSafe(process.env.LAUNCH_SPOTLIGHT_ROTATION_HOURS, 8),
  recruitPushEnabled: parseBool(process.env.FEATURE_RECRUIT_PUSH, true),
  clutchSharePromptEnabled: parseBool(process.env.FEATURE_CLUTCH_SHARE_PROMPT, true),
  seedMatchupAutoFill: parseBool(process.env.FEATURE_SEED_MATCHUP_AUTOFILL, true),

  limitGuestVotesPerMinute: parseIntSafe(process.env.LAUNCH_LIMIT_GUEST_VOTES_PER_MINUTE, 12),
  limitGuestVotesPerIpPerMinute: parseIntSafe(process.env.LAUNCH_LIMIT_GUEST_VOTES_PER_IP_PER_MINUTE, 60),
  rateLimitSignupPerIPPerHour: parseIntSafe(process.env.LAUNCH_RATE_LIMIT_SIGNUP_PER_IP_PER_HOUR, 20),

  qualifiedDailyCapPerInviter: parseIntSafe(process.env.LAUNCH_QUALIFIED_DAILY_CAP_PER_INVITER, 50),
  globalQualifiedCap: parseIntSafe(process.env.LAUNCH_GLOBAL_QUALIFIED_CAP, 1000),
} as const;

const DEFAULT_LAUNCH_GATE_COOKIE_MS = 30 * 24 * 60 * 60 * 1000;

export const LAUNCH_GATE_CONFIG = {
  enabled: false,
  password: String(process.env.LAUNCH_GATE_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'catclash')).trim(),
  cookieName: 'catclash-launch-access',
  cookieMaxAgeMs: parseDurationMs(process.env.LAUNCH_GATE_COOKIE_MAX_AGE, DEFAULT_LAUNCH_GATE_COOKIE_MS),
  openPaths: [
    '/',
    '/submit',
    '/gallery',
    '/shop',
    '/profile',
    '/social',
    '/login',
    '/launch',
    '/manifest.json',
    '/robots.txt',
    '/favicon.ico',
    '/cat',
    '/c',
  ],
} as const;

export function launchGateCookieMaxAgeSeconds(): number {
  return Math.max(60, Math.floor(LAUNCH_GATE_CONFIG.cookieMaxAgeMs / 1000));
}

function normalizePathname(pathname: string): string {
  const trimmed = String(pathname || '/').trim();
  if (!trimmed) return '/';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function matchesOpenPath(pathname: string, openPath: string): boolean {
  if (openPath === '/') return pathname === '/';
  return pathname === openPath || pathname.startsWith(`${openPath}/`);
}

export function isLaunchOpenPath(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  return LAUNCH_GATE_CONFIG.openPaths.some((openPath) => matchesOpenPath(normalized, openPath));
}

export function isLaunchProtectedPath(pathname: string): boolean {
  if (!LAUNCH_GATE_CONFIG.enabled) return false;
  return !isLaunchOpenPath(pathname);
}

function getLaunchGateSecret(): string {
  const secret = String(process.env.NEXTAUTH_SECRET || process.env.GUEST_SECRET || '').trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXTAUTH_SECRET is required when LAUNCH_GATE_ENABLED=true');
  }
  return 'dev-launch-gate-secret-local-only-change-me';
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array | null {
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`;
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function importLaunchGateKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function issueLaunchGateToken(ttlSeconds = launchGateCookieMaxAgeSeconds()): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + Math.max(60, Math.floor(Number(ttlSeconds || 0)));
  const payloadJson = JSON.stringify({ exp: expiresAt });
  const payloadB64 = toBase64Url(new TextEncoder().encode(payloadJson));
  const key = await importLaunchGateKey(getLaunchGateSecret());
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifyLaunchGateToken(token: string): Promise<boolean> {
  const value = String(token || '').trim();
  if (!value) return false;

  const [payloadB64, signatureB64] = value.split('.');
  if (!payloadB64 || !signatureB64) return false;

  const signature = fromBase64Url(signatureB64);
  if (!signature) return false;

  const key = await importLaunchGateKey(getLaunchGateSecret());
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    toArrayBuffer(signature),
    toArrayBuffer(new TextEncoder().encode(payloadB64))
  );
  if (!valid) return false;

  const payloadBytes = fromBase64Url(payloadB64);
  if (!payloadBytes) return false;

  try {
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as { exp?: number };
    const expiresAt = Number(payload?.exp || 0);
    if (!Number.isFinite(expiresAt)) return false;
    return Math.floor(Date.now() / 1000) < expiresAt;
  } catch {
    return false;
  }
}

export function launchPulseBucket(now = new Date()): string {
  const hours = Math.max(1, LAUNCH_CONFIG.spotlightRotationHours);
  const utcHour = now.getUTCHours();
  const bucket = Math.floor(utcHour / hours);
  return `${now.toISOString().slice(0, 10)}:${bucket}`;
}
