// REPLACE: app/api/admin/tournament/resolve-round/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin-secret-change-me';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('x-admin-secret');
    const { searchParams } = new URL(request.url);
    const cronSecret = searchParams.get('cron_secret');

    if (authHeader !== ADMIN_SECRET && cronSecret !== ADMIN_SECRET) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get optional tournament_id from body, otherwise resolve all active
    const body = await request.json().catch(() => ({}));
    const tournamentId = body.tournament_id;

    if (tournamentId) {
      // Resolve specific tournament
      const { data, error } = await supabase.rpc('resolve_tournament_round', {
        p_tournament_id: tournamentId,
      });

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, result: data });
    }

    // Resolve all active tournaments via daily tick
    const { data, error } = await supabase.rpc('daily_tournament_tick');

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, result: data });
  } catch (e) {
    console.error('[RESOLVE] Exception:', e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
