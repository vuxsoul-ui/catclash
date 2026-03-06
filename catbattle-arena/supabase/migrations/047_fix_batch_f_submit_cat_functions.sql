CREATE OR REPLACE FUNCTION public.submit_cat(
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
  v_attack INT;
  v_defense INT;
  v_speed INT;
  v_charisma INT;
  v_chaos INT;
BEGIN
  -- Ensure user exists
  INSERT INTO profiles (id) VALUES (p_user_id) ON CONFLICT DO NOTHING;

  v_attack := LEAST(100, GREATEST(0, COALESCE((p_stats ->> 'attack')::int, 50)));
  v_defense := LEAST(100, GREATEST(0, COALESCE((p_stats ->> 'defense')::int, 50)));
  v_speed := LEAST(100, GREATEST(0, COALESCE((p_stats ->> 'speed')::int, 50)));
  v_charisma := LEAST(100, GREATEST(0, COALESCE((p_stats ->> 'charisma')::int, 50)));
  v_chaos := LEAST(100, GREATEST(0, COALESCE((p_stats ->> 'chaos')::int, 50)));

  INSERT INTO cats (
    user_id, name, image_path, rarity, attack, defense, speed, charisma, chaos,
    ability, cat_xp, cat_level, status
  ) VALUES (
    p_user_id, p_name, p_image_path, p_rarity,
    v_attack, v_defense, v_speed, v_charisma, v_chaos,
    COALESCE(NULLIF(BTRIM(p_power), ''), 'Laser Eyes'),
    0, 1, 'pending'
  )
  RETURNING id INTO v_cat_id;

  RETURN jsonb_build_object('success', true, 'cat_id', v_cat_id);
END;
$$;

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
  v_attack := LEAST(100, GREATEST(0, COALESCE((p_stats->>'attack')::int, 50)));
  v_defense := LEAST(100, GREATEST(0, COALESCE((p_stats->>'defense')::int, 50)));
  v_speed := LEAST(100, GREATEST(0, COALESCE((p_stats->>'speed')::int, 50)));
  v_charisma := LEAST(100, GREATEST(0, COALESCE((p_stats->>'charisma')::int, 50)));
  v_chaos := LEAST(100, GREATEST(0, COALESCE((p_stats->>'chaos')::int, 50)));

  INSERT INTO public.cats (
    id,
    user_id,
    name,
    image_path,
    rarity,
    attack,
    defense,
    speed,
    charisma,
    chaos,
    ability,
    cat_xp,
    cat_level,
    status,
    created_at
  ) VALUES (
    gen_random_uuid(),
    p_user_id,
    p_name,
    p_image_path,
    p_rarity,
    v_attack,
    v_defense,
    v_speed,
    v_charisma,
    v_chaos,
    COALESCE(NULLIF(BTRIM(p_ability), ''), 'Laser Eyes'),
    0,
    1,
    'pending',
    NOW()
  )
  RETURNING id INTO v_cat_id;

  RETURN jsonb_build_object('ok', true, 'cat_id', v_cat_id);
END;
$$;

CREATE OR REPLACE FUNCTION seed_npc_cats_if_needed(p_count INT DEFAULT 16)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_approved_count INT;
  v_needed INT;
  v_i INT;
  v_names TEXT[] := ARRAY['Shadow', 'Luna', 'Milo', 'Bella', 'Oliver', 'Kitty', 'Whiskers', 'Simba', 'Nala', 'Tiger', 'Leo', 'Cleo', 'Pumpkin', 'Ginger', 'Smokey', 'Bandit'];
  v_rarities TEXT[] := ARRAY['Common', 'Common', 'Common', 'Rare', 'Rare', 'Epic', 'Legendary'];
  v_ability_roll TEXT[] := ARRAY['Laser Eyes', 'Ultimate Fluff', 'Chaos Mode', 'Nine Lives', 'Royal Aura', 'Underdog Boost'];
BEGIN
  SELECT COUNT(*) INTO v_approved_count FROM cats WHERE status = 'approved';

  v_needed := p_count - v_approved_count;

  IF v_needed <= 0 THEN
    RETURN 0;
  END IF;

  FOR v_i IN 1..v_needed LOOP
  INSERT INTO cats (
    user_id, name, image_path, rarity, attack, defense, speed, charisma, chaos,
    ability, cat_xp, cat_level, status
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', -- System/NPC user
      v_names[v_i] || ' (NPC)',
      'https://placekitten.com/' || (300 + v_i) || '/' || (300 + v_i),
      v_rarities[1 + (v_i % array_length(v_rarities, 1))],
      50 + (random() * 30)::int,
      50 + (random() * 30)::int,
      50 + (random() * 30)::int,
    50 + (random() * 30)::int,
    50 + (random() * 30)::int,
    v_ability_roll[1 + (v_i % array_length(v_ability_roll, 1))],
    0, 1, 'approved'
  ) ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN v_needed;
END;
$$;
