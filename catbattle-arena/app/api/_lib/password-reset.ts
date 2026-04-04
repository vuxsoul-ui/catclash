import crypto from 'crypto';

const RESET_TOKEN_BYTES = 32;
const RECOVERY_CODE_COUNT = 8;

function secretPepper(): string {
  return String(process.env.PASSWORD_RESET_PEPPER || '').trim();
}

export function generateResetToken(): string {
  return crypto.randomBytes(RESET_TOKEN_BYTES).toString('base64url');
}

export function normalizeRecoveryCode(input: string): string {
  return String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function hashSecret(input: string): string {
  const h = crypto.createHash('sha256');
  h.update(String(input || ''));
  const pepper = secretPepper();
  if (pepper) h.update(':');
  if (pepper) h.update(pepper);
  return h.digest('hex');
}

function makeRecoveryCode(): string {
  const raw = crypto.randomBytes(8).toString('hex').toUpperCase().slice(0, 10);
  return `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  const out = new Set<string>();
  while (out.size < count) out.add(makeRecoveryCode());
  return Array.from(out);
}
