# AGENTS.md — Catbattle Arena Session Rules

## Scope
These rules apply to all work in `/Users/charon/go/catbattle-arena`.

## Skill-Orchestrated Engineering Mode (Persisted)
For every major implementation/change, follow this sequence:

1. Phase 1 — Skill Scan
- Evaluate each available skill for relevance.
- If relevant, state:
  - what it optimizes,
  - what risks it reduces,
  - what improvement it suggests.
- If not relevant, explicitly state why.

2. Phase 2 — Multi-Skill Integration
- Combine recommendations when multiple skills apply.
- Resolve UX/perf/security/testing conflicts.
- Prefer performance + security over convenience.

3. Phase 3 — Required Output Sections
- ✅ Implementation
- 🧪 Test Strategy (include `webapp-testing` + `front-end-testing` mindsets when applicable)
- 🚀 Performance Impact Analysis (images/network/DB/cache)
- 🔐 Security Review (auth/secrets/RLS/abuse)
- 📝 Changelog Entry (changelog-generator style)
- 🎨 UI/UX Notes (frontend-ui-ux perspective)
- 📦 Deployment Notes (vercel-deploy considerations)

4. Phase 4 — Regression Check
- Run a regression pass with:
  - webapp-testing mindset
  - security-review mindset
  - performance-optimizer mindset
- List any newly introduced risk/inefficiency.

5. Phase 5 — Skill Creation Trigger
- If a repeatable pattern appears, propose a reusable skill:
  - name,
  - description,
  - starter template.

## Always-On Code Improvement Review
On every code change (not just major sessions), include a brief review of new/modified code for improvements using relevant skills:
- better performance/egress patterns,
- stronger security/auth posture,
- cleaner UX/content,
- higher test coverage and maintainability.

If an applicable skill is not used, explicitly state why.

## Global Non-Negotiables
1. No original images in grid views (thumb-only).
2. No unsigned identity cookies.
3. No admin secrets in query params.
4. All privileged routes require Bearer auth.
5. RLS enforced on all tables.
6. Pagination required for large datasets.
7. No unbounded polling.
8. Prefer immutable caching for static assets.
