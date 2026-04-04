import { NextResponse } from 'next/server';
import { getAdminOperatorIdentity } from '../../../_lib/adminOperator';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
  const identity = await getAdminOperatorIdentity();
  const adminUserId = String(process.env.ADMIN_USER_ID || '');
  const adminUserEmail = String(process.env.ADMIN_USER_EMAIL || '');
  const maskedEmail = adminUserEmail
    ? adminUserEmail.replace(/(^.).*(@.*$)/, '$1***$2')
    : '';
  console.debug('[DEV][admin-operator-status]', {
    resolvedId: identity.guestId,
    resolvedEmail: identity.email,
    identitySource: identity.identitySource,
    envAdminUserId: adminUserId,
    envAdminUserEmail: adminUserEmail,
    isAdmin: identity.isAdmin,
    identityType: identity.identityType,
  });
  const payload: Record<string, unknown> = {
    ok: true,
    isAdmin: identity.isAdmin,
    identityType: identity.identityType,
  };
  if (process.env.NODE_ENV !== 'production') {
    payload.debug = {
      resolvedId: identity.guestId || null,
      resolvedEmail: identity.email || null,
      identityType: identity.identityType,
      identitySource: identity.identitySource,
      hasAdminUserIdEnv: adminUserId.length > 0,
      hasAdminUserEmailEnv: adminUserEmail.length > 0,
      adminUserIdPreview: adminUserId ? adminUserId.slice(0, 8) : null,
      adminUserEmailPreview: maskedEmail || null,
      isAdmin: identity.isAdmin,
    };
  }
  return NextResponse.json(payload);
}
