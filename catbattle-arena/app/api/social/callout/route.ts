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

export async function POST(req: NextRequest) {
  try {
    if (!FEATURES.SOCIAL_LOOP_V2) {
      return NextResponse.json({ ok: false, error: 'Social loop disabled' }, { status: 404 });
    }

    const userId = await getGuestId();
    if (!userId) return NextResponse.json({ ok: false, error: 'No session' }, { status: 401 });
    const usernameCheck = await requireUsername(supabase, userId, 'create social callouts');
    if (!usernameCheck.ok) return usernameCheck.response;

    const body = await req.json().catch(() => ({}));
    const matchId = String(body?.match_id || '').trim();
    const pickedCatId = String(body?.picked_cat_id || '').trim();

    if (!matchId || !pickedCatId) {
      return NextResponse.json({ ok: false, error: 'Missing match_id or picked_cat_id' }, { status: 400 });
    }

    const { data: match } = await supabase
      .from('tournament_matches')
      .select('id, cat_a_id, cat_b_id')
      .eq('id', matchId)
      .maybeSingle();
    if (!match) return NextResponse.json({ ok: false, error: 'Match not found' }, { status: 404 });
    if (pickedCatId !== match.cat_a_id && pickedCatId !== match.cat_b_id) {
      return NextResponse.json({ ok: false, error: 'Picked cat is not in this match' }, { status: 400 });
    }

    const { data: cat } = await supabase
      .from('cats')
      .select('id, name')
      .eq('id', pickedCatId)
      .maybeSingle();

    const catName = String(cat?.name || 'this cat');
    const shareText = `I called ${catName} in CatBattle Arena. Prove me wrong.`;
    const shareImageUrl = `/api/share/cat-card?cat_id=${encodeURIComponent(pickedCatId)}&ref=${encodeURIComponent(userId)}`;

    const { error: insErr } = await supabase
      .from('social_callouts')
      .insert({
        user_id: userId,
        match_id: matchId,
        picked_cat_id: pickedCatId,
        share_text: shareText,
      });
    if (insErr) {
      const msg = String(insErr.message || '').toLowerCase();
      if (!msg.includes('social_callouts')) {
        return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      share_text: shareText,
      image_url: shareImageUrl,
      match_id: matchId,
      picked_cat_id: pickedCatId,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
