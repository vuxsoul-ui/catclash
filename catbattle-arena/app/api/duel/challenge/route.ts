import { NextRequest, NextResponse } from 'next/server';
import { getGuestId } from '../../_lib/guest';
import { duelSb as sb } from '../_lib';
import { requireUsername } from '../../_lib/require-username';

export const dynamic = 'force-dynamic';

function isMissingTable(message: string): boolean {
  const m = String(message || '').toLowerCase();
  return m.includes('duel_challenges') && (m.includes('does not exist') || m.includes('relation'));
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getGuestId();
    if (!userId) return NextResponse.json({ ok: false, error: 'No session' }, { status: 401 });
    const usernameCheck = await requireUsername(sb, userId, 'start duels');
    if (!usernameCheck.ok) return usernameCheck.response;

    await sb.rpc('bootstrap_user', { p_user_id: userId });
    const body = await request.json().catch(() => ({}));
    const challengedUserId = String(body?.challenged_user_id || '').trim();
    const challengerCatId = String(body?.challenger_cat_id || '').trim();

    if (!challengedUserId || !challengerCatId) {
      return NextResponse.json({ ok: false, error: 'Missing challenged_user_id or challenger_cat_id' }, { status: 400 });
    }
    if (challengedUserId === userId) {
      return NextResponse.json({ ok: false, error: 'You cannot challenge yourself' }, { status: 400 });
    }

    const [{ data: challengerCat }, { data: challengedProfile }, { data: challengerProfile }] = await Promise.all([
      sb.from('cats').select('id, user_id, name, image_review_status').eq('id', challengerCatId).maybeSingle(),
      sb.from('profiles').select('id, username').eq('id', challengedUserId).maybeSingle(),
      sb.from('profiles').select('id, username').eq('id', userId).maybeSingle(),
    ]);

    if (!challengerCat || String(challengerCat.user_id || '') !== userId) {
      return NextResponse.json({ ok: false, error: 'Invalid challenger cat' }, { status: 403 });
    }
    if (!challengedProfile) {
      return NextResponse.json({ ok: false, error: 'Target player not found' }, { status: 404 });
    }
    if (!String(challengedProfile.username || '').trim()) {
      return NextResponse.json({ ok: false, error: 'Target player must set a username before they can be dueled' }, { status: 400 });
    }
    if (!String(challengerProfile?.username || '').trim()) {
      return NextResponse.json({ ok: false, error: 'Set your username before you can start duels.' }, { status: 403 });
    }

    const { count: pendingCount } = await sb
      .from('duel_challenges')
      .select('id', { head: true, count: 'exact' })
      .eq('challenger_user_id', userId)
      .eq('status', 'pending');
    if ((pendingCount || 0) >= 5) {
      return NextResponse.json({ ok: false, error: 'Too many pending challenges. Wait for responses.' }, { status: 429 });
    }

    const { data: duel, error } = await sb
      .from('duel_challenges')
      .insert({
        challenger_user_id: userId,
        challenged_user_id: challengedUserId,
        challenger_cat_id: challengerCatId,
        status: 'pending',
      })
      .select('id, status, created_at')
      .single();

    if (error) {
      if (isMissingTable(error.message)) {
        return NextResponse.json({ ok: false, error: 'Duel Arena is not enabled yet on this deployment' }, { status: 503 });
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, duel });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
