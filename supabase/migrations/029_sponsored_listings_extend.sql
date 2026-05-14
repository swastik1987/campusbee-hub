-- ============================================================================
-- 029_sponsored_listings_extend.sql  (Phase 8)
--
-- Extends the baseline `sponsored_listings` table for the v2 Phase 8 plan:
--   - Per-category scoping  → `category_id` FK + index, so the
--     `sponsored_for_location` RPC can return slots scoped to a category.
--   - Counters → `impression_count`, `click_count` (already on
--     featured_banners; mirror onto sponsored_listings for parity).
--   - Computed `slot_position` is intentionally NOT stored: distance-based
--     ranking is recomputed at query time per seeker location.  The existing
--     `slot_position` column (baseline 001, line 539) is retained but unused;
--     leave it in place so old code that selects it still compiles.
--
-- Safe to re-run (idempotent IF NOT EXISTS / IF EXISTS guards).
-- ============================================================================

-- ── Columns ───────────────────────────────────────────────────────────────────
ALTER TABLE public.sponsored_listings
  ADD COLUMN IF NOT EXISTS category_id      UUID
    REFERENCES public.class_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS impression_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_count      INTEGER NOT NULL DEFAULT 0;

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sponsored_category
  ON public.sponsored_listings(category_id)
  WHERE category_id IS NOT NULL;

-- Active-window + category compound for fast lookups in sponsored_for_location
CREATE INDEX IF NOT EXISTS idx_sponsored_active_category
  ON public.sponsored_listings(category_id, valid_from, valid_until)
  WHERE status = 'active';

-- ── Backfill ─────────────────────────────────────────────────────────────────
-- Existing rows had no category_id.  Inherit from the linked class.
UPDATE public.sponsored_listings sl
SET    category_id = c.category_id
FROM   public.classes c
WHERE  sl.class_id = c.id
  AND  sl.category_id IS NULL;

-- ── Comments ─────────────────────────────────────────────────────────────────
COMMENT ON COLUMN public.sponsored_listings.category_id IS
  'Category this slot competes in.  When NULL the slot competes in a global pool.  Auto-set from classes.category_id on insert (provider UI also passes this).';
COMMENT ON COLUMN public.sponsored_listings.impression_count IS
  'Incremented by increment_sponsored_impression() RPC (debounced client-side).';
COMMENT ON COLUMN public.sponsored_listings.click_count IS
  'Incremented by increment_sponsored_click() RPC on tap-through.';
