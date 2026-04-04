# CatClash Memory

## Product truths
- The tournament vote queue must never show already-voted matches after refresh
- Arena UI language is the visual source of truth for Profile and Home
- "Pulse" is internal wording; user-facing wording prefers "batch" unless tested otherwise

## Frontend rules
- Avoid blocky, outlined surfaces
- Primary buttons should feel bright and tactile
- Stats should emphasize value > label

## Backend truths
- Voter identity uses voter_user_id + ip_hash semantics
- /api/vote and /api/tournament/votes-for-matches must share one identity helper
- Queue hydration must be scoped to current queue match IDs

## Open issues
- Profile still needs stronger “flex / pride” identity
- Cat names on cards need stronger typography hierarchy

## Recently fixed
- Shared voter identity helper
- votes-for-matches hydration aligned with vote dedupe
