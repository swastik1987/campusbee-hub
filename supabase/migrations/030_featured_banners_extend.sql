-- ============================================================================
-- 030_featured_banners_extend.sql  (Phase 8)
--
-- Extends the baseline `featured_banners` table for the v2 Phase 8 plan:
--   - `surface` ENUM-LIKE column: which surface the banner targets.
--       'home_banner'    → single rotating banner on Landing /
--       'explore_banner' → small carousel above category pills on Explore
--   - Region columns: `center_address`, `center_location` (PostGIS Point),
--     `radius_km`.  Home banners are global (no region required); explore
--     banners are regional (region required at INSERT time, enforced by
--     CHECK constraint).
--   - `off_app_payment_ref` for manual provisioning workflow parity with
--     sponsored_listings.
--
-- Safe to re-run.
-- ============================================================================

-- ── Surface column ───────────────────────────────────────────────────────────
ALTER TABLE public.featured_banners
  ADD COLUMN IF NOT EXISTS surface             TEXT,
  ADD COLUMN IF NOT EXISTS center_address      TEXT,
  ADD COLUMN IF NOT EXISTS center_location     geography(Point, 4326),
  ADD COLUMN IF NOT EXISTS radius_km           NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS off_app_payment_ref TEXT;

-- Backfill: any pre-existing rows default to explore_banner (existing
-- baseline had no surface concept, but no production rows reference it yet).
UPDATE public.featured_banners
SET    surface = 'explore_banner'
WHERE  surface IS NULL;

-- Now make it NOT NULL with a CHECK constraint
ALTER TABLE public.featured_banners
  ALTER COLUMN surface SET DEFAULT 'explore_banner',
  ALTER COLUMN surface SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'featured_banners_surface_check'
      AND conrelid = 'public.featured_banners'::regclass
  ) THEN
    ALTER TABLE public.featured_banners
      ADD CONSTRAINT featured_banners_surface_check
      CHECK (surface IN ('home_banner','explore_banner'));
  END IF;
END$$;

-- Explore banners must have a region; home banners must not.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'featured_banners_region_required'
      AND conrelid = 'public.featured_banners'::regclass
  ) THEN
    ALTER TABLE public.featured_banners
      ADD CONSTRAINT featured_banners_region_required
      CHECK (
        (surface = 'home_banner'   AND center_location IS NULL AND radius_km IS NULL)
        OR
        (surface = 'explore_banner' AND center_location IS NOT NULL AND radius_km IS NOT NULL)
      );
  END IF;
END$$;

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_banners_surface
  ON public.featured_banners(surface);
CREATE INDEX IF NOT EXISTS idx_banners_center_loc
  ON public.featured_banners USING GIST (center_location)
  WHERE center_location IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_banners_active_window
  ON public.featured_banners(valid_from, valid_until)
  WHERE status = 'active';

-- ── Comments ─────────────────────────────────────────────────────────────────
COMMENT ON COLUMN public.featured_banners.surface IS
  'home_banner = single rotating banner on Landing (global, no region). explore_banner = carousel above category pills on Explore (regional).';
COMMENT ON COLUMN public.featured_banners.center_location IS
  'Required for explore_banner.  Banner only renders for seekers within radius_km of this point.';
COMMENT ON COLUMN public.featured_banners.off_app_payment_ref IS
  'Provider-supplied payment reference (UPI txn / bank transfer ref).  Pricing handled off-app during MVP.';
