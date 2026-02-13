-- CatBattle Arena Database Setup
-- Run this in Supabase SQL Editor

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

-- Enable RLS
alter table submissions enable row level security;
alter table votes enable row level security;
alter table battles enable row level security;

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
