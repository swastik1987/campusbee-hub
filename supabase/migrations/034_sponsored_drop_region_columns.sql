-- ============================================================================
-- 034_sponsored_drop_region_columns.sql  (Phase 8 — sponsored design fix)
--
-- Removes the region columns from sponsored_listings.  Sponsored listings are
-- trust-marker tags on class cards; the class itself is the geographic anchor
-- via classes.location_lat/lng + home_radius_km.  Adding a separate region
-- on the listing produced double-radius confusion and contradicted the model
-- ("the tag simply applies to the class card").
--
-- Dropped:
--   sponsored_listings.center_address
--   sponsored_listings.center_location  (geography Point, was indexed via GIST)
--   sponsored_listings.radius_km
--
-- featured_banners keeps its region columns — banners have no other anchor.
--
-- Safe to re-run.
-- ============================================================================

-- 1. Drop dependent indexes first.
DROP INDEX IF EXISTS public.idx_sponsored_center_loc;
DROP INDEX IF EXISTS public.idx_sponsored_active_category;

-- 2. Drop the columns.
ALTER TABLE public.sponsored_listings
  DROP COLUMN IF EXISTS center_address,
  DROP COLUMN IF EXISTS center_location,
  DROP COLUMN IF EXISTS radius_km;

-- 3. Recreate a simpler active-window index scoped by category (no region).
--    The RPC in migration 035 filters on status + valid_from + valid_until
--    and optionally on category_id.
CREATE INDEX IF NOT EXISTS idx_sponsored_active_window
  ON public.sponsored_listings(category_id, valid_from, valid_until)
  WHERE status = 'active';

COMMENT ON TABLE public.sponsored_listings IS
  'Trust-marker tag for class cards.  The class supplies the geographic anchor — sponsored listings no longer carry their own region (dropped in migration 034).';
