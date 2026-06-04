ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS paint_color text,
  ADD COLUMN IF NOT EXISTS scene text,
  ADD COLUMN IF NOT EXISTS impact_area text,
  ADD COLUMN IF NOT EXISTS damage_severity text,
  ADD COLUMN IF NOT EXISTS image_model text,
  ADD COLUMN IF NOT EXISTS image_angle_count integer;

ALTER TABLE public.claim_images
  ADD COLUMN IF NOT EXISTS prompt text;