import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const input = Array.isArray(body?.matchIds) ? body.matchIds : null;
    if (!input) {
      return NextResponse.json({ ok: false, error: 'invalid_match_ids' }, { status: 400 });
    }
    const matchIds = Array.from(
      new Set(
        input
          .map((id: unknown) => String(id || '').trim())
          .filter(Boolean)
      )
    ).slice(0, 10);
    if (matchIds.length === 0) {
      return NextResponse.json({ ok: true, data: [] }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabase
      .from('tournament_matches')
      .select('id, votes_a, votes_b')
      .in('id', matchIds);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rows = (data || []).map((row: any) => {
      const votesA = Math.max(0, Number(row?.votes_a || 0));
      const votesB = Math.max(0, Number(row?.votes_b || 0));
      return {
        match_id: String(row?.id || ''),
        votes_a: votesA,
        votes_b: votesB,
        total_votes: votesA + votesB,
      };
    });

    return NextResponse.json({ ok: true, data: rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

