import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGuestId } from '../../_lib/guest';
import { FEATURES } from '../../_lib/flags';
import { requireUsername } from '../../_lib/require-username';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function makeRefCode(userId: string): string {
  const salt = Math.random().toString(36).slice(2, 8);
  return `${userId.replace(/-/g, '').slice(0, 6)}${salt}`.toUpperCase();
}

export async function POST(req: NextRequest) {
  try {
    if (!FEATURES.SOCIAL_LOOP_V2) {
      return NextResponse.json({ ok: false, error: 'Social loop disabled' }, { status: 404 });
    }
    const userId = await getGuestId();
    if (!userId) return NextResponse.json({ ok: false, error: 'No session' }, { status: 401 });
    const usernameCheck = await requireUsername(supabase, userId, 'start social challenges');
    if (!usernameCheck.ok) return usernameCheck.response;

    const body = await req.json().catch(() => ({}));
    const invitedUserIdRaw = String(body?.invited_user_id || '').trim();
    const invitedUserId = invitedUserIdRaw || null;

    const now = new Date();
    const ends = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    let refCode = makeRefCode(userId);

    for (let i = 0; i < 3; i += 1) {
      const { data, error } = await supabase
        .from('user_social_challenges')
        .insert({
          owner_user_id: userId,
          invited_user_id: invitedUserId,
          ref_code: refCode,
          started_at: now.toISOString(),
          ends_at: ends.toISOString(),
        })
        .select('id, ref_code, started_at, ends_at')
        .maybeSingle();

      if (!error && data) {
        const link = `${req.nextUrl.origin}/?challenge=${encodeURIComponent(data.ref_code)}&ref=${encodeURIComponent(userId)}`;
        return NextResponse.json({ ok: true, challenge: data, link });
      }

      const msg = String(error?.message || '').toLowerCase();
      if (msg.includes('duplicate') || msg.includes('unique')) {
        refCode = makeRefCode(userId);
        continue;
      }
      if (msg.includes('user_social_challenges')) {
        return NextResponse.json({ ok: true, challenge: null, link: `${req.nextUrl.origin}/?ref=${encodeURIComponent(userId)}`, degraded: true });
      }
      return NextResponse.json({ ok: false, error: error?.message || 'Failed to start challenge' }, { status: 500 });
    }

    return NextResponse.json({ ok: false, error: 'Could not allocate challenge code' }, { status: 500 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!FEATURES.SOCIAL_LOOP_V2) {
      return NextResponse.json({ ok: false, error: 'Social loop disabled' }, { status: 404 });
    }
    const code = String(req.nextUrl.searchParams.get('code') || '').trim().toUpperCase();
    if (!code) return NextResponse.json({ ok: false, error: 'Missing code' }, { status: 400 });

    const userId = await getGuestId();
    const { data: row } = await supabase
      .from('user_social_challenges')
      .select('id, owner_user_id, invited_user_id, ref_code, started_at, ends_at')
      .eq('ref_code', code)
      .maybeSingle();
    if (!row) return NextResponse.json({ ok: false, error: 'Challenge not found' }, { status: 404 });

    const endsAt = new Date(String(row.ends_at));
    const now = new Date();
    const active = endsAt.getTime() > now.getTime();
    const secondsLeft = Math.max(0, Math.floor((endsAt.getTime() - now.getTime()) / 1000));

    let ownerUsername: string | null = null;
    if (row.owner_user_id) {
      const { data: owner } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', row.owner_user_id)
        .maybeSingle();
      ownerUsername = String(owner?.username || '').trim() || null;
    }

    // First visitor join attribution for challenge context.
    if (active && userId && userId !== row.owner_user_id && !row.invited_user_id) {
      await supabase
        .from('user_social_challenges')
        .update({ invited_user_id: userId })
        .eq('id', row.id)
        .is('invited_user_id', null);
    }

    return NextResponse.json({
      ok: true,
      challenge: {
        id: row.id,
        ref_code: row.ref_code,
        owner_user_id: row.owner_user_id,
        owner_username: ownerUsername,
        started_at: row.started_at,
        ends_at: row.ends_at,
        active,
        seconds_left: secondsLeft,
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
