import type { SupabaseClient } from '@supabase/supabase-js';

export type ApprovalNotificationPref = {
  email: string | null;
  cat_photo_approved_enabled: boolean;
};

export async function getApprovalNotificationPreference(
  supabase: SupabaseClient,
  userId: string
): Promise<ApprovalNotificationPref | null> {
  const { data } = await supabase
    .from('notification_preferences')
    .select('email, cat_photo_approved_enabled')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) return null;
  return {
    email: data.email || null,
    cat_photo_approved_enabled: !!data.cat_photo_approved_enabled,
  };
}

export async function sendCatPhotoApprovedEmail(args: {
  to: string;
  username?: string | null;
  catName: string;
  catId: string;
  siteUrl?: string | null;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || process.env.NOTIFY_FROM_EMAIL;
  if (!apiKey || !from) {
    return { ok: true, skipped: true };
  }

  const linkBase = (args.siteUrl || process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '');
  const catLink = linkBase ? `${linkBase}/c/${args.catId}` : '';
  const greeting = args.username ? `Hi ${args.username},` : 'Hi,';
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <p>${greeting}</p>
      <p>Your cat photo for <strong>${escapeHtml(args.catName)}</strong> has been approved.</p>
      ${catLink ? `<p><a href="${catLink}">View your cat profile</a></p>` : ''}
      <p>- CatBattle Arena</p>
    </div>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: `${args.catName} is approved on CatClash`,
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, error: body || `resend_error_${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function sendPasswordResetEmail(args: {
  to: string;
  username?: string | null;
  resetUrl: string;
  expiresMinutes: number;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || process.env.NOTIFY_FROM_EMAIL;
  if (!apiKey || !from) {
    return { ok: true, skipped: true };
  }

  const greeting = args.username ? `Hi ${args.username},` : 'Hi,';
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <p>${greeting}</p>
      <p>We received a request to reset your CatClash password.</p>
      <p><a href="${args.resetUrl}">Reset your password</a></p>
      <p>This link expires in ${Math.max(1, Number(args.expiresMinutes || 30))} minutes.</p>
      <p>If you did not request this, you can ignore this email.</p>
      <p>- CatClash</p>
    </div>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: 'Reset your CatClash password',
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, error: body || `resend_error_${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
