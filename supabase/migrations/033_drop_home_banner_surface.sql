-- ============================================================================
-- 033_drop_home_banner_surface.sql  (Phase 8 — banner consolidation)
--
-- Hard-removes the 'home_banner' surface from featured_banners.  All banners
-- now live on the /explore page only and require a region (center + radius).
--
-- Steps:
--   1. Cancel any existing home_banner rows (status='cancelled') so the new
--      CHECK constraint can be applied cleanly.
--   2. Drop the old surface CHECK and recreate to allow only 'explore_banner'.
--   3. Drop the old region_required CHECK and recreate without the home branch
--      (region is now always required).
--   4. Tighten the column default.
--
-- Safe to re-run (idempotent guards throughout).
-- ============================================================================

-- 1. Cancel existing home_banner rows so the tighter CHECK can land.
UPDATE public.featured_banners
SET    status = 'cancelled',
       rejection_reason = COALESCE(rejection_reason, 'Home banners discontinued')
WHERE  surface = 'home_banner'
  AND  status NOT IN ('cancelled', 'expired', 'rejected');

-- 2. Drop and recreate the surface CHECK.
ALTER TABLE public.featured_banners
  DROP CONSTRAINT IF EXISTS featured_banners_surface_check;

-- Migrate any leftover home_banner rows to a placeholder so the CHECK doesn't
-- choke.  We won't render them and they're already cancelled by step 1, but
-- the constraint still has to pass.
UPDATE public.featured_banners
SET    surface = 'explore_banner'
WHERE  surface = 'home_banner';

ALTER TABLE public.featured_banners
  ADD CONSTRAINT featured_banners_surface_check
  CHECK (surface = 'explore_banner');

-- 3. Drop and recreate the region_required CHECK.  All banners now need a
--    center_location + radius_km.
ALTER TABLE public.featured_banners
  DROP CONSTRAINT IF EXISTS featured_banners_region_required;

ALTER TABLE public.featured_banners
  ADD CONSTRAINT featured_banners_region_required
  CHECK (center_location IS NOT NULL AND radius_km IS NOT NULL);

-- 4. Tighten the column default (already 'explore_banner' from migration 030;
--    re-assert for clarity).
ALTER TABLE public.featured_banners
  ALTER COLUMN surface SET DEFAULT 'explore_banner';

COMMENT ON COLUMN public.featured_banners.surface IS
  'Only "explore_banner" is valid in v2 Phase 8 (carousel above /explore).  home_banner was removed in migration 033.';
