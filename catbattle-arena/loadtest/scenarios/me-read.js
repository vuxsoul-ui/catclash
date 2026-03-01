import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, bootstrapSession } from './_helpers.js';

export const options = {
  scenarios: {
    me_read_heavy: {
      executor: 'ramping-arrival-rate',
      startRate: Number(__ENV.RATE_START || 20),
      timeUnit: '1s',
      preAllocatedVUs: Number(__ENV.VUS || 80),
      maxVUs: Number(__ENV.MAX_VUS || 200),
      stages: [
        { target: Number(__ENV.RATE_PEAK || 120), duration: __ENV.RAMP_UP || '2m' },
        { target: Number(__ENV.RATE_PEAK || 120), duration: __ENV.HOLD || '4m' },
        { target: 0, duration: __ENV.RAMP_DOWN || '1m' },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<500', 'p(99)<1200'],
  },
};

export default function () {
  bootstrapSession();
  const res = http.get(`${BASE_URL}/api/me`, { tags: { endpoint: '/api/me' } });
  check(res, {
    '/api/me status 200': (r) => r.status === 200,
    '/api/me payload': (r) => !!r.json('data') || !!r.json('success'),
  });
  sleep(Math.random() * 0.4);
}

