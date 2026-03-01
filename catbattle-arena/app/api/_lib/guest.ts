import { cookies } from 'next/headers';
import {
  DEFAULT_GUEST_TTL_SECONDS,
  GUEST_COOKIE_NAME,
  mintGuestId,
  setGuestCookieOnStore,
  verifyGuestToken,
} from './guestAuth';

export async function getOrCreateGuestId(): Promise<string> {
  const cookieStore = await cookies();
  const token = cookieStore.get(GUEST_COOKIE_NAME)?.value || '';
  const verified = verifyGuestToken(token);
  if (verified?.guestId) return verified.guestId;

  const guestId = mintGuestId();
  setGuestCookieOnStore(cookieStore, guestId, DEFAULT_GUEST_TTL_SECONDS);
  return guestId;
}

export async function requireGuestId(): Promise<string> {
  const cookieStore = await cookies();
  const token = cookieStore.get(GUEST_COOKIE_NAME)?.value || '';
  const verified = verifyGuestToken(token);
  if (!verified?.guestId) {
    throw new Error('Unauthorized guest identity');
  }
  return verified.guestId;
}

// Backward-compatible alias for existing read-first routes.
export async function getGuestId(): Promise<string> {
  return getOrCreateGuestId();
}
