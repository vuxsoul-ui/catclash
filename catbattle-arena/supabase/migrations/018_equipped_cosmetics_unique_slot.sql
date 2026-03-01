-- Ensure ON CONFLICT(user_id,slot) is valid for equipped cosmetics.
-- Deduplicate legacy rows first, keeping newest equipped row per slot.
WITH ranked AS (
  SELECT
    ctid,
    row_number() OVER (
      PARTITION BY user_id, slot
      ORDER BY equipped_at DESC NULLS LAST
    ) AS rn
  FROM equipped_cosmetics
)
DELETE FROM equipped_cosmetics ec
USING ranked r
WHERE ec.ctid = r.ctid
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS equipped_cosmetics_user_slot_unique
  ON equipped_cosmetics(user_id, slot);
