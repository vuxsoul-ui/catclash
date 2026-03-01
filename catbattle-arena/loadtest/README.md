# Load Testing (k6)

This folder contains launch-readiness load tests for CatClash API hot paths.

## Prereqs

1. Install k6: <https://k6.io/docs/get-started/installation/>
2. Use a staging deployment URL.
3. Set `BASE_URL` to staging.

## Session/Auth Strategy

- The scripts call `GET /api/me` first.
- CatClash guest identity cookie is issued server-side and reused by k6 cookie jar.
- No auth token changes are required for guest-mode traffic simulation.

## Scenarios

- `scenarios/me-read.js`: read-heavy `/api/me`.
- `scenarios/vote-spam.js`: burst voting.
- `scenarios/predict.js`: prediction lock traffic.
- `scenarios/mixed-browse.js`: homepage/arena/shop/leaderboard mix.
- `scenarios/submit-cat.js`: throttled multipart image submissions.

## Run

```bash
BASE_URL="https://your-staging.example.com" k6 run loadtest/scenarios/me-read.js
BASE_URL="https://your-staging.example.com" k6 run loadtest/scenarios/vote-spam.js
BASE_URL="https://your-staging.example.com" k6 run loadtest/scenarios/predict.js
BASE_URL="https://your-staging.example.com" k6 run loadtest/scenarios/mixed-browse.js
BASE_URL="https://your-staging.example.com" TEST_IMAGE_PATH="./loadtest/assets/test-cat.jpg" k6 run loadtest/scenarios/submit-cat.js
```

## Suggested Peak Inputs (launch spike model)

- `/api/me`: `RATE_PEAK=120`
- `/api/vote`: `RATE_PEAK=80`
- `/api/match/predict`: `RATE_PEAK=50`
- Mixed browse: `VUS_PEAK=120`
- Submit: `RATE=2-5` (multipart is intentionally throttled)

## What to capture

- Achieved RPS
- `http_req_duration` p50/p95/p99
- `http_req_failed` rate
- 429/5xx ratios
- First endpoint to degrade under load

Tip: export JSON output for later comparison:

```bash
BASE_URL="https://your-staging.example.com" k6 run --summary-export=loadtest/results-me.json loadtest/scenarios/me-read.js
```

