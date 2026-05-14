-- ============================================================================
-- 033_drop_home_banner_surface.sql  (Phase 8 — banner consolidation)
--
-- Hard-removes the 'home_banner' surface from featured_banners.  All banners
-- now live on the /explore page only.
--
-- This v3 uses PostgreSQL's NOT VALID clause on the region_required CHECK so
-- existing rows with NULL region (legacy home_banner rows from migration 030)
-- are grandfathered when the constraint is added.  Future inserts and updates
-- are still validated, so no new banner can be created without a region.
--
-- Safe to re-run.  Tested against the partial state left by previous failed runs.
-- ============================================================================

-- 1. Cancel any non-terminal home_banner rows.  Must run BEFORE the strict
--    surface CHECK because UPDATEs of home_banner rows would otherwise fail.
UPDATE public.featured_banners
SET    status = 'cancelled',
       rejection_reason = COALESCE(rejection_reason, 'Home banners discontinued')
WHERE  surface = 'home_banner'
  AND  status NOT IN ('cancelled', 'expired', 'rejected');

-- 2. Drop the old surface CHECK, then convert ALL home_banner rows to
--    explore_banner.  The conversion must precede the new strict CHECK
--    because the row update would otherwise violate it.
ALTER TABLE public.featured_banners
  DROP CONSTRAINT IF EXISTS featured_banners_surface_check;

UPDATE public.featured_banners
SET    surface = 'explore_banner'
WHERE  surface = 'home_banner';

-- 3. Add the strict surface CHECK.  All rows now satisfy it.
ALTER TABLE public.featured_banners
  ADD CONSTRAINT featured_banners_surface_check
  CHECK (surface = 'explore_banner');

-- 4. Replace the region_required CHECK.  Use NOT VALID so existing rows with
--    NULL region (the cancelled legacy home_banner rows) are grandfathered.
--    New inserts and UPDATEs are still validated, which is what we want:
--    every new banner must carry a region.
ALTER TABLE public.featured_banners
  DROP CONSTRAINT IF EXISTS featured_banners_region_required;

ALTER TABLE public.featured_banners
  ADD CONSTRAINT featured_banners_region_required
  CHECK (center_location IS NOT NULL AND radius_km IS NOT NULL)
  NOT VALID;

-- 5. Tighten the column default for any future inserts that omit surface.
ALTER TABLE public.featured_banners
  ALTER COLUMN surface SET DEFAULT 'explore_banner';

COMMENT ON COLUMN public.featured_banners.surface IS
  'Only "explore_banner" is valid in v2 Phase 8 (carousel above /explore).  home_banner was removed in migration 033.';

COMMENT ON CONSTRAINT featured_banners_region_required ON public.featured_banners IS
  'Added NOT VALID in migration 033: legacy NULL-region rows are exempted, but every new banner insert/update must have center_location + radius_km.';
