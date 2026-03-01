import { NextResponse } from 'next/server';
import { GUEST_COOKIE_NAME, LEGACY_GUEST_COOKIE_NAME } from '../../_lib/guestAuth';

export const dynamic = 'force-dynamic';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(GUEST_COOKIE_NAME);
  response.cookies.delete(LEGACY_GUEST_COOKIE_NAME);
  response.cookies.delete('guild_pledge');
  return response;
}
