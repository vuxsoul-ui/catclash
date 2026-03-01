# UI QA Walkthrough (Mobile-First)

Date: 2026-02-20
Device profile: iPhone 13 viewport (Playwright)

## Coverage
- Home: `/`
- Duel arena: `/duel`
- Duel detail route path: `/duel/1` (redirect behavior)
- Shop: `/shop`
- Crate: `/crate`
- Whisker: `/arena`
- Social/Referrals: `/social`

## Smoke Check
Script: `/Users/charon/go/catbattle-arena/scripts/smoke-mobile-ui.mjs`

Observed result:
- Vote interactions completed in script: `0`
- Duel page open/detail interaction: `true`
- Shop preview interaction: `false`
- Runtime errors in script: none

Note: Vote and shop preview actions are data/state dependent in the current local dataset, so script assertions are best-effort and non-failing.

## Arena Refresh Repro (Before Fix)
Observed pre-fix behavior:
1. Consume visible voting cards in an arena page until feed reaches empty state.
2. UI enters “Refilling arena...” state.
3. If the next fetched page returns empty, UI can continue polling/refilling without converging to a stable fallback or clear manual action.

Root causes addressed:
- Refill trigger loop in voting state was unbounded when empty pages persisted.
- No deterministic retry cap/backoff and no guaranteed fallback CTA after retries.
- Page advancement could drift forward repeatedly without explicit wrap semantics.

## Arena Refresh Validation (After Fix)
Script: `/Users/charon/go/catbattle-arena/scripts/smoke-arena-refresh.mjs`

Latest observed output:
- `stable_after_hydration_within_3s`: `true`
- `saw_vote_cta`: `true`
- `toggled_main_rookie`: `true`

Behavior validation:
- Empty/refill path now uses bounded retry sequence (400ms, 900ms, 1800ms).
- Manual `Refresh` CTA appears when refilling persists/fails.
- Previously loaded content is not aggressively blanked while retries run.
- Main/Rookie toggles remain interactive and continue to fetch/update.

Artifacts:
- Updated screenshots in `/Users/charon/go/catbattle-arena/docs/ui-after`.
- Debug screenshot for refresh-state investigation: `/Users/charon/go/catbattle-arena/docs/ui-after/home-refresh-debug.png`.

## Manual Visual QA Findings
- Toast host now renders in top safe-area and avoids bottom nav overlap.
- Bottom nav overlap risk reduced by safe-area-aware content padding.
- Home above fold now surfaces quick duel/pulse/vote action before deep content sections.
- Duel list/detail hierarchy is denser and more action-first on mobile.
- Shop now has an explicit live preview stage, making cosmetic differences visible.
- Crate reveals provide common-tier visual completion cue, not only rare-tier emphasis.
- Home top section is cleaner: duplicate duel modules removed and hero/module spacing compacted.
- Daily Core cards now align more consistently in height and visual density.

## Recommended Next QA Pass
- Test on physical iPhone Safari for notch + dynamic toolbar behavior.
- Validate keyboard focus order with external keyboard on iPad/iPhone.
- Verify reduced-motion behavior with iOS accessibility setting enabled.

## Desktop Top Polish Validation (After Follow-up)
Viewport: 1440x1800 (Playwright)

Checks:
- Desktop top no longer duplicates stat surfaces (HUD + chip row).
- Hero now clears fixed header/HUD without crowding.
- Arena toggles and Pulse strip align into a cleaner top control row.
- Header nav density reduced; top bar no longer overloaded with center pills.

Artifact:
- `/Users/charon/go/catbattle-arena/docs/ui-after/home-desktop-top.png`

## Arena Match Card Progressive Disclosure Validation
Date: 2026-02-21
Component: `/Users/charon/go/catbattle-arena/app/page.tsx` (`MatchCard`)

### Test Matrix
- Width 375: vote CTAs visible immediately; context chip + momentum bar render without overlap.
- Width 390: Analyze toggle expands/collapses without content jump; faction pills remain on meta row end.
- Width 430: Predict panel opens from `🔮 Predict`, stake selection works, predict action closes panel.

### Behavior Checks
- Default state now prioritizes instant voting and hides prediction/stat/comment complexity.
- Analyze section contains stats/cosmetics/comments; default card remains compact.
- Prediction confirmation chip appears after prediction and card returns to non-blocking state.
- Solar/Lunar tags are no longer floating over images and align consistently across A/B card panes.
- No API contract changes to voting or prediction flows.

### Remaining Notes
- Cosmetics visibility depends on available cosmetic fields in match payload; UI now gracefully hides when none exist.
- Predict panel is fixed-bottom on mobile and inline/static on desktop per responsive classes.

## Phase 2 Runtime Hardening Validation
Date: 2026-02-21

### Runtime reliability checks
- Vote path:
  - Vote buttons lock per-card while request is in-flight.
  - Successful votes show transient `Voted ✓` and card replacement animation.
  - If replacement cannot fill, card shows `Queued` chip with inline `Refresh` action.
- Predict path:
  - Predict panel remains open on API error; user can retry without re-opening.
  - Successful prediction closes panel and shows confirmation chip.
- Analyze state:
  - Analyze/predict/comments reset when `match_id` changes; state no longer leaks across replaced cards.

### Empty/refilling arena checks
- Empty voting stack now presents stable fallback:
  - `Main Arena is refilling. Next Pulse in ...`
  - `Refresh` button
  - `Switch to Rookie` button (Main arena)
- No infinite dead-end spinner-only state.

### Fixture mode determinism
- Fixture source wired via:
  - `NEXT_PUBLIC_FIXTURE_MODE=1` / `FIXTURE_MODE=1`
  - or `x-fixture-mode: 1`
  - or `?fixture=1`
- Fixture payloads verified for both:
  - `/api/tournament/active`
  - `/api/arena/pages`
- Includes deterministic Main/Rookie matchup sets with all required card fields.

### Playwright smoke outcomes (fixture)
- `node scripts/smoke-arena-refresh.mjs`
  - stable_after_hydration_within_3s: true
  - saw_vote_cta: true
  - toggled_main_rookie: true
- `node scripts/smoke-mobile-ui.mjs`
  - voted: 3
  - predicted: true
  - duelOpened: true

## Phase 3 Quick Verification Checklist
- [x] Sandbox route renders MatchCard states without API calls (`/dev/match-card`).
- [x] Sandbox includes default/hot/voted/closing variants with cosmetics present and absent.
- [x] Reduced motion disables animation-heavy transitions via `prefers-reduced-motion` and sandbox `.reduce-motion-sim`.
- [x] Toast host uses safe-area-aware top/left/right offsets and high z-index to avoid clipping on iOS notch/header.
- [x] Mobile widths 375/390/430 remain supported by sandbox mobile preview and existing home layout constraints.

## Match Inventory Validation (Main + Rookie)
Date: 2026-02-21

### API checks (local)
- `GET /api/arena/pages?arena=main&tab=voting&page=0&debug=1`
  - `matches.length`: `4`
  - debug: `existingCount=1`, `generatedCount=3`, `eligibleCatsCount=8`
- `GET /api/arena/pages?arena=rookie&tab=voting&page=0&debug=1`
  - `matches.length`: `4`
  - debug: `existingCount=1`, `generatedCount=3`, `eligibleCatsCount=8`

### Reliability behavior
- Main/Rookie now backfill to 4 cards on demand via server-side ensure step.
- No infinite refill loops: generation is bounded (`maxAttempts=40`), and client no longer triggers continuous top-ups while 1–3 cards remain visible.
- If inventory cannot reach target, API returns structured reasons (debug mode) instead of silent empty loops.

### Smoke script
- Script: `/Users/charon/go/catbattle-arena/scripts/arena-inventory-smoke.mjs`
- Result: `PASS: arena inventory smoke checks passed`

## Arenas Active Check + UTC Boundary Test
Date: 2026-02-21

### Active arenas endpoint diagnostics
- Endpoint: `GET /api/tournament/active?debug=1`
- Verified fields:
  - `serverNowUtc` (ISO)
  - `computedDayKey` (UTC day key)
  - `computedPulseWindow` (`startUtc`, `endUtc`, `nextPulseUtc`)
  - `arenaStatusSeen`
  - `activeTournamentIds` (`main`, `rookie`)
  - `activeRoundIds` (`main`, `rookie`)
  - `reason` enum
- Latest local verification:
  - `arenasCount = 2`
  - `arenaTypes = [main, rookie]`
  - `reason = OK`

### UTC boundary deterministic test
- Test file: `/Users/charon/go/catbattle-arena/app/api/_lib/__tests__/arena-active.test.ts`
- Command:
  - `node --test --experimental-strip-types app/api/_lib/__tests__/arena-active.test.ts`
- Cases:
  - `2026-02-21T23:59:59.900Z` => `dayKeyUtc=2026-02-21`
  - `2026-02-22T00:00:00.100Z` => `dayKeyUtc=2026-02-22`

### Self-heal + inventory smoke
- Script: `/Users/charon/go/catbattle-arena/scripts/arena-active-smoke.mjs`
- Result: `PASS: arena active + inventory checks passed`
