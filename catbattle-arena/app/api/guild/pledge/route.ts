import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../_lib/guest';

const GUILD_COOKIE = 'guild_pledge';
const VALID_GUILDS = new Set(['sun', 'moon']);

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim();

export async function GET(request: NextRequest) {
  const guestId = await getGuestId();
  const raw = request.cookies.get(GUILD_COOKIE)?.value || null;

  let guild = raw && VALID_GUILDS.has(raw) ? raw : null;
  if (guestId) {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: profile } = await supabase
      .from('profiles')
      .select('guild')
      .eq('id', guestId)
      .maybeSingle();
    if (profile?.guild && VALID_GUILDS.has(profile.guild)) guild = profile.guild;
  }

  return NextResponse.json({ ok: true, guild });
}

export async function POST(request: NextRequest) {
  const guestId = await getGuestId();
  const body = await request.json().catch(() => ({}));
  const guild = String(body.guild || '').trim().toLowerCase();

  if (!VALID_GUILDS.has(guild)) {
    return NextResponse.json({ ok: false, error: 'Invalid guild' }, { status: 400 });
  }

  if (guestId) {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await supabase.rpc('bootstrap_user', { p_user_id: guestId });
    await supabase.from('profiles').update({ guild }).eq('id', guestId);
  }

  const response = NextResponse.json({ ok: true, guild });
  response.cookies.set(GUILD_COOKIE, guild, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  });
  return response;
}
