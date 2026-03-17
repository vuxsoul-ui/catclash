DO $$
DECLARE
  momentum_id uuid;
  streak_hunter_id uuid;
  knife_edge_id uuid;
  ironclad_id uuid;
  counter_strike_id uuid;
  mirror_shield_id uuid;
BEGIN
  SELECT id INTO momentum_id FROM public.skills WHERE name = 'Momentum' LIMIT 1;
  IF momentum_id IS NULL THEN
    INSERT INTO public.skills (name, trigger, trigger_value, delta, is_counter, counter_to, description)
    VALUES ('Momentum', 'underdog', NULL, 0.08, false, NULL, '+8% if this cat is the underdog')
    RETURNING id INTO momentum_id;
  ELSE
    UPDATE public.skills
    SET trigger = 'underdog',
        trigger_value = NULL,
        delta = 0.08,
        is_counter = false,
        counter_to = NULL,
        description = '+8% if this cat is the underdog'
    WHERE id = momentum_id;
  END IF;

  SELECT id INTO streak_hunter_id FROM public.skills WHERE name = 'Streak Hunter' LIMIT 1;
  IF streak_hunter_id IS NULL THEN
    INSERT INTO public.skills (name, trigger, trigger_value, delta, is_counter, counter_to, description)
    VALUES ('Streak Hunter', 'opponent_on_streak', 3, 0.06, false, NULL, '+6% if opponent is on a 3-win streak')
    RETURNING id INTO streak_hunter_id;
  ELSE
    UPDATE public.skills
    SET trigger = 'opponent_on_streak',
        trigger_value = 3,
        delta = 0.06,
        is_counter = false,
        counter_to = NULL,
        description = '+6% if opponent is on a 3-win streak'
    WHERE id = streak_hunter_id;
  END IF;

  SELECT id INTO knife_edge_id FROM public.skills WHERE name = 'Knife''s Edge' LIMIT 1;
  IF knife_edge_id IS NULL THEN
    INSERT INTO public.skills (name, trigger, trigger_value, delta, is_counter, counter_to, description)
    VALUES ('Knife''s Edge', 'vote_gap_close', 10, 0.05, false, NULL, '+5% when the vote gap is under 10%')
    RETURNING id INTO knife_edge_id;
  ELSE
    UPDATE public.skills
    SET trigger = 'vote_gap_close',
        trigger_value = 10,
        delta = 0.05,
        is_counter = false,
        counter_to = NULL,
        description = '+5% when the vote gap is under 10%'
    WHERE id = knife_edge_id;
  END IF;

  SELECT id INTO ironclad_id FROM public.skills WHERE name = 'Ironclad' LIMIT 1;
  IF ironclad_id IS NULL THEN
    INSERT INTO public.skills (name, trigger, trigger_value, delta, is_counter, counter_to, description)
    VALUES ('Ironclad', 'favourite', NULL, 0.04, false, NULL, '+4% when this cat enters as the favourite')
    RETURNING id INTO ironclad_id;
  ELSE
    UPDATE public.skills
    SET trigger = 'favourite',
        trigger_value = NULL,
        delta = 0.04,
        is_counter = false,
        counter_to = NULL,
        description = '+4% when this cat enters as the favourite'
    WHERE id = ironclad_id;
  END IF;

  SELECT id INTO counter_strike_id FROM public.skills WHERE name = 'Counter Strike' LIMIT 1;
  IF counter_strike_id IS NULL THEN
    INSERT INTO public.skills (name, trigger, trigger_value, delta, is_counter, counter_to, description)
    VALUES ('Counter Strike', 'counter', NULL, 0.07, true, NULL, 'Counters Mirror Shield. +7% if it triggers')
    RETURNING id INTO counter_strike_id;
  ELSE
    UPDATE public.skills
    SET trigger = 'counter',
        trigger_value = NULL,
        delta = 0.07,
        is_counter = true,
        description = 'Counters Mirror Shield. +7% if it triggers'
    WHERE id = counter_strike_id;
  END IF;

  SELECT id INTO mirror_shield_id FROM public.skills WHERE name = 'Mirror Shield' LIMIT 1;
  IF mirror_shield_id IS NULL THEN
    INSERT INTO public.skills (name, trigger, trigger_value, delta, is_counter, counter_to, description)
    VALUES ('Mirror Shield', 'counter', NULL, 0.07, true, NULL, 'Counters Counter Strike. +7% if it triggers')
    RETURNING id INTO mirror_shield_id;
  ELSE
    UPDATE public.skills
    SET trigger = 'counter',
        trigger_value = NULL,
        delta = 0.07,
        is_counter = true,
        description = 'Counters Counter Strike. +7% if it triggers'
    WHERE id = mirror_shield_id;
  END IF;

  UPDATE public.skills SET counter_to = mirror_shield_id WHERE id = counter_strike_id;
  UPDATE public.skills SET counter_to = counter_strike_id WHERE id = mirror_shield_id;
END $$;
