# CatBattle Arena - System Audit & Fixes Report

## Phase 1: Database + Security (COMPLETED)

### Tables Created

1. **profiles** - User profile data
   - id (UUID, PK, references auth.users)
   - username (TEXT, UNIQUE)
   - created_at (TIMESTAMPTZ)

2. **user_progress** - XP and level tracking
   - user_id (UUID, PK)
   - xp (INT, DEFAULT 0) ← Fixed: Starts at 0
   - level (INT, DEFAULT 1) ← Fixed: Starts at 1
   - updated_at (TIMESTAMPTZ)

3. **streaks** - Daily login streaks
   - user_id (UUID, PK)
   - current_streak (INT, DEFAULT 0) ← Fixed: Starts at 0
   - last_claim_date (DATE)
   - updated_at (TIMESTAMPTZ)

4. **daily_rewards** - Daily reward tracking
   - user_id (UUID, PK)
   - last_claim_date (DATE)
   - claimed_today (BOOLEAN, DEFAULT FALSE)
   - updated_at (TIMESTAMPTZ)

5. **cats** - Cat data with stats
   - id (UUID, PK)
   - user_id (UUID, FK)
   - name, rarity, ability (TEXT)
   - attack, defense, speed, charisma, chaos (INT)
   - cat_xp (INT, DEFAULT 0)
   - cat_level (INT, DEFAULT 1)

6. **battles** - Battle records
   - id (UUID, PK)
   - cat_a, cat_b (UUID, FK)
   - status (TEXT)
   - created_at (TIMESTAMPTZ)

7. **votes** - Vote records with anti-double-vote
   - id (UUID, PK)
   - battle_id (UUID, FK)
   - voter_user_id (UUID, FK, nullable)
   - ip_hash (TEXT)
   - voted_for (UUID, FK)
   - created_at (TIMESTAMPTZ)
   - UNIQUE(battle_id, voter_user_id) WHERE voter_user_id IS NOT NULL
   - UNIQUE(battle_id, ip_hash) WHERE ip_hash IS NOT NULL

8. **rate_limits** - Rate limiting
   - key (TEXT, PK)
   - count (INT)
   - window_start (TIMESTAMPTZ)

### Server Functions (RPC)

1. **initialize_new_user()** - Trigger on auth.user creation
   - Creates profile with 0 XP, Level 1
   - Initializes streak at 0
   - Sets up daily rewards

2. **check_streak(user_id)** - Returns:
   - current_streak
   - can_claim (boolean)
   - streak_broken (boolean)

3. **claim_daily_streak(user_id)** - Server-side claim with:
   - Date validation (cannot claim twice per day)
   - XP calculation based on streak day
   - Streak reset if broken
   - Returns success, new_streak, xp_earned

4. **check_rate_limit(key, max_count, window_minutes)** - Prevents abuse:
   - Tracks count per key
   - Resets after window expires
   - Returns boolean (allowed/blocked)

5. **cast_vote(battle_id, user_id, ip_hash, voted_for)** - Secure voting:
   - Rate limit: 10 votes/minute per IP
   - Prevents double voting (checks user_id AND ip_hash)
   - Awards 5 XP per vote
   - Returns success/error

6. **get_xp_for_level(level)** - Returns XP required for level
   - Formula: level² × 100

7. **check_level_up(user_id)** - Processes level-ups:
   - Checks if XP meets threshold
   - Handles multiple level-ups
   - Updates user_progress
   - Returns leveled_up, new_level, xp_remaining

### Security Implemented

1. **Row Level Security (RLS)** - Users can only view own data
2. **Rate Limiting** - Backend-enforced limits
3. **Anti-Double-Vote** - Unique constraints on votes table
4. **IP Hashing** - SHA-256 hash stored, not raw IP
5. **Server-Side Validation** - All rewards validated server-side
6. **Timestamp-Based** - Streaks use server date (not client)

### Default Values Fixed

| Field | Before | After |
|-------|--------|-------|
| User XP | 1250 | 0 |
| User Level | - | 1 |
| Streak | 12 | 0 |
| Cat XP | - | 0 |
| Cat Level | - | 1 |

### Next Steps (Phase 2)

1. Update frontend to use new API endpoints
2. Add loading states to all buttons
3. Implement error handling UI
4. Add real-time leaderboard updates
5. Test all edge cases

### Files Created

- `/supabase/migrations/001_core_schema.sql`
- `/supabase/migrations/002_functions.sql`
- `/app/api/streaks/check/route.ts`
- `/app/api/streaks/claim/route.ts`
- `/app/api/votes/cast/route.ts`
- `/app/api/progress/get/route.ts`
