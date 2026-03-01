-- Image-only moderation + approval notification preferences

ALTER TABLE cats
ADD COLUMN IF NOT EXISTS image_review_status TEXT NOT NULL DEFAULT 'pending_review';

ALTER TABLE cats
ADD COLUMN IF NOT EXISTS image_review_reason TEXT;

ALTER TABLE cats
ADD COLUMN IF NOT EXISTS image_reviewed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'cats'
      AND constraint_name = 'cats_image_review_status_check'
  ) THEN
    ALTER TABLE cats
      ADD CONSTRAINT cats_image_review_status_check
      CHECK (image_review_status IN ('pending_review', 'approved', 'disapproved'));
  END IF;
END $$;

UPDATE cats
SET image_review_status = CASE
  WHEN status = 'rejected' THEN 'disapproved'
  WHEN status = 'approved' THEN 'approved'
  ELSE 'pending_review'
END
WHERE image_review_status IS NULL
   OR image_review_status NOT IN ('pending_review', 'approved', 'disapproved');

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT,
  cat_photo_approved_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cat_approval_notifications (
  cat_id UUID PRIMARY KEY REFERENCES cats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  approved_at TIMESTAMPTZ NOT NULL,
  notified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
