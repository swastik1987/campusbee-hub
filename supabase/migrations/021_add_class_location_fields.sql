-- 021_add_class_location_fields.sql
-- Adds explicit lat/lng denormalized columns for client-side distance filtering,
-- and home_radius_km for home-based class service radius.
-- Safe to re-run (uses IF NOT EXISTS / IF EXISTS guards throughout).

-- ── Classes ───────────────────────────────────────────────────────────────────
-- Explicit lat/lng alongside the geography column so PostgREST can return them
-- without WKB hex encoding that's hard to parse client-side.
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS location_lat   NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS location_lng   NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS home_radius_km NUMERIC(6,2) NOT NULL DEFAULT 5;

-- ── Users ─────────────────────────────────────────────────────────────────────
-- Explicit seeker lat/lng alongside seeker_home_location geography column.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS seeker_home_lat NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS seeker_home_lng NUMERIC(9,6);

-- ── Comments ──────────────────────────────────────────────────────────────────
COMMENT ON COLUMN public.classes.location_lat IS
  'Latitude of class venue — denormalized from location geography for client-side distance filtering.';
COMMENT ON COLUMN public.classes.location_lng IS
  'Longitude of class venue — denormalized from location geography for client-side distance filtering.';
COMMENT ON COLUMN public.classes.home_radius_km IS
  'Service radius (km) for home-based classes. Provider travels to students within this distance of their base location. Default 5 km.';
COMMENT ON COLUMN public.users.seeker_home_lat IS
  'Latitude of seeker home — denormalized from seeker_home_location for client-side distance filtering.';
COMMENT ON COLUMN public.users.seeker_home_lng IS
  'Longitude of seeker home — denormalized from seeker_home_location for client-side distance filtering.';
