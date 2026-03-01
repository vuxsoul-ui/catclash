import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, bootstrapSession, getActiveMatch } from './_helpers.js';

export const options = {
  scenarios: {
    predict_flow: {
      executor: 'ramping-arrival-rate',
      startRate: Number(__ENV.RATE_START || 6),
      timeUnit: '1s',
      preAllocatedVUs: Number(__ENV.VUS || 100),
      maxVUs: Number(__ENV.MAX_VUS || 250),
      stages: [
        { target: Number(__ENV.RATE_PEAK || 50), duration: __ENV.RAMP_UP || '2m' },
        { target: Number(__ENV.RATE_PEAK || 50), duration: __ENV.HOLD || '4m' },
        { target: 0, duration: __ENV.RAMP_DOWN || '1m' },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.06'],
    http_req_duration: ['p(95)<900', 'p(99)<1800'],
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
  const bet = [5, 10, 15, 20][Math.floor(Math.random() * 4)];
  const res = http.post(
    `${BASE_URL}/api/match/predict`,
    JSON.stringify({ match_id: m.match_id || m.id, predicted_cat_id: target, bet }),
    { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: '/api/match/predict' } }
  );
  check(res, {
    '/api/match/predict status expected': (r) => [200, 400, 409, 429].includes(r.status),
  });
  sleep(Math.random() * 0.5);
}

