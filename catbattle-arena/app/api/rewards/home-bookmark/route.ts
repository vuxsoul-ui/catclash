import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireGuestId } from '../../_lib/guest';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const sb = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const CLAIM_KEY = 'starter_home_bookmark_v1';
const REWARD_SIGILS = 50;

export async function POST() {
  try {
    let userId = '';
    try {
      userId = await requireGuestId();
    } catch {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    await sb.rpc('bootstrap_user', { p_user_id: userId });

    const { data: existing } = await sb
      .from('user_reward_claims')
      .select('reward_key')
      .eq('user_id', userId)
      .eq('reward_key', CLAIM_KEY)
      .maybeSingle();

    if (existing?.reward_key) {
      return NextResponse.json({ ok: true, already_claimed: true, sigils_awarded: 0 });
    }

    const ins = await sb
      .from('user_reward_claims')
      .insert({ user_id: userId, reward_key: CLAIM_KEY, reward_sigils: REWARD_SIGILS });
    if (ins.error) {
      if (String(ins.error.code || '') === '23505') {
        return NextResponse.json({ ok: true, already_claimed: true, sigils_awarded: 0 });
      }
      return NextResponse.json({ ok: false, error: ins.error.message }, { status: 500 });
    }

    const { data: progress } = await sb
      .from('user_progress')
      .select('sigils')
      .eq('user_id', userId)
      .maybeSingle();
    const nextSigils = Number(progress?.sigils || 0) + REWARD_SIGILS;
    await sb.from('user_progress').update({ sigils: nextSigils }).eq('user_id', userId);

    return NextResponse.json({ ok: true, already_claimed: false, sigils_awarded: REWARD_SIGILS, sigils_after: nextSigils });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
