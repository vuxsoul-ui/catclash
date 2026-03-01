-- Remove invalid tournament matches where both cats belong to the same owner.
-- This is a data cleanup migration after stricter fairness filters.

DELETE FROM public.tournament_matches tm
USING public.cats a, public.cats b
WHERE tm.cat_a_id = a.id
  AND tm.cat_b_id = b.id
  AND a.user_id IS NOT NULL
  AND b.user_id IS NOT NULL
  AND a.user_id = b.user_id;
