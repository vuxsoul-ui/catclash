import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeUsername, verifyPassword } from '../../_lib/password';
import { setGuestCookie } from '../../_lib/guestAuth';
import { applyFeatureTesterBoost, isFeatureTesterId } from '../../_lib/tester';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    if (!username || !password) {
      return NextResponse.json({ ok: false, error: 'Username and password are required' }, { status: 400 });
    }

    const usernameLower = normalizeUsername(username);
    const { data: cred, error } = await supabase
      .from('auth_credentials')
      .select('user_id, password_hash, password_salt')
      .eq('username_lower', usernameLower)
      .maybeSingle();

    if (error || !cred?.user_id) {
      return NextResponse.json({ ok: false, error: 'Invalid username or password' }, { status: 401 });
    }

    const ok = await verifyPassword(password, String(cred.password_hash || ''), String(cred.password_salt || ''));
    if (!ok) {
      return NextResponse.json({ ok: false, error: 'Invalid username or password' }, { status: 401 });
    }

    await supabase
      .from('auth_credentials')
      .update({ last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('user_id', cred.user_id);

    const testerMode = isFeatureTesterId(String(cred.user_id));
    if (testerMode) {
      await applyFeatureTesterBoost(supabase as any, String(cred.user_id));
    }

    const response = NextResponse.json({ ok: true, user_id: cred.user_id, tester_mode: testerMode });
    setGuestCookie(response, String(cred.user_id));
    return response;
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
