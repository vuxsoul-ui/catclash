import { NextRequest, NextResponse } from 'next/server';
import { getGuestId } from '../../_lib/guest';
import { duelSb as sb } from '../_lib';
import { resolveCatImageUrl } from '../../_lib/images';
import { requireUsername } from '../../_lib/require-username';

export const dynamic = 'force-dynamic';

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getGuestId();
    if (!userId) return NextResponse.json({ ok: false, error: 'No session' }, { status: 401 });
    await sb.rpc('bootstrap_user', { p_user_id: userId });
    const usernameCheck = await requireUsername(sb, userId, 'start referral duels');
    if (!usernameCheck.ok) return usernameCheck.response;

    const body = await request.json().catch(() => ({}));
    const refUserId = String(body?.ref_user_id || '').trim();
    const challengerCatId = String(body?.challenger_cat_id || '').trim();
    const challengedCatIdRaw = String(body?.challenged_cat_id || '').trim();

    if (!isUuid(refUserId) || !isUuid(challengerCatId)) {
      return NextResponse.json({ ok: false, error: 'Invalid ref_user_id or challenger_cat_id' }, { status: 400 });
    }
    if (refUserId === userId) {
      return NextResponse.json({ ok: false, error: 'Cannot duel yourself' }, { status: 400 });
    }

    const [{ data: refProfile }, { data: guestProfile }] = await Promise.all([
      sb.from('profiles').select('id, username').eq('id', refUserId).maybeSingle(),
      sb.from('profiles').select('id, username').eq('id', userId).maybeSingle(),
    ]);
    if (!refProfile?.id) return NextResponse.json({ ok: false, error: 'Referrer not found' }, { status: 404 });

    const { data: challengerCat } = await sb
      .from('cats')
      .select('id, user_id, name, image_path')
      .eq('id', challengerCatId)
      .maybeSingle();
    if (!challengerCat || String(challengerCat.user_id || '') !== refUserId) {
      return NextResponse.json({ ok: false, error: 'Shared challenger cat is invalid' }, { status: 400 });
    }

    const challengedCatId = challengedCatIdRaw;
    if (!challengedCatId || !isUuid(challengedCatId)) {
      return NextResponse.json({ ok: false, error: 'Submit a cat first, then start the duel.' }, { status: 400 });
    }
    const { data: challengedCat } = await sb
      .from('cats')
      .select('id, user_id, name, image_path')
      .eq('id', challengedCatId)
      .maybeSingle();
    if (!challengedCat || String(challengedCat.user_id || '') !== userId) {
      return NextResponse.json({ ok: false, error: 'Invalid defending cat' }, { status: 403 });
    }

    const sinceIso = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await sb
      .from('duel_challenges')
      .select('id, status, created_at, challenger_user_id, challenged_user_id, challenger_cat_id, challenged_cat_id')
      .eq('challenger_user_id', refUserId)
      .eq('challenged_user_id', userId)
      .eq('challenger_cat_id', challengerCatId)
      .eq('challenged_cat_id', challengedCatId)
      .in('status', ['pending', 'voting'])
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let duelId = String(existing?.id || '').trim();
    const nowIso = new Date().toISOString();

    if (!duelId) {
      const { data: inserted, error: insErr } = await sb
        .from('duel_challenges')
        .insert({
          challenger_user_id: refUserId,
          challenged_user_id: userId,
          challenger_cat_id: challengerCatId,
          challenged_cat_id: challengedCatId,
          status: 'voting',
          responded_at: nowIso,
        })
        .select('id')
        .single();
      if (insErr || !inserted?.id) return NextResponse.json({ ok: false, error: insErr?.message || 'Failed to create duel' }, { status: 500 });
      duelId = String(inserted.id);
    }

    const [challengerImage, challengedImage] = await Promise.all([
      resolveCatImageUrl(sb, challengerCat.image_path),
      resolveCatImageUrl(sb, challengedCat.image_path),
    ]);

    return NextResponse.json({
      ok: true,
      duel: {
        id: duelId,
        status: 'voting',
        voting_begins_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        challenger_user_id: refUserId,
        challenged_user_id: userId,
        challenger_username: String(refProfile.username || `Player ${refUserId.slice(0, 8)}`),
        challenged_username: String(guestProfile?.username || `Player ${userId.slice(0, 8)}`),
        challenger_cat: { id: challengerCat.id, name: challengerCat.name, image_url: challengerImage },
        challenged_cat: { id: challengedCat.id, name: challengedCat.name, image_url: challengedImage },
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
