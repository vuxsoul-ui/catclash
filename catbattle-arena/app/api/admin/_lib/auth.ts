import { NextRequest } from 'next/server';
import { isAdminAuthorized } from '../../_lib/adminAuth';

export function isAdmin(request: NextRequest): boolean {
  return isAdminAuthorized(request);
}
