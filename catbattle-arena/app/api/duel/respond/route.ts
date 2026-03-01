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
    const usernameCheck = await requireUsername(sb, userId, 'respond to duel challenges');
    if (!usernameCheck.ok) return usernameCheck.response;

    const body = await request.json().catch(() => ({}));
    const duelId = String(body?.duel_id || '').trim();
    const action = String(body?.action || '').trim().toLowerCase();
    const challengedCatId = String(body?.challenged_cat_id || '').trim();

    if (!duelId || (action !== 'accept' && action !== 'decline')) {
      return NextResponse.json({ ok: false, error: 'Missing duel_id or invalid action' }, { status: 400 });
    }

    const { data: duel, error: duelErr } = await sb
      .from('duel_challenges')
      .select('id, status, challenger_user_id, challenged_user_id, challenger_cat_id')
      .eq('id', duelId)
      .maybeSingle();
    if (duelErr) {
      if (isMissingTable(duelErr.message)) {
        return NextResponse.json({ ok: false, error: 'Duel Arena is not enabled yet on this deployment' }, { status: 503 });
      }
      return NextResponse.json({ ok: false, error: duelErr.message }, { status: 500 });
    }
    if (!duel) return NextResponse.json({ ok: false, error: 'Duel not found' }, { status: 404 });
    if (String(duel.challenged_user_id || '') !== userId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 403 });
    if (String(duel.status || '') !== 'pending') return NextResponse.json({ ok: false, error: 'Duel already resolved' }, { status: 400 });

    if (action === 'decline') {
      const { error } = await sb
        .from('duel_challenges')
        .update({
          status: 'declined',
          responded_at: new Date().toISOString(),
        })
        .eq('id', duelId);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, status: 'declined' });
    }

    if (!challengedCatId) {
      return NextResponse.json({ ok: false, error: 'Missing challenged_cat_id' }, { status: 400 });
    }

    const { data: challengedCat } = await sb
      .from('cats')
      .select('id, user_id')
      .eq('id', challengedCatId)
      .maybeSingle();
    if (!challengedCat || String(challengedCat.user_id || '') !== userId) {
      return NextResponse.json({ ok: false, error: 'Invalid defending cat' }, { status: 403 });
    }

    const nowIso = new Date().toISOString();
    const { error: updErr } = await sb
      .from('duel_challenges')
      .update({
        challenged_cat_id: challengedCatId,
        status: 'voting',
        responded_at: nowIso,
      })
      .eq('id', duelId);
    if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      status: 'voting',
      challenged_cat_id: challengedCatId,
      message: 'Duel is now open for community voting',
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
