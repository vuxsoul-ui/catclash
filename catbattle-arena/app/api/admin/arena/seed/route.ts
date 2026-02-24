import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '../../_lib/auth';
import { clampSeedCount, runAdminArenaSeed, TournamentTypeInput } from '../../_lib/arenaSeed';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const LOCK_KEY = 'admin_seed_arena_matches_lock';
const LOCK_STALE_MS = 45_000;

const supabase = createClient(
  String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\s/g, '').trim(),
  String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function acquireSeedLock() {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - LOCK_STALE_MS).toISOString();
  const nowIso = now.toISOString();

  const insertTry = await supabase.from('rate_limits').insert({
    key: LOCK_KEY,
    count: 1,
    window_start: nowIso,
    updated_at: nowIso,
  });
  if (!insertTry.error) return { ok: true as const };

  const conflict = String(insertTry.error.code || '') === '23505';
  if (!conflict) return { ok: false as const, error: insertTry.error.message, status: 500 };

  const takeover = await supabase
    .from('rate_limits')
    .update({ count: 1, window_start: nowIso, updated_at: nowIso })
    .eq('key', LOCK_KEY)
    .lt('updated_at', staleBefore)
    .select('key')
    .maybeSingle();

  if (!takeover.error && takeover.data?.key) return { ok: true as const };
  return { ok: false as const, error: 'Seed in progress', status: 409 };
}

async function releaseSeedLock() {
  await supabase.from('rate_limits').delete().eq('key', LOCK_KEY);
}

export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const lock = await acquireSeedLock();
  if (!lock.ok) {
    return NextResponse.json({ ok: false, error: lock.error }, { status: lock.status || 500 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const tournamentType = String(body?.tournamentType || 'both') as TournamentTypeInput;
    const seedCount = clampSeedCount(body?.seedCount);
    const prioritizeNew = body?.prioritizeNew !== false;

    if (!['rookie', 'main', 'both'].includes(tournamentType)) {
      return NextResponse.json({ ok: false, error: 'Invalid tournamentType' }, { status: 400 });
    }

    const seeded = await runAdminArenaSeed({
      tournamentType,
      seedCount,
      prioritizeNew,
    });
    console.info(`[ADMIN_SEED] inserted ${seeded.rookieInserted} into rookie tournament ${seeded.rookieTournamentId || 'n/a'}, ${seeded.mainInserted} into main tournament ${seeded.mainTournamentId || 'n/a'}`);
    return NextResponse.json({ ok: true, ...seeded });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  } finally {
    await releaseSeedLock();
  }
}
