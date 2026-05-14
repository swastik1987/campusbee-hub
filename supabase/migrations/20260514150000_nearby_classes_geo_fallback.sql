-- ──────────────────────────────────────────────────────────────────────────
-- 20260514150000_nearby_classes_geo_fallback.sql
-- Regression repair for the seeker /explore page returning zero results
-- even when there are classes nearby.
--
-- Two issues fixed:
--   A. The original nearby_classes RPC (006_geo_helpers.sql) referenced
--      column names from the baseline draft (age_min, age_max, images,
--      tags) that no longer match the live schema (which uses
--      age_group_min, age_group_max, gallery_urls). The RPC has been
--      silently broken since then — the app's existing code path used a
--      client-side haversine filter and never actually called it.
--   B. classes.location (geography) is NULL for some rows because
--      PostgREST does not reliably persist the
--      'SRID=4326;POINT(lng lat)' WKT string the insert hook sends, even
--      though classes.location_lat / location_lng are correctly
--      populated. The RPC's ST_DWithin filter therefore matched zero
--      rows once the explore page started calling it.
--
-- Three-part fix:
--   1. Backfill classes.location from (location_lat, location_lng) for
--      every row where geography is NULL but coords exist.
--   2. BEFORE INSERT/UPDATE trigger keeps geography in sync going
--      forward so drift cannot reappear.
--   3. Drop the original wide RPC and replace it with a slim version
--      that returns only (id, distance_km) — which is all the explore
--      page actually needs — and whose effective-location expression
--      COALESCEs the geography with a synthesized point from the
--      denormalized lat/lng. Defensive even if a row slips through with
--      NULL geography.
-- Idempotent — safe to re-run.
-- ──────────────────────────────────────────────────────────────────────────

-- ── 1. Backfill geography from denormalized lat/lng ──────────────────────
UPDATE public.classes
SET    location = ST_SetSRID(ST_MakePoint(location_lng, location_lat), 4326)::geography
WHERE  location IS NULL
  AND  location_lat IS NOT NULL
  AND  location_lng IS NOT NULL;

-- ── 2. Trigger to keep geography in sync on writes ───────────────────────
CREATE OR REPLACE FUNCTION public.classes_sync_location_from_latlng()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.location IS NULL
     AND NEW.location_lat IS NOT NULL
     AND NEW.location_lng IS NOT NULL
  THEN
    NEW.location := ST_SetSRID(
      ST_MakePoint(NEW.location_lng, NEW.location_lat), 4326
    )::geography;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS classes_sync_location_trg ON public.classes;
CREATE TRIGGER classes_sync_location_trg
  BEFORE INSERT OR UPDATE OF location, location_lat, location_lng
  ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.classes_sync_location_from_latlng();

-- ── 3. Replace nearby_classes with a slim, correct, defensive version ───
-- The return TABLE shape changes from the original 23-column form to just
-- (id, distance_km) — so we must DROP first; CREATE OR REPLACE alone is
-- not allowed when the return type changes.
DROP FUNCTION IF EXISTS public.nearby_classes(
  DOUBLE PRECISION, DOUBLE PRECISION, NUMERIC, UUID, INTEGER, INTEGER
);

CREATE OR REPLACE FUNCTION public.nearby_classes(
  p_lat         DOUBLE PRECISION,
  p_lng         DOUBLE PRECISION,
  p_radius_km   NUMERIC      DEFAULT 5,
  p_category_id UUID         DEFAULT NULL,
  p_limit       INTEGER      DEFAULT 50,
  p_offset      INTEGER      DEFAULT 0
)
RETURNS TABLE (
  id          UUID,
  distance_km DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH seeker AS (
    SELECT ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography AS pt
  )
  SELECT
    c.id,
    ST_Distance(loc.eff, seeker.pt) / 1000.0 AS distance_km
  FROM   public.classes c
  JOIN   public.service_providers sp ON sp.id = c.provider_id
  CROSS  JOIN seeker
  CROSS  JOIN LATERAL (
    SELECT CASE
      WHEN c.is_home_based THEN sp.home_location
      ELSE COALESCE(
        c.location,
        CASE
          WHEN c.location_lat IS NOT NULL AND c.location_lng IS NOT NULL
          THEN ST_SetSRID(ST_MakePoint(c.location_lng, c.location_lat), 4326)::geography
          ELSE NULL
        END
      )
    END AS eff
  ) AS loc
  WHERE  c.status = 'published'
    AND  c.moderation_status = 'approved'
    AND  sp.suspended_at IS NULL
    AND  loc.eff IS NOT NULL
    AND  ST_DWithin(loc.eff, seeker.pt, (p_radius_km * 1000)::DOUBLE PRECISION)
    AND  (p_category_id IS NULL
          OR c.category_id = p_category_id
          OR EXISTS (
            SELECT 1 FROM public.class_categories cc
            WHERE cc.id = c.category_id AND cc.parent_id = p_category_id
          ))
  ORDER BY distance_km ASC
  LIMIT  p_limit
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.nearby_classes(
  DOUBLE PRECISION, DOUBLE PRECISION, NUMERIC, UUID, INTEGER, INTEGER
) TO anon, authenticated, service_role;
