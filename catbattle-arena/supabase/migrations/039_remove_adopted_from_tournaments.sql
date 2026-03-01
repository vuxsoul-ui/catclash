-- Remove non-submitted cats from tournament participation.
-- This is a one-time cleanup after deprecating starter/adopted gameplay.

WITH invalid_cats AS (
  SELECT id
  FROM public.cats
  WHERE COALESCE(origin, 'submitted') <> 'submitted'
     OR user_id = '00000000-0000-0000-0000-000000000000'
)
DELETE FROM public.tournament_matches tm
USING invalid_cats ic
WHERE tm.cat_a_id = ic.id
   OR tm.cat_b_id = ic.id;

WITH invalid_cats AS (
  SELECT id
  FROM public.cats
  WHERE COALESCE(origin, 'submitted') <> 'submitted'
     OR user_id = '00000000-0000-0000-0000-000000000000'
)
DELETE FROM public.tournament_entries te
USING invalid_cats ic
WHERE te.cat_id = ic.id;

UPDATE public.cats
SET status = 'rejected'
WHERE COALESCE(origin, 'submitted') <> 'submitted'
  AND status = 'approved';
