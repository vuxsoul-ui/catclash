# Launch Hardening Report (Meme Launch Prep)

Date: 2026-02-19

## Target traffic model

- 1k–5k users in first 24h
- Peak bursts: 50–150 RPS on vote/predict
- Read-heavy `GET /api/me` on page loads
- Submit/adopt spikes in first launch hours

## Hot endpoints and expected pressure

1. `GET /api/me` (highest sustained read)
2. `POST /api/vote` (burst write)
3. `POST /api/match/predict` (burst write + wallet updates)
4. `POST /api/cats/submit` (multipart + storage)
5. `POST /api/starter/adopt` (external image dependency)
6. `POST /api/crate/claim` (spam-prone write)
7. `GET /api/shop/catalog`, `GET /api/shop/featured` (moderate read)

## Hardening implemented

- Added server-side lightweight rate limiting (in-memory, per-instance) with `429` + `Retry-After`:
  - vote: 30/min/user, 120/min/IP
  - predict: 10/min/user, 60/min/IP
  - submit: 3/hour/user, 10/hour/IP
  - adopt: 6/hour/user, 30/hour/IP
  - crate claim: 20/min/user, 80/min/IP
  - comments: 12/min/user, 40/min/IP
- Added `/api/health` for liveness + DB connectivity check with timeout.
- Added timeout utility and applied to:
  - `/api/me` flame evaluation fallback path
  - `/api/cats/submit` storage upload path
- Added upload safety in submit:
  - max 5MB
  - strict mime allowlist (jpg/png/webp/gif)
  - early rejection with 413/415
- Added migration `029_hotpath_indexes.sql` for hot query paths.

## Likely bottlenecks

- First degrade likely on write-heavy endpoints:
  1) `/api/vote` and `/api/match/predict` under coordinated bursts
  2) `/api/cats/submit` due to storage upload latency
  3) `/api/me` if DB is slow (flame fallback now prevents long-tail stalls)

## Recommended launch limits (safe defaults)

- Keep the new limits in place for launch week.
- If false positives appear:
  - raise vote user limit from 30/min to 45/min
  - keep IP limits unchanged initially

## Notes

- Current limiter is per-instance memory (acceptable MVP protection).
- For strict global rate limiting at larger scale, move to Redis/Upstash.
- Economy constants (prediction multipliers, crate EV, payouts) were not changed.

