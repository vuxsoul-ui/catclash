import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireGuestId } from '../../_lib/guest';
import { allocatePendingCatXp } from '../../_lib/cat-progression';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const sb = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    let userId = '';
    try {
      userId = await requireGuestId();
    } catch {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const catId = String(body?.cat_id || '').trim();
    const amountRaw = body?.amount;
    const amount = amountRaw == null ? undefined : Number(amountRaw);

    if (!catId) {
      return NextResponse.json({ ok: false, error: 'Missing cat_id' }, { status: 400 });
    }
    if (amount != null && (!Number.isFinite(amount) || amount < 0)) {
      return NextResponse.json({ ok: false, error: 'Invalid amount' }, { status: 400 });
    }

    const result = await allocatePendingCatXp(sb, userId, catId, amount);
    if (Number(result?.applied_xp || 0) > 0) {
      await sb
        .from('user_reward_claims')
        .insert({ user_id: userId, reward_key: 'getting_started_cat_xp_applied_v2', reward_sigils: 0 });
    }
    return NextResponse.json({
      ok: true,
      ...result,
      cat_id: catId,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
