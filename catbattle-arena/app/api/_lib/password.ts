import crypto from 'crypto';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEYLEN = 64;

export function normalizeUsername(input: string): string {
  return String(input || '').trim().toLowerCase();
}

export function validatePassword(input: string): { ok: boolean; error?: string } {
  const pwd = String(input || '');
  if (pwd.length < 8) return { ok: false, error: 'Password must be at least 8 characters' };
  if (pwd.length > 128) return { ok: false, error: 'Password too long' };
  return { ok: true };
}

export async function hashPassword(password: string, saltHex?: string): Promise<{ hash: string; salt: string; algo: string }> {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const derived = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(
      password,
      Buffer.from(salt, 'hex'),
      KEYLEN,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
      (err, key) => {
        if (err) reject(err);
        else resolve(key as Buffer);
      }
    );
  });
  return {
    hash: derived.toString('hex'),
    salt,
    algo: `scrypt:N=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P},keylen=${KEYLEN}`,
  };
}

export async function verifyPassword(password: string, expectedHashHex: string, saltHex: string): Promise<boolean> {
  const actual = await hashPassword(password, saltHex);
  const a = Buffer.from(actual.hash, 'hex');
  const b = Buffer.from(expectedHashHex, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

