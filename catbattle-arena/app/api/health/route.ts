import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withTimeout } from '../_lib/timeout';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim();

export async function GET() {
  const started = Date.now();
  const basic = {
    ok: true,
    service: 'catclash-api',
    timestamp: new Date().toISOString(),
    uptimeSec: Math.floor(process.uptime()),
  };

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      {
        ...basic,
        ok: false,
        db: { ok: false, error: 'missing_supabase_env' },
        latencyMs: Date.now() - started,
      },
      { status: 500 }
    );
  }

  const sb = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Trivial DB ping with tight timeout.
    const ping = await withTimeout(
      sb.from('profiles').select('id').limit(1).maybeSingle(),
      1800,
      'health_db_ping'
    );
    if (ping.error) {
      return NextResponse.json(
        {
          ...basic,
          ok: false,
          db: { ok: false, error: ping.error.message },
          latencyMs: Date.now() - started,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ...basic,
      db: { ok: true },
      latencyMs: Date.now() - started,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ...basic,
        ok: false,
        db: { ok: false, error: String(e) },
        latencyMs: Date.now() - started,
      },
      { status: 503 }
    );
  }
}
