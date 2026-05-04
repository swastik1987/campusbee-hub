-- Migration 018: Add columns missing from service_providers v2 baseline
-- Fixes 400 errors on GET /service_providers and POST /service_providers
--
-- Missing columns: intro_video_url, upi_id, upi_qr_image_url
-- Note: qualifications is already TEXT in the live DB (not TEXT[]) — no conversion needed.

ALTER TABLE public.service_providers
  ADD COLUMN IF NOT EXISTS intro_video_url   TEXT,
  ADD COLUMN IF NOT EXISTS upi_id            TEXT,
  ADD COLUMN IF NOT EXISTS upi_qr_image_url  TEXT;
