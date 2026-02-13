# Supabase Setup Guide for CatBattle Arena

## 1. Create Supabase Project

1. Go to https://supabase.com and sign in
2. Click "New Project"
3. Choose your organization
4. Project name: `catbattle-arena`
5. Database password: (generate a strong one)
6. Region: Choose closest to your users
7. Click "Create new project"

## 2. Database Schema

Run the following SQL in the Supabase SQL Editor:

```sql
-- Enable RLS
alter table submissions enable row level security;
alter table votes enable row level security;
alter table battles enable row level security;

-- Submissions table
CREATE TABLE submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    image_url TEXT NOT NULL,
    cat_name TEXT NOT NULL,
    owner_ig TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    attack INTEGER CHECK (attack >= 1 AND attack <= 100),
    defense INTEGER CHECK (defense >= 1 AND defense <= 100),
    speed INTEGER CHECK (speed >= 1 AND speed <= 100),
    ability TEXT,
    rarity TEXT CHECK (rarity IN ('Common', 'Rare', 'Epic', 'Legendary')),
    vote_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Votes table
CREATE TABLE votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cat_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
    voter_ip TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cat_id, voter_ip)
);

-- Battles table
CREATE TABLE battles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cat_a_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
    cat_b_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
    winner_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_submissions_rarity ON submissions(rarity);
CREATE INDEX idx_votes_cat_id ON votes(cat_id);
CREATE INDEX idx_battles_created_at ON battles(created_at);

-- Function to increment vote count
CREATE OR REPLACE FUNCTION increment_vote_count(cat_uuid UUID)
RETURNS void AS $$
BEGIN
    UPDATE submissions 
    SET vote_count = vote_count + 1 
    WHERE id = cat_uuid;
END;
$$ LANGUAGE plpgsql;
```

## 3. Storage Bucket Setup

1. Go to Storage → Buckets
2. Click "New Bucket"
3. Name: `cat-images`
4. Public bucket: ✅ Checked
5. Click "Create bucket"

Add these storage policies:

```sql
-- Allow public to view images
CREATE POLICY "Public can view images" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'cat-images');

-- Allow authenticated uploads
CREATE POLICY "Authenticated can upload" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'cat-images');

-- Allow anon uploads for submissions
CREATE POLICY "Anon can upload" 
ON storage.objects FOR INSERT 
TO anon 
WITH CHECK (bucket_id = 'cat-images');
```

## 4. Row Level Security Policies

```sql
-- Submissions policies
CREATE POLICY "Public can view approved submissions" 
ON submissions FOR SELECT 
TO public 
USING (status = 'approved');

CREATE POLICY "Anyone can create submissions" 
ON submissions FOR INSERT 
TO public 
WITH CHECK (true);

CREATE POLICY "Only admin can update submissions" 
ON submissions FOR UPDATE 
TO authenticated 
USING (auth.jwt() ->> 'role' = 'admin');

-- Votes policies
CREATE POLICY "Public can view votes" 
ON votes FOR SELECT 
TO public 
USING (true);

CREATE POLICY "Anyone can vote" 
ON votes FOR INSERT 
TO public 
WITH CHECK (true);

-- Battles policies
CREATE POLICY "Public can view battles" 
ON battles FOR SELECT 
TO public 
USING (true);

CREATE POLICY "Anyone can create battles" 
ON battles FOR INSERT 
TO public 
WITH CHECK (true);
```

## 5. Environment Variables

After setting up, get your credentials:

1. Go to Project Settings → API
2. Copy `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
3. Copy `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Copy `service_role secret` key → `SUPABASE_SERVICE_ROLE_KEY`

## 6. Admin User Setup

To create an admin user:

1. Go to Authentication → Users
2. Create a new user with email/password
3. In the SQL Editor, run:

```sql
-- Set user as admin (replace with actual user ID)
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'),
    '{role}',
    '"admin"'
)
WHERE email = 'your-admin@email.com';
```

## 7. Webhook for AI Card Generation (Optional)

When a submission is approved, you'll want to trigger AI card generation. Set up a webhook or use a server action to call OpenAI Vision API.

```sql
-- Create a function to call edge function on approval
CREATE OR REPLACE FUNCTION notify_on_approval()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        -- Trigger edge function here
        PERFORM net.http_post(
            url:='https://your-project.supabase.co/functions/v1/generate-card-stats',
            headers:='{"Authorization": "Bearer your-service-role-key"}'::jsonb,
            body:=jsonb_build_object('cat_id', NEW.id, 'image_url', NEW.image_url)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_submission_approved
    AFTER UPDATE ON submissions
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_approval();
```
