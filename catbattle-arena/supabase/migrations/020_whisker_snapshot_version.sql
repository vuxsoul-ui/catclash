ALTER TABLE arena_snapshots
ADD COLUMN IF NOT EXISTS snapshot_version INTEGER NOT NULL DEFAULT 1;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, cat_id
      ORDER BY created_at ASC, id ASC
    ) AS v
  FROM arena_snapshots
)
UPDATE arena_snapshots s
SET snapshot_version = ranked.v
FROM ranked
WHERE s.id = ranked.id;

