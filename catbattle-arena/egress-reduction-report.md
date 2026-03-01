# Egress Reduction Report

## What Changed

- Added derivative image pipeline with stable public paths and cache headers.
  - New helper: `/Users/charon/go/catbattle-arena/app/api/_lib/cat-image-storage.ts`
  - Generates and uploads:
    - `cats/{cat_id}/thumb.webp` (`public, max-age=31536000, immutable`)
    - `cats/{cat_id}/card.webp` (`public, max-age=31536000, immutable`)
    - `cats/{cat_id}/original.<ext>` (`public, max-age=604800`)
- Updated ingest flows to store derivative URLs.
  - `/Users/charon/go/catbattle-arena/app/api/cats/submit/route.ts`
  - `/Users/charon/go/catbattle-arena/app/api/starter/adopt/route.ts`
  - `/Users/charon/go/catbattle-arena/app/api/crate/claim/route.ts`
- Added optional DB fields for derivative URLs.
  - Migration: `/Users/charon/go/catbattle-arena/supabase/migrations/038_cat_image_derivatives.sql`
  - Columns: `image_url_original`, `image_url_card`, `image_url_thumb`
- Removed signed URL usage for `cat-images` resolution.
  - Updated `/Users/charon/go/catbattle-arena/app/api/_lib/images.ts`
  - Uses stable public URL construction for Supabase storage paths.
- Switched home polling to status/version gating.
  - New endpoint: `/Users/charon/go/catbattle-arena/app/api/home/status/route.ts`
  - Home polling now targets status every ~12s visible / 60s hidden, burst ~6s for 20s after vote/predict.
  - Updated `/Users/charon/go/catbattle-arena/app/page.tsx`
- Added `ETag` and short private cache for arena pages + server refresh guardrail.
  - Updated `/Users/charon/go/catbattle-arena/app/api/arena/pages/route.ts`
  - Supports `If-None-Match` and `304` responses.
  - Added rate limiting to reduce runaway page refresh loops.
- Added low-egress behavior flag.
  - `NEXT_PUBLIC_LOW_EGRESS=1` reduces/pauses background refresh in selected surfaces.
  - Updated `/Users/charon/go/catbattle-arena/app/page.tsx`
  - Updated `/Users/charon/go/catbattle-arena/app/leaderboard/page.tsx`
  - Updated `/Users/charon/go/catbattle-arena/app/guilds/page.tsx`
- Added lazy/async image decode hints for common feed cards.
  - Updated `/Users/charon/go/catbattle-arena/app/page.tsx`
  - Updated `/Users/charon/go/catbattle-arena/app/gallery/page.tsx`
  - Updated `/Users/charon/go/catbattle-arena/app/components/TournamentVotingHub.tsx`

## Expected Egress Impact

- Biggest reduction should come from serving `thumb.webp`/`card.webp` instead of full originals in feed/list contexts.
- Signed URL removal for public bucket improves cache hit stability.
- Status/version polling avoids frequent refetches when nothing changed.
- `ETag` on `/api/arena/pages` reduces repeated payload transfer.

## Verification Steps (Chrome + App)

1. Open home feed and inspect image requests.
2. Confirm URLs use:
   - `/storage/v1/object/public/cat-images/cats/<id>/thumb.webp` on feed/list cards.
3. Confirm response headers for derivatives include:
   - `Cache-Control: public, max-age=31536000, immutable`
4. Confirm home polling cadence:
   - visible idle: about every 12s to `/api/home/status`
   - hidden tab: about every 60s
   - shortly after vote/predict: temporary ~6s status checks
5. Confirm no signed storage URLs are used for `cat-images` in normal feed responses.

## Smoke Script

- Added script: `/Users/charon/go/catbattle-arena/scripts/egress-smoke.mjs`
- Run with:
  - `npm run egress:smoke`
  - Optional env:
    - `EGRESS_URL=https://catclash.org`
    - `EGRESS_IDLE_MS=60000`
    - `EGRESS_SCROLL_STEPS=12`

The script outputs:
- total requests
- total bytes
- count of requests to `/storage/v1/object/public/cat-images/`
- average storage image size in bytes

## Rollback Flags / Safe Toggle

- Set `NEXT_PUBLIC_LOW_EGRESS=1` for conservative background refresh behavior.
- If derivative URL columns are not yet migrated, code paths include legacy fallbacks and continue using `image_path`.

## Quick Questions Answered

1. Supabase storage host format in prod:
   - Built from `NEXT_PUBLIC_SUPABASE_URL` as
   - `<supabase-url>/storage/v1/object/public/cat-images/...`
2. Cat DB image fields currently used:
   - Existing: `image_path`
   - Added: `image_url_original`, `image_url_card`, `image_url_thumb`
3. Upload entrypoints covered:
   - submit: `/api/cats/submit`
   - adopt: `/api/starter/adopt`
   - crate-drop flow: `/api/crate/claim`

