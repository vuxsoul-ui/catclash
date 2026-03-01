# CatClash Launch Deployment Checklist

## 1) Pre-deploy

- Confirm branch is green (`npm run build`).
- Confirm Supabase project target (staging vs production).
- Verify required env vars:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_SITE_URL` (recommended)
  - `THECATAPI_API_KEY` (recommended for adopt flow)

## 2) Database migrations

- Apply all pending migrations in order:
  - includes `028_arena_flame.sql`
  - includes `029_hotpath_indexes.sql`
- Verify schema drift is zero in Supabase SQL editor.

## 3) Build + boot

- `npm ci`
- `npm run build`
- `npm run start` (or deploy via Vercel)

## 4) Fast smoke checks

- `GET /api/health` returns `ok: true` and `db.ok: true`.
- `GET /api/me` returns quickly (<500ms baseline, <1.2s p95 under light load).
- `POST /api/checkin` returns `deprecated: true`.
- Voting/prediction endpoints return expected statuses (`200/409/429` patterns).

## 5) Upload safety checks

- Submit accepts valid image types only (`jpg/png/webp/gif`).
- >5MB image is rejected with `413`.
- Invalid mime rejected with `415`.

## 6) Rate-limit checks

- Trigger burst on:
  - `/api/vote`
  - `/api/match/predict`
  - `/api/cats/submit`
  - `/api/crate/claim`
  - `/api/tournament/comments`
- Confirm `429` and `Retry-After` header are returned.

## 7) Launch content/data checks

- Verify at least one active tournament exists.
- Verify approved cats exist for public feeds.
- Verify starter adoption still returns images.
- Verify shop catalog + featured are reachable.

## 8) Load test pass (staging)

- Run k6 scripts in `/loadtest`.
- Record p50/p95/p99 and error rates.
- Identify first degrading endpoint and keep headroom.

## 9) Rollback plan

- Roll back app deploy to previous known-good version.
- Keep DB additive migrations (no destructive rollback needed).
- If emergency:
  - disable traffic-heavy features temporarily (UI gates)
  - keep `/api/health` and `/api/me` available
  - re-run smoke tests after rollback.

