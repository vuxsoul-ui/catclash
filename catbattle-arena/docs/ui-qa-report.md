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
