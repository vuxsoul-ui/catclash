-- Migration: Cat images and submission

-- 1. Add image_path column to cats table
ALTER TABLE public.cats 
ADD COLUMN IF NOT EXISTS image_path TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- 2. Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_cats_status ON public.cats(status);

-- 3. Create function to submit cat
CREATE OR REPLACE FUNCTION submit_cat(
  p_user_id UUID,
  p_name TEXT,
  p_image_path TEXT,
  p_rarity TEXT DEFAULT 'Common',
  p_stats JSONB DEFAULT '{"attack": 50, "defense": 50, "speed": 50, "charisma": 50, "chaos": 50}'::jsonb,
  p_power TEXT DEFAULT 'Laser Eyes'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cat_id UUID;
BEGIN
  -- Ensure user exists
  INSERT INTO profiles (id) VALUES (p_user_id) ON CONFLICT DO NOTHING;
  
  -- Insert cat
  INSERT INTO cats (
    user_id, name, image_path, rarity, stats, power, 
    cat_xp, cat_level, evolution, status, battles_fought
  ) VALUES (
    p_user_id, p_name, p_image_path, p_rarity, p_stats, p_power,
    0, 1, 'Kitten', 'pending', 0
  )
  RETURNING id INTO v_cat_id;
  
  RETURN jsonb_build_object('success', true, 'cat_id', v_cat_id);
END;
$$;
