import { NextRequest } from 'next/server';
import { requireGuestId } from './guest';
import { getClientIpPrefix, hashValue } from './rateLimit';

export type VoterIdentity = {
  voterUserId: string;
  ipHash: string | null;
};

export async function resolveVoterIdentity(req: NextRequest): Promise<VoterIdentity> {
  const voterUserId = await requireGuestId();
  const ipHash = hashValue(getClientIpPrefix(req));
  return { voterUserId, ipHash };
}
