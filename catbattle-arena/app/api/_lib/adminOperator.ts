import { createServerSupabaseClient } from './server-supabase';
import { getGuestId } from './guest';

function normalize(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

export async function getAdminOperatorIdentity(): Promise<{
  guestId: string | null;
  email: string | null;
  isAdmin: boolean;
  identityType: 'user_id' | 'email' | 'none';
  identitySource: 'getGuestId';
}> {
  const adminUserId = String(process.env.ADMIN_USER_ID || '').trim();
  const adminEmail = normalize(process.env.ADMIN_USER_EMAIL || '');

  let guestId: string | null = null;
  try {
    // Keep identity resolution aligned with /api/me.
    guestId = await getGuestId();
  } catch {
    console.warn('[DEV][admin-operator-identity][guest-id-failure]', {
      identitySource: 'getGuestId',
      reason: 'threw',
    });
    const result = {
      guestId: null,
      email: null,
      isAdmin: false,
      identityType: 'none' as const,
      identitySource: 'getGuestId' as const,
    };
    console.debug('[DEV][admin-operator-identity]', {
      resolvedId: result.guestId,
      resolvedEmail: result.email,
      identitySource: result.identitySource,
      envAdminUserId: adminUserId,
      envAdminUserEmail: process.env.ADMIN_USER_EMAIL || '',
      isAdmin: result.isAdmin,
      identityType: result.identityType,
    });
    return result;
  }
  if (!guestId) {
    console.warn('[DEV][admin-operator-identity][guest-id-failure]', {
      identitySource: 'getGuestId',
      reason: 'empty',
    });
  }

  if (adminUserId && guestId === adminUserId) {
    const result = { guestId, email: null, isAdmin: true, identityType: 'user_id' as const, identitySource: 'getGuestId' as const };
    console.debug('[DEV][admin-operator-identity]', {
      resolvedId: result.guestId,
      resolvedEmail: result.email,
      identitySource: result.identitySource,
      envAdminUserId: adminUserId,
      envAdminUserEmail: process.env.ADMIN_USER_EMAIL || '',
      isAdmin: result.isAdmin,
      identityType: result.identityType,
    });
    return result;
  }

  if (!adminEmail) {
    const result = { guestId, email: null, isAdmin: false, identityType: 'none' as const, identitySource: 'getGuestId' as const };
    console.debug('[DEV][admin-operator-identity]', {
      resolvedId: result.guestId,
      resolvedEmail: result.email,
      identitySource: result.identitySource,
      envAdminUserId: adminUserId,
      envAdminUserEmail: process.env.ADMIN_USER_EMAIL || '',
      isAdmin: result.isAdmin,
      identityType: result.identityType,
    });
    return result;
  }

  try {
    const supabase = createServerSupabaseClient();
    const { data } = await supabase
      .from('notification_preferences')
      .select('email')
      .eq('user_id', guestId)
      .maybeSingle();
    const email = normalize(data?.email || '');
    const emailMatch = !!email && email === adminEmail;
    const identityType: 'email' | 'none' = emailMatch ? 'email' : 'none';
    const result = {
      guestId,
      email: email || null,
      isAdmin: emailMatch,
      identityType,
      identitySource: 'getGuestId' as const,
    };
    console.debug('[DEV][admin-operator-identity]', {
      resolvedId: result.guestId,
      resolvedEmail: result.email,
      identitySource: result.identitySource,
      envAdminUserId: adminUserId,
      envAdminUserEmail: process.env.ADMIN_USER_EMAIL || '',
      isAdmin: result.isAdmin,
      identityType: result.identityType,
    });
    return result;
  } catch {
    const result = { guestId, email: null, isAdmin: false, identityType: 'none' as const, identitySource: 'getGuestId' as const };
    console.debug('[DEV][admin-operator-identity]', {
      resolvedId: result.guestId,
      resolvedEmail: result.email,
      identitySource: result.identitySource,
      envAdminUserId: adminUserId,
      envAdminUserEmail: process.env.ADMIN_USER_EMAIL || '',
      isAdmin: result.isAdmin,
      identityType: result.identityType,
    });
    return result;
  }
}
