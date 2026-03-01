import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, bootstrapSession } from './_helpers.js';

const imagePath = __ENV.TEST_IMAGE_PATH || './loadtest/assets/test-cat.jpg';
const imageBytes = open(imagePath, 'b');

export const options = {
  scenarios: {
    submit_throttled: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.RATE || 2),
      timeUnit: '1s',
      duration: __ENV.DURATION || '3m',
      preAllocatedVUs: Number(__ENV.VUS || 20),
      maxVUs: Number(__ENV.MAX_VUS || 60),
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.12'],
    http_req_duration: ['p(95)<2500', 'p(99)<5000'],
  },
};

export default function () {
  bootstrapSession();

  const payload = {
    name: `loadcat_${Math.floor(Math.random() * 1e9)}`,
    image: http.file(imageBytes, 'test-cat.jpg', 'image/jpeg'),
    rarity: 'Common',
    attack: '35',
    defense: '35',
    speed: '35',
    charisma: '35',
    chaos: '35',
    power: 'Load Test',
    description: 'loadtest submission',
  };

  const res = http.post(`${BASE_URL}/api/cats/submit`, payload, {
    tags: { endpoint: '/api/cats/submit' },
  });
  check(res, {
    'submit expected status': (r) => [200, 400, 413, 415, 429].includes(r.status),
  });
  sleep(1 + Math.random());
}

