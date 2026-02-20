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

## Manual Visual QA Findings
- Toast host now renders in top safe-area and avoids bottom nav overlap.
- Bottom nav overlap risk reduced by safe-area-aware content padding.
- Home above fold now surfaces quick duel/pulse/vote action before deep content sections.
- Duel list/detail hierarchy is denser and more action-first on mobile.
- Shop now has an explicit live preview stage, making cosmetic differences visible.
- Crate reveals provide common-tier visual completion cue, not only rare-tier emphasis.

## Recommended Next QA Pass
- Test on physical iPhone Safari for notch + dynamic toolbar behavior.
- Validate keyboard focus order with external keyboard on iPad/iPhone.
- Verify reduced-motion behavior with iOS accessibility setting enabled.
