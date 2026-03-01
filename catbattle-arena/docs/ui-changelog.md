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

### Follow-up - Home Polish + Arena Refresh Fix
- Removed duplicate duel surfaces on Home by introducing a single reusable `LiveDuelsModule` and collapsing the second placement into an inline Duel link.
- Compressed Home hero/header density for mobile and reduced awkward above-the-fold spacing.
- Polished Pulse strip behavior (cleaner right alignment, hide noisy zero-value audience labels).
- Tightened mission card defaults: collapsed-first, clear primary CTA, lightweight mission expansion link.
- Added compact `ArenaFlameCard` mode and aligned Daily Core card sizing/padding for Flame + Crate.
- Implemented shared `useArenaMatches` retry utility with deterministic refill backoff (400ms, 900ms, 1800ms), manual refresh fallback, and non-blocking stale-content behavior.
- Added telemetry events for arena fetch lifecycle (`arena_fetch_start`, `arena_fetch_success`, `arena_fetch_empty`, `arena_refill_retry`, `arena_refill_failed`).
- Updated arena page rotation to wrap by total pages, preventing out-of-range page drift.

### Follow-up - Desktop Top Layout Polish
- Adjusted Home hero top spacing on desktop to avoid overlap/crowding under the fixed HUD (`pt-16 sm:pt-28 lg:pt-32`).
- Removed duplicate stat-chip row on desktop (`sm:hidden`) to prevent redundant top surfaces.
- Expanded desktop content width for Hero/Arenas shell (`sm:max-w-5xl`) so top modules no longer feel compressed.
- Reworked arena-controls row into a cleaner desktop split layout: arena toggles left + Pulse/Bracket strip right.
- Simplified desktop header nav density by moving Social and Leaderboard from center pills to compact right-side icon buttons.

### Arena match card: progressive disclosure + predict sheet + cosmetics integration + faction alignment fix
- Refactored `MatchCard` in `/Users/charon/go/catbattle-arena/app/page.tsx` into 3 layers:
  - Layer 1 default: instant vote-first layout with compact context chip + single momentum bar.
  - Layer 2 Analyze: power compare, compact stat grid, one-line stat-edge note, cosmetics rows, and comments moved under Analyze.
  - Layer 3 Predict: secondary `🔮 Predict` CTA opens a lightweight predict panel (mobile bottom sheet / desktop inline), with stake selector and probability/payout line.
- Removed always-on prediction controls from default card state.
- Added auto-collapse + confirmation behavior after prediction.
- Fixed Solar/Lunar faction placement into a dedicated meta row under each cat name (no image overlay), aligned symmetrically for A/B panes.
- Added compact cosmetics indicators in default state (max 2 + `+N`) and fuller cosmetics rows in Analyze with optional micro `Preview` action.
- Kept existing vote/predict APIs, bet caps, and non-blocking flow unchanged.

### Phase 2: runtime hardening + micro-interactions + fixture mode
- Hardened `MatchCard` vote/predict runtime flow in `/Users/charon/go/catbattle-arena/app/page.tsx`:
  - Vote actions now await server result and return success/failure.
  - Added transient `Voted ✓` confirmation and per-card lockout to reduce double taps.
  - Added queued fallback state (`Queued` + `Refresh`) when replacement cannot be filled immediately.
  - Analyze/predict/comments local UI state resets on `match_id` change to avoid stale carryover.
- Improved replacement continuity in arena stack:
  - Matchup replacement now animates out/in and marks incoming card with temporary `Next up` chip.
  - Added lightweight press/spark feedback and momentum bar nudge after successful vote.
- Empty arena fallback UX improved:
  - Stable inline refill state with `Refresh` and `Switch to Rookie` (for Main arena).
  - Avoids dead-end spinner-only messaging.
- Added deterministic fixture mode:
  - New helper: `/Users/charon/go/catbattle-arena/app/api/_lib/fixtureArena.ts`.
  - `/api/tournament/active` and `/api/arena/pages` now support fixture payloads via env/header/query.
  - Client fetch helpers propagate fixture mode (`x-fixture-mode`, `fixture=1`) from URL/env.
- Automated smoke scripts now run against deterministic fixture inventory:
  - `/Users/charon/go/catbattle-arena/scripts/smoke-arena-refresh.mjs`
  - `/Users/charon/go/catbattle-arena/scripts/smoke-mobile-ui.mjs`

### Phase 3: /dev/match-card sandbox + prefers-reduced-motion + safe-area toast fix
- Added designer sandbox route at `/Users/charon/go/catbattle-arena/app/dev/match-card/page.tsx`.
  - Renders deterministic MatchCard mock states: default, hot/heating, voted, closing.
  - Each state rendered with cosmetics absent + present.
  - Added local controls: reduced-motion simulation, fixture indicator, mobile-width preview (390px).
  - No API dependency; direct URL only; production requires `?dev=1`.
- Added global reduced-motion guard in `/Users/charon/go/catbattle-arena/app/globals.css`:
  - Disables non-essential motion/animations while preserving layout/functionality.
  - Added `.reduce-motion-sim` class for sandbox simulation.
- Hardened toast safe-area behavior in `/Users/charon/go/catbattle-arena/app/globals.css`:
  - Higher z-index for consistent visibility.
  - Safe-area-aware horizontal paddings (`env(safe-area-inset-left/right)`).
  - Safe-area-aware top positioning on all breakpoints.

## 2026-02-21

### Arena inventory reliability: 4-card Main/Rookie fill + debugability
- Updated `/Users/charon/go/catbattle-arena/app/api/_lib/arena-pages.ts` with bounded server-side inventory fill:
  - Added `ensureArenaMatches({ arena, roundId, pageIndex, targetCount=4 })` behavior (max 40 attempts, no infinite loops).
  - Enforces safe pair generation with duplicate-pair protections and cat reuse safeguards.
  - Uses deterministic seeded ordering (`dayKey + arena + round + page`) for stable global page behavior.
- Updated `/Users/charon/go/catbattle-arena/app/api/arena/pages/route.ts`:
  - Always requests target inventory of 4 for voting pages.
  - Added `?debug=1` support (non-prod) returning structured inventory diagnostics.
- Updated `/Users/charon/go/catbattle-arena/app/page.tsx`:
  - Added low-inventory inline indicator and one-shot auto-retry (non-blocking).
  - Prevented continuous top-up refresh loops when 1–3 cards are still visible.
  - Surfaced debug reasons in UI only when debug mode is enabled.
- Added inventory smoke script:
  - `/Users/charon/go/catbattle-arena/scripts/arena-inventory-smoke.mjs`
  - Validates fixture Main/Rookie return 4 matches and low-inventory debug payload exists.

## 2026-02-23

### Arena match card refresh: vote-first front + richer profile back
- Updated `/Users/charon/go/catbattle-arena/app/page.tsx` MatchCard front layout:
  - Removed owner username from front vote view.
  - Kept compact role label (`Challenger`/`Defender`), rarity, level, and faction chip.
  - Added tiny info trigger (`i`) for one-tap details open without increasing card height.
- Added reusable back panel component:
  - `/Users/charon/go/catbattle-arena/app/components/CatCardBack.tsx`
  - Structured sections: description fallback, owner row, compact metadata grid, ability block, matchup share/vote/heat, and action row (`Open Cat Profile`, `Share Card`).
  - Action row anchored at bottom for consistent mobile ergonomics.
- Extended arena feed cat payload with additive metadata:
  - `/Users/charon/go/catbattle-arena/app/api/_lib/arena-pages.ts`
  - Added safe fields (when available): `description`, `origin`, `wins`, `losses`, `level`, `owner_id`.
  - Included fallback query path if optional columns are unavailable.
- Added reduced-motion accessibility handling for flip cards:
  - `/Users/charon/go/catbattle-arena/app/globals.css`
  - In `prefers-reduced-motion`, flip transform is disabled and front/back switch via display/fade semantics.

### Adopted/starter removal: real-user submissions only
- Disabled adoption APIs:
  - `/Users/charon/go/catbattle-arena/app/api/starter/adopt/route.ts` now returns `410`.
  - `/Users/charon/go/catbattle-arena/app/api/cats/starters/route.ts` now returns `410`.
- Updated arena eligibility and seeding to only allow real submitted cats:
  - `/Users/charon/go/catbattle-arena/app/api/_lib/tournament-engine.ts`
  - `/Users/charon/go/catbattle-arena/app/api/admin/arena/seed/route.ts`
  - `/Users/charon/go/catbattle-arena/app/api/tournament/active/route.ts`
  - `/Users/charon/go/catbattle-arena/app/api/_lib/arena-pages.ts`
- Removed adopt flow UI from `/Users/charon/go/catbattle-arena/app/submit/page.tsx` and updated challenge copy in `/Users/charon/go/catbattle-arena/app/cat/[id]/page.tsx`.
- Added one-time data cleanup migration:
  - `/Users/charon/go/catbattle-arena/supabase/migrations/039_remove_adopted_from_tournaments.sql`
