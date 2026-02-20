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

## What Still Feels Confusing
- Prediction value proposition remains secondary and can still be missed by first-time voters.
- Share moments are present but still low-commitment and easy to ignore.
- Mission/optional surfaces can still compete with first-vote urgency.

## 5 Smallest UI Nudges for D1 Retention
1. Show a one-line underdog payout hint right under the new Predict affordance in first two votes.
2. After first successful vote, briefly pin a “2 more votes to unlock streak badge” micro-goal.
3. Trigger one subtle share toast on close-match result only once/session (already partially wired via clutch signal; tighten trigger to close-match outcomes).
4. Add a tiny “You can still vote as guest” line beside first vote CTA for trust/clarity.
5. After first prediction, keep a compact “Return at next Pulse” chip sticky for one session on Home.
