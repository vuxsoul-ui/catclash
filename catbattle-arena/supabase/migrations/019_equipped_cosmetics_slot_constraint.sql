-- Make equipped slot constraint compatible with both legacy and current slot names.
ALTER TABLE equipped_cosmetics
  DROP CONSTRAINT IF EXISTS equipped_cosmetics_slot_check;

ALTER TABLE equipped_cosmetics
  ADD CONSTRAINT equipped_cosmetics_slot_check
  CHECK (
    slot IN (
      'title', 'border', 'color',
      'cat_title', 'cat_border', 'cat_color',
      'badge', 'frame', 'effect', 'vote_effect'
    )
  );
