import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '../../_lib/adminAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim();

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!('ok' in auth)) return auth;

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabase.rpc('verify_cat_stats');
    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    const mismatches = rows.filter((row: any) => String(row.status || '').toLowerCase().includes('mismatch'));

    return NextResponse.json({
      ok: true,
      total_cats: rows.length,
      verified_cats: rows.length - mismatches.length,
      mismatches: mismatches.length,
      details: mismatches.length > 0 ? mismatches : 'All stats verified',
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Verification failed' },
      { status: 500 }
    );
  }
}
