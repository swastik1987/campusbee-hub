-- ============================================================
-- CampusBee v2 — add seeker location columns to public.users
-- Run this once in the Supabase SQL editor:
--   supabase.com/dashboard/project/uspqewlpgdsvabturfes/editor
-- ============================================================

-- Step 1: Enable PostGIS (required for geography column)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Step 2: Add the two columns (IF NOT EXISTS is safe to re-run)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS seeker_home_address    TEXT,
  ADD COLUMN IF NOT EXISTS seeker_home_location   geography(Point, 4326);

-- Step 3: GiST index for fast proximity queries (ST_DWithin)
CREATE INDEX IF NOT EXISTS idx_users_seeker_home_location
  ON public.users
  USING GIST (seeker_home_location);
