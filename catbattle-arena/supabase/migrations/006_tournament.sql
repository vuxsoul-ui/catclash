-- Migration: Tournament system

-- 1. Tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE UNIQUE NOT NULL,
  status TEXT DEFAULT 'active', -- active, completed
  round INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tournament entries (cats participating)
CREATE TABLE IF NOT EXISTS tournament_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  cat_id UUID REFERENCES cats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  seed INTEGER,
  eliminated BOOLEAN DEFAULT FALSE,
  votes INTEGER DEFAULT 0,
  UNIQUE(tournament_id, cat_id)
);

-- 3. Tournament matches
CREATE TABLE IF NOT EXISTS tournament_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  cat_a_id UUID REFERENCES cats(id) ON DELETE CASCADE,
  cat_b_id UUID REFERENCES cats(id) ON DELETE CASCADE,
  winner_id UUID REFERENCES cats(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending', -- pending, active, completed
  votes_a INTEGER DEFAULT 0,
  votes_b INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_tournaments_date ON tournaments(date);
CREATE INDEX IF NOT EXISTS idx_tournament_entries_tournament ON tournament_entries(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament ON tournament_matches(tournament_id);

-- 5. Function to get or create today's tournament
CREATE OR REPLACE FUNCTION get_today_tournament()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
  v_tournament_id UUID;
  v_cats JSONB;
BEGIN
  -- Check if tournament exists for today
  SELECT id INTO v_tournament_id FROM tournaments WHERE date = v_today;
  
  IF v_tournament_id IS NULL THEN
    -- Create new tournament
    INSERT INTO tournaments (date, status, round)
    VALUES (v_today, 'active', 1)
    RETURNING id INTO v_tournament_id;
    
    -- Get 16 random approved cats
    SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name, 'image_path', image_path))
    INTO v_cats
    FROM (
      SELECT id, name, image_path FROM cats 
      WHERE status = 'approved' 
      ORDER BY RANDOM() 
      LIMIT 16
    ) sub;
    
    -- Insert entries
    INSERT INTO tournament_entries (tournament_id, cat_id, user_id, seed)
    SELECT v_tournament_id, c.id, c.user_id, row_number() OVER ()
    FROM cats c
    WHERE c.status = 'approved'
    ORDER BY RANDOM()
    LIMIT 16;
    
    -- Create round 1 matches (8 matches)
    INSERT INTO tournament_matches (tournament_id, round, cat_a_id, cat_b_id, status)
    SELECT 
      v_tournament_id,
      1,
      e1.cat_id,
      e2.cat_id,
      'pending'
    FROM tournament_entries e1
    JOIN tournament_entries e2 ON e2.seed = e1.seed + 1
    WHERE e1.tournament_id = v_tournament_id
    AND e1.seed % 2 = 1
    AND e2.seed % 2 = 0;
  END IF;
  
  -- Return tournament with matches
  RETURN (
    SELECT jsonb_build_object(
      'tournament_id', t.id,
      'date', t.date,
      'round', t.round,
      'matches', (
        SELECT jsonb_agg(jsonb_build_object(
          'match_id', m.id,
          'cat_a', jsonb_build_object('id', c1.id, 'name', c1.name, 'image_path', c1.image_path),
          'cat_b', jsonb_build_object('id', c2.id, 'name', c2.name, 'image_path', c2.image_path),
          'status', m.status,
          'votes_a', m.votes_a,
          'votes_b', m.votes_b
        ))
        FROM tournament_matches m
        JOIN cats c1 ON c1.id = m.cat_a_id
        JOIN cats c2 ON c2.id = m.cat_b_id
        WHERE m.tournament_id = t.id AND m.round = t.round
      )
    )
    FROM tournaments t
    WHERE t.id = v_tournament_id
  );
END;
$$;
