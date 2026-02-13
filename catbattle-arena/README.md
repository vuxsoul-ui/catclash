# CatBattle Arena

A Pokemon-style cat rating web app with trading cards, voting, and battles.

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (database + storage + auth)
- Deployed to Vercel

## Features

1. **Submission Form** - Photo upload with drag & drop, NSFW detection
2. **Admin Dashboard** - Queue management, approve/reject with AI-generated card stats
3. **Public Gallery** - Trading card grid with rarity filters
4. **Voting System** - Upvotes only, battle mode for head-to-head voting
5. **Leaderboard** - Weekly, all-time, and recent submissions

## Getting Started

```bash
npm install
npm run dev
```

## Environment Variables

Create a `.env.local` file with:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Supabase Setup

See `SUPABASE_SETUP.md` for detailed database setup instructions.
