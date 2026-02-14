-- Migration: Update submit_cat_v2 to extract stats from JSONB into individual columns

CREATE OR REPLACE FUNCTION public.submit_cat_v2(
  p_user_id UUID,
  p_name TEXT,
  p_image_path TEXT,
  p_rarity TEXT,
  p_stats JSONB,
  p_ability TEXT DEFAULT 'Laser Eyes'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat_id UUID;
  v_attack INT;
  v_defense INT;
  v_speed INT;
  v_charisma INT;
  v_chaos INT;
BEGIN
  -- Extract stats from JSONB
  v_attack := COALESCE((p_stats->>'attack')::int, 50);
  v_defense := COALESCE((p_stats->>'defense')::int, 50);
  v_speed := COALESCE((p_stats->>'speed')::int, 50);
  v_charisma := COALESCE((p_stats->>'charisma')::int, 50);
  v_chaos := COALESCE((p_stats->>'chaos')::int, 50);
  
  INSERT INTO public.cats (
    id,
    user_id,
    name,
    image_path,
    rarity,
    stats,
    ability,
    attack,
    defense,
    speed,
    charisma,
    chaos,
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
    p_ability,
    v_attack,
    v_defense,
    v_speed,
    v_charisma,
    v_chaos,
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
