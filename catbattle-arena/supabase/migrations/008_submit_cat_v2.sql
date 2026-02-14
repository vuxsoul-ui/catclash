-- Migration: Create submit_cat_v2 with all required params

CREATE OR REPLACE FUNCTION public.submit_cat_v2(
  p_user_id UUID,
  p_name TEXT,
  p_image_path TEXT,
  p_rarity TEXT,
  p_stats JSONB,
  p_power TEXT,
  p_ability TEXT DEFAULT 'Laser Eyes'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat_id UUID;
BEGIN
  INSERT INTO public.cats (
    id,
    user_id,
    name,
    image_path,
    rarity,
    stats,
    power,
    ability,
    cat_xp,
    cat_level,
    evolution,
    status,
    battles_fought,
    created_at
  ) VALUES (
    gen_random_uuid(),
    p_user_id,
    p_name,
    p_image_path,
    p_rarity,
    p_stats,
    p_power,
    p_ability,
    0,
    1,
    'Kitten',
    'pending',
    0,
    NOW()
  )
  RETURNING id INTO v_cat_id;
  
  RETURN jsonb_build_object('ok', true, 'cat_id', v_cat_id);
END;
$$;
