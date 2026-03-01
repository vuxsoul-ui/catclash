import http from 'k6/http';
import { check } from 'k6';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export function bootstrapSession() {
  const res = http.get(`${BASE_URL}/api/me`, { tags: { endpoint: '/api/me' } });
  check(res, { 'bootstrap /api/me status < 500': (r) => r.status < 500 });
  return res;
}

export function getActiveMatch() {
  const res = http.get(`${BASE_URL}/api/tournament/active`, { tags: { endpoint: '/api/tournament/active' } });
  if (res.status >= 400) return null;
  const body = res.json();
  const rounds = body?.arenas?.[0]?.rounds || body?.data?.arenas?.[0]?.rounds || body?.rounds || [];
  for (const r of rounds) {
    const m = (r?.matches || []).find((x) => x?.status === 'active' && x?.cat_a?.id && x?.cat_b?.id);
    if (m) return m;
  }
  return null;
}

