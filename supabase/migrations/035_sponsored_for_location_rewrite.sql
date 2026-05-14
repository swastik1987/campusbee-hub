-- ============================================================================
-- 035_sponsored_for_location_rewrite.sql  (Phase 8 — sponsored design fix)
--
-- Rewrites sponsored_for_location so it ignores seeker lat/lng — sponsored
-- listings are trust-marker tags scoped to the class, not to a separate
-- listing region.  Returns every active sponsored row in the active window,
-- optionally filtered by category, capped by sponsored.slots_per_category.
--
-- Backward compatible signature: lat/lng parameters are preserved so the
-- existing `useActiveSponsoredClassIds({ lat, lng, categoryId })` call sites
-- keep working without code churn — they just become inert.
--
-- Per-category slot cap from platform_settings is retained.
-- ============================================================================

-- Drop + recreate (signature unchanged but return columns differ slightly).
DROP FUNCTION IF EXISTS public.sponsored_for_location(NUMERIC, NUMERIC, UUID);

CREATE OR REPLACE FUNCTION public.sponsored_for_location(
  p_lat         NUMERIC,
  p_lng         NUMERIC,
  p_category_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id            UUID,
  class_id      UUID,
  provider_id   UUID,
  category_id   UUID,
  slot_position INTEGER,
  valid_until   TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot_count INTEGER;
BEGIN
  -- p_lat / p_lng are accepted for backward compat with existing hook
  -- signatures but intentionally ignored: the class itself is the geographic
  -- anchor.  If the seeker can see the class in their /explore feed, they
  -- should also see the Sponsored tag.
  PERFORM p_lat;  -- silence "unused parameter" hints
  PERFORM p_lng;

  v_slot_count := public._sponsored_slot_count(p_category_id);

  RETURN QUERY
  WITH ranked AS (
    SELECT
      sl.id,
      sl.class_id,
      sl.provider_id,
      sl.category_id,
      sl.valid_until,
      ROW_NUMBER() OVER (
        PARTITION BY sl.category_id
        ORDER BY sl.requested_at ASC
      )::int AS slot_position
    FROM public.sponsored_listings sl
    WHERE sl.status = 'active'
      AND sl.valid_from  <= now()
      AND sl.valid_until >= now()
      AND (p_category_id IS NULL OR sl.category_id = p_category_id)
  )
  SELECT r.id, r.class_id, r.provider_id, r.category_id, r.slot_position, r.valid_until
  FROM   ranked r
  WHERE  r.slot_position <= v_slot_count
  ORDER  BY r.slot_position, r.class_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sponsored_for_location(NUMERIC, NUMERIC, UUID)
  TO anon, authenticated;

COMMENT ON FUNCTION public.sponsored_for_location(NUMERIC, NUMERIC, UUID) IS
  'Returns active sponsored listings, optionally scoped by category, capped by sponsored.slots_per_category.  Seeker lat/lng are accepted for backward compat but ignored — the class is the geographic anchor.';
