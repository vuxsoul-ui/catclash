import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimitMany, getClientIpPrefix } from '../../_lib/rateLimit';
import { normalizeUsername } from '../../_lib/password';
import { generateResetToken, hashSecret } from '../../_lib/password-reset';
import { sendPasswordResetEmail } from '../../_lib/notifications';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\\n/g, '').replace(/\s/g, '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/\\n/g, '').trim(),
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const GENERIC_OK_MESSAGE =
  'If an account with recovery options exists, reset instructions have been sent.';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const identifier = String(body.identifier || '').trim();
    if (!identifier) {
      return NextResponse.json({ ok: true, message: GENERIC_OK_MESSAGE });
    }

    const ipPrefix = getClientIpPrefix(req) || 'unknown';
    const rl = checkRateLimitMany([
      { key: `rl:pw-forgot:ip:${ipPrefix}`, limit: 15, windowMs: 60_000 },
      { key: `rl:pw-forgot:id:${normalizeUsername(identifier)}`, limit: 5, windowMs: 60_000 },
    ]);
    if (!rl.allowed) {
      return NextResponse.json({ ok: true, message: GENERIC_OK_MESSAGE }, { status: 200 });
    }

    let userId: string | null = null;
    let username: string | null = null;
    let recoveryEmail: string | null = null;
    let hasRecoveryEmail = false;

    if (identifier.includes('@')) {
      const { data: pref } = await supabase
        .from('notification_preferences')
        .select('user_id, email')
        .ilike('email', identifier)
        .maybeSingle();
      if (pref?.user_id) {
        userId = String(pref.user_id);
        recoveryEmail = String(pref.email || '').trim().toLowerCase() || null;
        hasRecoveryEmail = !!recoveryEmail;
      }
    } else {
      const usernameLower = normalizeUsername(identifier);
      const { data: cred } = await supabase
        .from('auth_credentials')
        .select('user_id')
        .eq('username_lower', usernameLower)
        .maybeSingle();
      if (cred?.user_id) {
        userId = String(cred.user_id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', userId)
          .maybeSingle();
        username = String(profile?.username || '').trim() || null;
        const { data: pref } = await supabase
          .from('notification_preferences')
          .select('email')
          .eq('user_id', userId)
          .maybeSingle();
        recoveryEmail = String(pref?.email || '').trim().toLowerCase() || null;
        hasRecoveryEmail = !!recoveryEmail;
      }
    }

    let debugResetToken: string | null = null;
    let debugResetUrl: string | null = null;
    let emailDispatchOk: boolean | null = null;
    if (userId && hasRecoveryEmail) {
      const token = generateResetToken();
      const tokenHash = hashSecret(token);
      const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();

      await supabase
        .from('password_reset_tokens')
        .delete()
        .eq('user_id', userId)
        .is('consumed_at', null);

      await supabase.from('password_reset_tokens').insert({
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expiresAt,
        requested_ip_hash: hashSecret(ipPrefix),
      });

      const siteUrl = String(process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin || '').replace(/\/+$/, '');
      const resetUrl = `${siteUrl}/reset-password?token=${encodeURIComponent(token)}`;
      if (recoveryEmail) {
        const sendResult = await sendPasswordResetEmail({
          to: recoveryEmail,
          username,
          resetUrl,
          expiresMinutes: 30,
        });
        emailDispatchOk = !!sendResult.ok && !sendResult.skipped;
        if (!sendResult.ok) {
          console.error('[forgot-password] reset email send failed', {
            userId,
            error: sendResult.error || 'unknown_send_error',
          });
        } else if (sendResult.skipped) {
          console.warn('[forgot-password] reset email skipped (missing resend config)');
        }
      }

      if (process.env.NODE_ENV !== 'production') {
        debugResetToken = token;
        debugResetUrl = `${siteUrl}/reset-password?token=${encodeURIComponent(token)}`;
      }
    }

    return NextResponse.json({
      ok: true,
      message: GENERIC_OK_MESSAGE,
      ...(debugResetToken ? { debug_reset_token: debugResetToken, debug_reset_url: debugResetUrl, debug_email_sent: emailDispatchOk } : {}),
    });
  } catch {
    return NextResponse.json({ ok: true, message: GENERIC_OK_MESSAGE });
  }
}
