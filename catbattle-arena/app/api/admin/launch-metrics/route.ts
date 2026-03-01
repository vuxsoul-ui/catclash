import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '../../_lib/adminAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

type TelemetryRow = {
  event_name: string;
  user_id: string | null;
  created_at: string;
};

export async function GET(request: NextRequest) {
  const adminCheck = requireAdmin(request);
  if (adminCheck instanceof NextResponse) {
    return adminCheck;
  }

  try {
    const start = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('app_telemetry')
      .select('event_name,user_id,created_at')
      .gte('created_at', start)
      .order('created_at', { ascending: false })
      .limit(25000);

    if (error) {
      const msg = String(error.message || '').toLowerCase();
      if (msg.includes('app_telemetry') || msg.includes('schema cache')) {
        return NextResponse.json({
          ok: true,
          disabled: true,
          reason: 'app_telemetry_missing',
          window_hours: 72,
          totals: {},
          uniques: {},
          kpis: {
            visitor_to_vote_pct: 0,
            voter_to_signup_pct: 0,
            signup_to_3votes_pct: 0,
            signup_to_prediction_pct: 0,
            signup_to_referral_share_pct: 0,
          },
          thresholds: {
            visitor_to_vote_pct_target: 30,
            voter_to_signup_pct_target: 15,
            signup_to_3votes_pct_target: 40,
            signup_to_prediction_pct_target: 12,
            signup_to_referral_share_pct_target: 8,
          },
          raw_counts: {
            landing: 0,
            vote: 0,
            signup: 0,
            prediction: 0,
            referral_share: 0,
          },
        });
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    const rows = (data || []) as TelemetryRow[];
    const byEvent: Record<string, number> = {};
    const usersByEvent: Record<string, Set<string>> = {};

    for (const row of rows) {
      const ev = String(row.event_name || '').trim();
      if (!ev) continue;
      byEvent[ev] = (byEvent[ev] || 0) + 1;
      if (!usersByEvent[ev]) usersByEvent[ev] = new Set<string>();
      if (row.user_id) usersByEvent[ev].add(String(row.user_id));
    }

    const unique = (event: string) => usersByEvent[event]?.size || 0;
    const total = (event: string) => byEvent[event] || 0;

    const uniqueLanding = unique('landing_view');
    const uniqueVoted = unique('vote_cast') + unique('guest_vote_cast');
    const uniqueSignedUp = unique('signup_complete');
    const unique3Vote = rows
      .filter((r) => r.event_name === 'vote_streak_hit')
      .reduce((set, r) => (r.user_id ? set.add(String(r.user_id)) : set), new Set<string>()).size;
    const uniquePred = unique('prediction_placed');
    const uniqueShared = unique('recruit_shared');

    const pct = (num: number, den: number) => den > 0 ? Math.round((num / den) * 1000) / 10 : 0;

    return NextResponse.json({
      ok: true,
      window_hours: 72,
      totals: byEvent,
      uniques: Object.fromEntries(
        Object.entries(usersByEvent).map(([k, v]) => [k, v.size])
      ),
      kpis: {
        visitor_to_vote_pct: pct(uniqueVoted, uniqueLanding),
        voter_to_signup_pct: pct(uniqueSignedUp, uniqueVoted),
        signup_to_3votes_pct: pct(unique3Vote, uniqueSignedUp),
        signup_to_prediction_pct: pct(uniquePred, uniqueSignedUp),
        signup_to_referral_share_pct: pct(uniqueShared, uniqueSignedUp),
      },
      thresholds: {
        visitor_to_vote_pct_target: 30,
        voter_to_signup_pct_target: 15,
        signup_to_3votes_pct_target: 40,
        signup_to_prediction_pct_target: 12,
        signup_to_referral_share_pct_target: 8,
      },
      raw_counts: {
        landing: total('landing_view'),
        vote: total('vote_cast') + total('guest_vote_cast'),
        signup: total('signup_complete'),
        prediction: total('prediction_placed'),
        referral_share: total('recruit_shared'),
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
