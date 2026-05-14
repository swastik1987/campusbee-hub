-- ============================================================================
-- 033_drop_home_banner_surface.sql  (Phase 8 — banner consolidation)
--
-- Hard-removes the 'home_banner' surface from featured_banners.  All banners
-- now live on the /explore page only.
--
-- Order matters: we must DROP both legacy CHECK constraints from migration 030
-- BEFORE updating any row.  The old region_required CHECK was branched on
-- surface ('home_banner' requires NULL region, 'explore_banner' requires
-- region), so simply converting surface=home_banner → explore_banner with the
-- old CHECK still in place fails — the row would have explore_banner + NULL
-- region, violating the explore_banner branch.
--
-- Safe to re-run.  Handles partial state from earlier failed runs.
-- ============================================================================

-- 1. Cancel any non-terminal home_banner rows.  This UPDATE only changes
--    status + rejection_reason, both of which the old constraints allow.
UPDATE public.featured_banners
SET    status = 'cancelled',
       rejection_reason = COALESCE(rejection_reason, 'Home banners discontinued')
WHERE  surface = 'home_banner'
  AND  status NOT IN ('cancelled', 'expired', 'rejected');

-- 2. Drop BOTH legacy CHECKs first.  Now we can freely UPDATE rows without
--    tripping either one.
ALTER TABLE public.featured_banners
  DROP CONSTRAINT IF EXISTS featured_banners_region_required;
ALTER TABLE public.featured_banners
  DROP CONSTRAINT IF EXISTS featured_banners_surface_check;

-- 3. Convert all home_banner rows to explore_banner.  No CHECK constraints
--    on surface or region are active, so this succeeds.
UPDATE public.featured_banners
SET    surface = 'explore_banner'
WHERE  surface = 'home_banner';

-- 4. Add the new strict surface CHECK.  All rows now satisfy it.
ALTER TABLE public.featured_banners
  ADD CONSTRAINT featured_banners_surface_check
  CHECK (surface = 'explore_banner');

-- 5. Add the new region_required CHECK with NOT VALID so existing rows with
--    NULL region (the cancelled legacy ones) are grandfathered.  New inserts
--    and updates are still validated, so every new banner must carry region.
ALTER TABLE public.featured_banners
  ADD CONSTRAINT featured_banners_region_required
  CHECK (center_location IS NOT NULL AND radius_km IS NOT NULL)
  NOT VALID;

-- 6. Tighten the column default.
ALTER TABLE public.featured_banners
  ALTER COLUMN surface SET DEFAULT 'explore_banner';

COMMENT ON COLUMN public.featured_banners.surface IS
  'Only "explore_banner" is valid in v2 Phase 8 (carousel above /explore).  home_banner was removed in migration 033.';

COMMENT ON CONSTRAINT featured_banners_region_required ON public.featured_banners IS
  'Added NOT VALID in migration 033: legacy NULL-region rows exempted, but every new banner insert/update must have center_location + radius_km.';
