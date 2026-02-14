-- Migration: Update get_today_tournament to return image_url for each cat

CREATE OR REPLACE FUNCTION get_today_tournament()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
  v_tournament_id UUID;
BEGIN
  -- Check if tournament exists for today
  SELECT id INTO v_tournament_id FROM tournaments WHERE date = v_today;
  
  IF v_tournament_id IS NULL THEN
    -- Seed NPC cats if needed
    PERFORM seed_npc_cats_if_needed(16);
    
    -- Create new tournament
    INSERT INTO tournaments (date, status, round)
    VALUES (v_today, 'active', 1)
    RETURNING id INTO v_tournament_id;
    
    -- Get 16 random approved cats (now includes NPCs)
    INSERT INTO tournament_entries (tournament_id, cat_id, user_id, seed)
    SELECT v_tournament_id, c.id, c.user_id, row_number() OVER ()
    FROM (
      SELECT id, user_id FROM cats 
      WHERE status = 'approved' 
      ORDER BY RANDOM() 
      LIMIT 16
    ) c;
    
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
  
  -- Return tournament with matches including image_url
  RETURN (
    SELECT jsonb_build_object(
      'tournament_id', t.id,
      'date', t.date,
      'round', t.round,
      'matches', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'match_id', m.id,
          'cat_a', jsonb_build_object(
            'id', c1.id, 
            'name', c1.name, 
            'image_path', c1.image_path,
            'image_url', COALESCE(
              (SELECT s.filename FROM storage.objects s WHERE s.name = c1.image_path LIMIT 1),
              c1.image_path
            )
          ),
          'cat_b', jsonb_build_object(
            'id', c2.id, 
            'name', c2.name, 
            'image_path', c2.image_path,
            'image_url', COALESCE(
              (SELECT s.filename FROM storage.objects s WHERE s.name = c2.image_path LIMIT 1),
              c2.image_path
            )
          ),
          'status', m.status,
          'votes_a', m.votes_a,
          'votes_b', m.votes_b
        ))
        FROM tournament_matches m
        JOIN cats c1 ON c1.id = m.cat_a_id
        JOIN cats c2 ON c2.id = m.cat_b_id
        WHERE m.tournament_id = t.id AND m.round = t.round
      ), '[]'::jsonb)
    )
    FROM tournaments t
    WHERE t.id = v_tournament_id
  );
END;
$$;
