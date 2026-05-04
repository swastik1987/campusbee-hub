-- Migration 018: Add columns missing from service_providers v2 baseline
-- Fixes 400 errors on GET /service_providers and POST /service_providers
--
-- Missing columns: intro_video_url, upi_id, upi_qr_image_url
-- Type fix: qualifications TEXT[] → TEXT (app uses it as free-form textarea)

ALTER TABLE public.service_providers
  ADD COLUMN IF NOT EXISTS intro_video_url   TEXT,
  ADD COLUMN IF NOT EXISTS upi_id            TEXT,
  ADD COLUMN IF NOT EXISTS upi_qr_image_url  TEXT;

-- qualifications was TEXT[] in the baseline but the app treats it as plain TEXT.
-- Convert existing arrays to comma-joined strings (safe — no production data yet).
ALTER TABLE public.service_providers
  ALTER COLUMN qualifications TYPE TEXT
  USING array_to_string(qualifications, ', ');
