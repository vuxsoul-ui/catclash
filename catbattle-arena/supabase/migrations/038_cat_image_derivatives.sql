-- Public storage derivatives for lower egress feeds
ALTER TABLE public.cats
  ADD COLUMN IF NOT EXISTS image_url_original text,
  ADD COLUMN IF NOT EXISTS image_url_card text,
  ADD COLUMN IF NOT EXISTS image_url_thumb text;

CREATE INDEX IF NOT EXISTS cats_image_url_thumb_idx ON public.cats (image_url_thumb);
