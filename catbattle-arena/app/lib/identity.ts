export type MeLike = {
  guest_id?: string | null;
  user?: { id?: string | null } | null;
  data?: {
    user?: { id?: string | null } | null;
    profile?: { id?: string | null; username?: string | null } | null;
  } | null;
} | null | undefined;

function cleanId(value: unknown): string {
  return String(value || '').trim();
}

export function resolveActorId(me: MeLike): string {
  const authed =
    cleanId(me?.data?.user?.id) ||
    cleanId(me?.user?.id) ||
    cleanId(me?.data?.profile?.id);
  if (authed) return authed;
  return cleanId(me?.guest_id);
}

export function resolveProfileUsername(me: MeLike): string {
  return String(me?.data?.profile?.username || '').trim();
}

let identityChecksRan = false;
export function runIdentityResolutionChecks(): void {
  if (identityChecksRan || process.env.NODE_ENV === 'production') return;
  identityChecksRan = true;
  console.assert(
    resolveActorId({ data: { user: { id: 'auth-id' } }, guest_id: 'guest-id' }) === 'auth-id',
    '[DEV_CHECK] resolveActorId should prefer authenticated id over guest id'
  );
  console.assert(
    resolveActorId({ guest_id: 'guest-id' }) === 'guest-id',
    '[DEV_CHECK] resolveActorId should fall back to guest id'
  );
}
