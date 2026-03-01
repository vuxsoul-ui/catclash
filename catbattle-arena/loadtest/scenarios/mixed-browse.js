import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, bootstrapSession } from './_helpers.js';

export const options = {
  scenarios: {
    mixed_browse: {
      executor: 'ramping-vus',
      startVUs: Number(__ENV.VUS_START || 10),
      stages: [
        { duration: __ENV.RAMP_UP || '2m', target: Number(__ENV.VUS_PEAK || 120) },
        { duration: __ENV.HOLD || '5m', target: Number(__ENV.VUS_PEAK || 120) },
        { duration: __ENV.RAMP_DOWN || '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.03'],
    http_req_duration: ['p(95)<900', 'p(99)<2000'],
  },
};

export default function () {
  bootstrapSession();

  const reqs = [
    ['GET', `${BASE_URL}/api/me`],
    ['GET', `${BASE_URL}/api/tournament/active`],
    ['GET', `${BASE_URL}/api/shop/catalog`],
    ['GET', `${BASE_URL}/api/shop/featured`],
    ['GET', `${BASE_URL}/api/leaderboard`],
  ];
  const pick = reqs[Math.floor(Math.random() * reqs.length)];
  const res = http.request(pick[0], pick[1], null, { tags: { endpoint: pick[1].replace(BASE_URL, '') } });
  check(res, { 'browse status < 500': (r) => r.status < 500 });
  sleep(Math.random() * 1.2);
}

