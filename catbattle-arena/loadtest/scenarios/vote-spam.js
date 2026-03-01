import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, bootstrapSession, getActiveMatch } from './_helpers.js';

export const options = {
  scenarios: {
    vote_burst: {
      executor: 'ramping-arrival-rate',
      startRate: Number(__ENV.RATE_START || 10),
      timeUnit: '1s',
      preAllocatedVUs: Number(__ENV.VUS || 120),
      maxVUs: Number(__ENV.MAX_VUS || 300),
      stages: [
        { target: Number(__ENV.RATE_PEAK || 80), duration: __ENV.RAMP_UP || '2m' },
        { target: Number(__ENV.RATE_PEAK || 80), duration: __ENV.HOLD || '5m' },
        { target: 0, duration: __ENV.RAMP_DOWN || '1m' },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<700', 'p(99)<1500'],
  },
};

export default function () {
  bootstrapSession();
  const m = getActiveMatch();
  if (!m) {
    sleep(1);
    return;
  }
  const target = Math.random() > 0.5 ? m.cat_a.id : m.cat_b.id;
  const res = http.post(
    `${BASE_URL}/api/vote`,
    JSON.stringify({ match_id: m.match_id || m.id, voted_for: target }),
    { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: '/api/vote' } }
  );
  check(res, {
    '/api/vote status ok/known-conflict': (r) => [200, 409, 429].includes(r.status),
  });
  sleep(Math.random() * 0.3);
}

