# UI Changelog (Incremental Refactor)

## 2026-02-20

### Phase 0 - Baseline
- Captured mobile baseline screenshots in `/Users/charon/go/catbattle-arena/docs/ui-baseline`.
- Logged top 5 mobile pain points in `/Users/charon/go/catbattle-arena/docs/ui-baseline/README.md`.

### Phase 1 - Tokens + UI Primitives
- Added centralized token layer in `/Users/charon/go/catbattle-arena/app/globals.css`.
- Added primitives in `/Users/charon/go/catbattle-arena/app/components/ui/primitives.tsx` and toast primitives in `/Users/charon/go/catbattle-arena/app/components/ui/toast.tsx`.
- Introduced shared class utility `/Users/charon/go/catbattle-arena/app/lib/cn.ts`.
- Applied primitives in Home, Duel, and Shop key sections.

### Phase 2 - Safe Area + Toast Clipping
- Moved global toasts to top safe area with high z-index and non-blocking host.
- Added safe-area-aware content padding and nav/header alignment adjustments in layout + nav.

### Phase 3 - Home Density + Speed-to-Fun
- Added compact quick-play cluster above fold (status chips, pulse strip, live duel strip, quick vote).
- Compressed voting card density and added optional details accordion.
- Gated prediction controls behind explicit affordance for lower cognitive load.
- Added next-match micro-feedback text during card transitions.

### Phase 4 - Duel Compact Rebuild (UI)
- Tightened duel inbox container density.
- Added tab semantics and compact action surfaces.
- Added Share Match bottom sheet with options (Story/Post/Copy/Download) using existing share link flow.

### Phase 5 - Shop Preview Stage
- Added top preview stage showing immediate cosmetic application surfaces.
- Added explicit Preview action on cards to apply to stage without purchase.
- Standardized section wrappers with primitives and cleaner tier surfacing.

### Phase 6 - Crates Consistent Delight
- Added common-tier shimmer treatment and quick-pop cue so non-rare drops still feel resolved.
- Kept skip availability behavior and existing rarity-scaled sequence timings.

### Phase 7 - Accessibility Pass
- Reinforced `aria-live` and non-focus-stealing toast behavior.
- Added ARIA labels on vote/predict actions and tab semantics in duel tabs.
- Added reduced motion guardrails in global styles.

### Phase 8 - Hooks Health Check
- Captured current telemetry endpoint snapshot and retention nudges in `/Users/charon/go/catbattle-arena/docs/hooks-health-report.md`.
