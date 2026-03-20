import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import {
  LAUNCH_GATE_CONFIG,
  issueLaunchGateToken,
  launchGateCookieMaxAgeSeconds,
} from '../../_lib/launchConfig';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  if (!LAUNCH_GATE_CONFIG.enabled) {
    return NextResponse.json({ error: 'Launch gate is disabled' }, { status: 410 });
  }

  const body = await request.json().catch(() => ({}));
  const password = String(body?.password || '').trim();
  if (!password || !safeEqual(password, LAUNCH_GATE_CONFIG.password)) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const token = await issueLaunchGateToken();
  const response = NextResponse.json({ success: true, message: 'Welcome to Cat Clash!' });
  response.cookies.set(LAUNCH_GATE_CONFIG.cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: launchGateCookieMaxAgeSeconds(),
  });
  return response;
}
