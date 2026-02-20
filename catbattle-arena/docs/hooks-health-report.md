# Gameplay Hooks Health Check

Date: 2026-02-20
Source: `/api/admin/launch-metrics` (local)

## Telemetry Snapshot
- `landing_view`: 37
- `guest_vote_cast`: 1
- `vote_streak_hit`: 1
- `cosmetic_effect_triggered`: 874
- KPI `visitor_to_vote_pct`: 16.7 (target 30)
- KPI `signup_to_prediction_pct`: 0 (target 12)
- KPI `signup_to_referral_share_pct`: 0 (target 8)

## What Feels Strong
- Core loop now has a visible quick-vote path above fold.
- Duel and pulse are surfaced early, improving event feel.
- Cosmetic previewing is now concrete rather than abstract.
- Arena refilling now has deterministic retry semantics and a clear manual fallback path.

## What Still Feels Confusing
- Prediction value proposition remains secondary and can still be missed by first-time voters.
- Share moments are present but still low-commitment and easy to ignore.
- Mission/optional surfaces can still compete with first-vote urgency.
- Data latency on first load can still delay initial vote moments in some environments; monitor real-user timings.

## 5 Smallest UI Nudges for D1 Retention
1. Show a one-line underdog payout hint right under the new Predict affordance in first two votes.
2. After first successful vote, briefly pin a “2 more votes to unlock streak badge” micro-goal.
3. Trigger one subtle share toast on close-match result only once/session (already partially wired via clutch signal; tighten trigger to close-match outcomes).
4. Add a tiny “You can still vote as guest” line beside first vote CTA for trust/clarity.
5. After first prediction, keep a compact “Return at next Pulse” chip sticky for one session on Home.

## Visitor -> Vote Expectation (Post Fix)
- Short-term expectation: reduction in “stuck refill” sessions and improved `visitor_to_vote_pct` reliability due to stable fallback + manual refresh.
- Telemetry to monitor over next sample window:
  - `arena_fetch_empty` to `arena_fetch_success` conversion rate
  - `arena_refill_failed` frequency per landing cohort
  - `visitor_to_vote_pct` movement toward target 30
