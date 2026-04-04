# CatClash

CatClash is a mobile-first cat battle game built with Next.js + Tailwind + Supabase.

## Product identity
- CatClash is a game, not a dashboard
- UI should feel premium, neon, sleek, competitive, and social
- Arena/Home/Profile should feel like one design system
- The app should encourage identity, ownership, streaks, and show-off moments

## Priorities
1. Trustworthy voting
2. Fast mobile UX
3. Strong visual hierarchy
4. Retention loops (streaks, batches, profile pride)
5. Minimal diffs over rewrites

## Frontend rules
- Prefer refining existing components
- Avoid harsh white borders
- Prefer layered gradients, subtle glows, soft depth
- Make actions feel tactile
- Keep touch targets >= 44px

## Backend rules
- Never break vote integrity
- Keep hydration identity consistent with vote identity
- Preserve current API shapes unless absolutely necessary
- Prefer minimal, reliable fixes

## What to avoid
- SaaS/dashboard styling
- generic admin-panel UI
- overengineering
- unnecessary dependencies
- large rewrites unless explicitly requested

## Working style
- Explain root cause before major fixes
- Make small targeted changes
- Keep ChatGPT/Claude/Codex responsibilities separate:
  - Claude Code = frontend polish
  - Codex = backend/data logic
