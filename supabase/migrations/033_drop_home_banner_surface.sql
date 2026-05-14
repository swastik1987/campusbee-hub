-- ============================================================================
-- 033_drop_home_banner_surface.sql  (Phase 8 — banner consolidation)
--
-- Hard-removes the 'home_banner' surface from featured_banners.  All banners
-- now live on the /explore page only.  Active banners require a region
-- (center_location + radius_km); terminal-status rows are exempt so existing
-- home_banner rows (which had NULL region by the old CHECK) can be cancelled
-- and kept for history without violating the new constraint.
--
-- Safe to re-run (handles partial application from a previous failed run).
-- ============================================================================

-- 1. Cancel any non-terminal home_banner rows.
UPDATE public.featured_banners
SET    status = 'cancelled',
       rejection_reason = COALESCE(rejection_reason, 'Home banners discontinued')
WHERE  surface = 'home_banner'
  AND  status NOT IN ('cancelled', 'expired', 'rejected');

-- 2. Drop the old surface CHECK and recreate to allow only 'explore_banner'.
ALTER TABLE public.featured_banners
  DROP CONSTRAINT IF EXISTS featured_banners_surface_check;

-- Convert any leftover home_banner rows (now all terminal-status) to
-- explore_banner so the tighter surface CHECK passes.  We keep the rows
-- for history; they won't render because status is terminal.
UPDATE public.featured_banners
SET    surface = 'explore_banner'
WHERE  surface = 'home_banner';

ALTER TABLE public.featured_banners
  ADD CONSTRAINT featured_banners_surface_check
  CHECK (surface = 'explore_banner');

-- 3. Drop the old region_required CHECK.  Add a new one that requires region
--    only for non-terminal rows.  This grandfathers the cancelled home_banner
--    rows (which had NULL region by the old constraint) while still enforcing
--    region on any new pending/approved/active banner.
ALTER TABLE public.featured_banners
  DROP CONSTRAINT IF EXISTS featured_banners_region_required;

ALTER TABLE public.featured_banners
  ADD CONSTRAINT featured_banners_region_required
  CHECK (
    status IN ('cancelled', 'expired', 'rejected')
    OR (center_location IS NOT NULL AND radius_km IS NOT NULL)
  );

-- 4. Tighten the column default.
ALTER TABLE public.featured_banners
  ALTER COLUMN surface SET DEFAULT 'explore_banner';

COMMENT ON COLUMN public.featured_banners.surface IS
  'Only "explore_banner" is valid in v2 Phase 8 (carousel above /explore).  home_banner was removed in migration 033.';

COMMENT ON CONSTRAINT featured_banners_region_required ON public.featured_banners IS
  'Active/pending/approved banners must have center_location + radius_km.  Terminal-status rows (cancelled/expired/rejected) are exempt so historical home_banner rows can be preserved.';
