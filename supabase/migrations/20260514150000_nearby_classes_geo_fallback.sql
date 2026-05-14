-- ──────────────────────────────────────────────────────────────────────────
-- 20260514150000_nearby_classes_geo_fallback.sql
-- Regression repair for the seeker /explore page returning zero results
-- even when there are classes nearby.
--
-- Root cause: PostgREST does not reliably persist the
-- 'SRID=4326;POINT(lng lat)' WKT string the app sends into a geography
-- column, so classes.location ended up NULL for some / all rows even
-- though the denormalized classes.location_lat / location_lng were
-- correctly populated. The nearby_classes RPC filtered on the geography
-- column → empty result.
--
-- Two-part fix:
--   1. Backfill classes.location from (location_lat, location_lng) for
--      every row where geography is missing but coords exist. Also
--      install a trigger that keeps the geography in sync going forward
--      so app code can no longer drift.
--   2. Rewrite nearby_classes so the effective-location expression
--      COALESCEs the geography with a synthesized point from the
--      denormalized lat/lng. Defensive — works even if a row slips
--      through with NULL geography.
-- Idempotent — safe to re-run.
-- ──────────────────────────────────────────────────────────────────────────

-- ── 1. Backfill geography from denormalized lat/lng ──────────────────────
UPDATE public.classes
SET    location = ST_SetSRID(ST_MakePoint(location_lng, location_lat), 4326)::geography
WHERE  location IS NULL
  AND  location_lat IS NOT NULL
  AND  location_lng IS NOT NULL;

-- ── 2. Keep geography in sync on future inserts / updates ────────────────
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

-- ── 3. Rewrite nearby_classes with COALESCE fallback ─────────────────────
-- Same signature + return shape as 006_geo_helpers.sql so client code is
-- unchanged. The only difference is the effective-location expression
-- now falls back to ST_MakePoint(location_lng, location_lat) when the
-- geography column itself is NULL.
CREATE OR REPLACE FUNCTION public.nearby_classes(
  p_lat         DOUBLE PRECISION,
  p_lng         DOUBLE PRECISION,
  p_radius_km   NUMERIC      DEFAULT 5,
  p_category_id UUID         DEFAULT NULL,
  p_limit       INTEGER      DEFAULT 50,
  p_offset      INTEGER      DEFAULT 0
)
RETURNS TABLE (
  id                UUID,
  provider_id       UUID,
  category_id       UUID,
  title             TEXT,
  description       TEXT,
  status            TEXT,
  age_min           INTEGER,
  age_max           INTEGER,
  skill_level       TEXT,
  trial_available   BOOLEAN,
  trial_fee         NUMERIC,
  images            TEXT[],
  tags              TEXT[],
  address           TEXT,
  is_home_based     BOOLEAN,
  total_rating      NUMERIC,
  rating_count      INTEGER,
  effective_lat     DOUBLE PRECISION,
  effective_lng     DOUBLE PRECISION,
  distance_km       DOUBLE PRECISION,
  provider_name     TEXT,
  provider_tier     TEXT
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
    c.provider_id,
    c.category_id,
    c.title,
    c.description,
    c.status,
    c.age_min,
    c.age_max,
    c.skill_level,
    c.trial_available,
    c.trial_fee,
    c.images,
    c.tags,
    c.address,
    c.is_home_based,
    c.total_rating,
    c.rating_count,
    ST_Y(loc.eff::geometry) AS effective_lat,
    ST_X(loc.eff::geometry) AS effective_lng,
    ST_Distance(loc.eff, seeker.pt) / 1000.0 AS distance_km,
    sp.business_name        AS provider_name,
    sp.subscription_tier    AS provider_tier
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
