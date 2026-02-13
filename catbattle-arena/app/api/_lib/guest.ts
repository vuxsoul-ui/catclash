import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

const GUEST_COOKIE_NAME = 'guest_id';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function getGuestId(): string {
  const cookieStore = cookies();
  let guestId = cookieStore.get(GUEST_COOKIE_NAME)?.value;
  
  if (!guestId) {
    guestId = uuidv4();
    cookieStore.set(GUEST_COOKIE_NAME, guestId, {
      maxAge: COOKIE_MAX_AGE,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
  }
  
  return guestId;
}
