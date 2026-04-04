import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimitMany, getClientIpPrefix } from '../../_lib/rateLimit';
import { hashPassword, normalizeUsername, validatePassword } from '../../_lib/password';
import { hashSecret, normalizeRecoveryCode } from '../../_lib/password-reset';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token || '').trim();
    const identifier = String(body.identifier || '').trim();
    const recoveryCodeRaw = String(body.recovery_code || '').trim();
    const newPassword = String(body.new_password || '');

    const pwdCheck = validatePassword(newPassword);
    if (!pwdCheck.ok) {
      return NextResponse.json({ ok: false, error: pwdCheck.error || 'Invalid password' }, { status: 400 });
    }

    const ipPrefix = getClientIpPrefix(req) || 'unknown';
    const rl = checkRateLimitMany([
      { key: `rl:pw-reset:ip:${ipPrefix}`, limit: 20, windowMs: 60_000 },
      { key: `rl:pw-reset:id:${normalizeUsername(identifier || token.slice(0, 8))}`, limit: 8, windowMs: 60_000 },
    ]);
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, error: 'Too many attempts. Try again in a minute.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
      );
    }

    let userId: string | null = null;
    let recoveryCodeId: number | null = null;

    if (token) {
      const tokenHash = hashSecret(token);
      const { data: row } = await supabase
        .from('password_reset_tokens')
        .select('id, user_id, expires_at, consumed_at')
        .eq('token_hash', tokenHash)
        .maybeSingle();
      if (!row || row.consumed_at || new Date(row.expires_at).getTime() < Date.now()) {
        return NextResponse.json({ ok: false, error: 'Reset link is invalid or expired.' }, { status: 400 });
      }
      userId = String(row.user_id);
      await supabase
        .from('password_reset_tokens')
        .update({ consumed_at: new Date().toISOString() })
        .eq('id', row.id);
    } else if (identifier && recoveryCodeRaw) {
      let candidateUserId: string | null = null;
      if (identifier.includes('@')) {
        const { data: pref } = await supabase
          .from('notification_preferences')
          .select('user_id')
          .ilike('email', identifier)
          .maybeSingle();
        candidateUserId = pref?.user_id ? String(pref.user_id) : null;
      } else {
        const { data: cred } = await supabase
          .from('auth_credentials')
          .select('user_id')
          .eq('username_lower', normalizeUsername(identifier))
          .maybeSingle();
        candidateUserId = cred?.user_id ? String(cred.user_id) : null;
      }
      if (!candidateUserId) {
        return NextResponse.json({ ok: false, error: 'Recovery code is invalid.' }, { status: 400 });
      }
      const codeHash = hashSecret(normalizeRecoveryCode(recoveryCodeRaw));
      const { data: codeRow } = await supabase
        .from('password_recovery_codes')
        .select('id')
        .eq('user_id', candidateUserId)
        .eq('code_hash', codeHash)
        .is('used_at', null)
        .maybeSingle();
      if (!codeRow?.id) {
        return NextResponse.json({ ok: false, error: 'Recovery code is invalid.' }, { status: 400 });
      }
      userId = candidateUserId;
      recoveryCodeId = Number(codeRow.id);
    } else {
      return NextResponse.json({ ok: false, error: 'Provide a reset token or recovery code.' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Reset request invalid.' }, { status: 400 });
    }

    const nextPwd = await hashPassword(newPassword);
    const { error: credErr } = await supabase
      .from('auth_credentials')
      .update({
        password_hash: nextPwd.hash,
        password_salt: nextPwd.salt,
        password_algo: nextPwd.algo,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (credErr) {
      return NextResponse.json({ ok: false, error: credErr.message || 'Could not reset password.' }, { status: 500 });
    }

    await supabase
      .from('password_reset_tokens')
      .update({ consumed_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('consumed_at', null);

    if (recoveryCodeId) {
      await supabase
        .from('password_recovery_codes')
        .update({ used_at: new Date().toISOString() })
        .eq('id', recoveryCodeId);
    }

    return NextResponse.json({ ok: true, message: 'Password reset successful. You can now sign in.' });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}
