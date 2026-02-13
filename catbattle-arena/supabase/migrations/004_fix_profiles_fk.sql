-- Migration: Fix profiles FK to allow guest users (IDEMPOTENT)

-- 1. Drop existing FK constraints if they exist
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_auth_user_id_fkey;

-- 2. Add auth_user_id column for authenticated users (nullable)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS auth_user_id UUID;

-- 3. Add FK constraint on auth_user_id (nullable, so guests allowed)
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_auth_user_id_fkey 
FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 4. Create unique index on auth_user_id (only for non-null values)
DROP INDEX IF EXISTS profiles_auth_user_id_unique;
CREATE UNIQUE INDEX profiles_auth_user_id_unique 
ON public.profiles(auth_user_id) 
WHERE auth_user_id IS NOT NULL;

-- 5. Add comment
COMMENT ON TABLE public.profiles IS 'User profiles. id = primary key (can be guest UUID). auth_user_id = optional link to auth.users';
