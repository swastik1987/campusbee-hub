-- ============================================================================
-- 006_geo_helpers.sql  —  PostGIS-powered discovery RPCs
-- ============================================================================
-- Apply AFTER 005_moderation_helpers.sql.
-- These RPCs are the canonical entry points for location-based discovery.
-- App code never queries classes by lat/lng directly — it always goes through
-- nearby_classes() so sponsorship merging, moderation gating, and home-based
-- fallback are enforced in one place.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- effective_class_location(class_id) — returns the location used for nearby
-- search. For classes flagged is_home_based, falls back to the provider's
-- home_location. For others, the class's own location. NULL if neither set.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.effective_class_location(p_class_id UUID)
RETURNS geography
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN c.is_home_based THEN sp.home_location
    ELSE                       c.location
  END
  FROM   public.classes c
  JOIN   public.service_providers sp ON sp.id = c.provider_id
  WHERE  c.id = p_class_id;
$$;
GRANT EXECUTE ON FUNCTION public.effective_class_location(UUID)
  TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- nearby_classes — returns published, approved classes within radius.
-- ---------------------------------------------------------------------------
-- Args:
--   p_lat, p_lng     — seeker location
--   p_radius_km      — search radius
--   p_category_id    — optional category filter (matches class or descendant)
--   p_limit, p_offset — pagination
--
-- Returns:
--   class row + computed distance_km, ordered by distance ascending.
--
-- Behaviour:
--   * Honours classes.is_home_based by computing effective location inline.
--   * Excludes classes from suspended providers.
--   * Excludes classes whose effective location is NULL.
--   * Sponsored slots are NOT injected here — fetched separately by
--     nearby_sponsored() and merged in app code so the badge can be shown.
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
    SELECT CASE WHEN c.is_home_based THEN sp.home_location ELSE c.location END AS eff
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

-- ---------------------------------------------------------------------------
-- nearby_sponsored — sponsored listings whose region contains seeker location.
-- ---------------------------------------------------------------------------
-- Used by app code to inject "Featured" cards into top-N positions of
-- explore results.
CREATE OR REPLACE FUNCTION public.nearby_sponsored(
  p_lat         DOUBLE PRECISION,
  p_lng         DOUBLE PRECISION,
  p_category_id UUID    DEFAULT NULL,
  p_limit       INTEGER DEFAULT 3
)
RETURNS TABLE (
  sponsored_id  UUID,
  class_id      UUID,
  provider_id   UUID,
  slot_position SMALLINT,
  distance_km   DOUBLE PRECISION
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
    sl.id,
    sl.class_id,
    sl.provider_id,
    sl.slot_position,
    ST_Distance(sl.center_location, seeker.pt) / 1000.0 AS distance_km
  FROM   public.sponsored_listings sl
  JOIN   public.classes c ON c.id = sl.class_id
  CROSS  JOIN seeker
  WHERE  sl.status = 'active'
    AND  (sl.valid_from  IS NULL OR sl.valid_from  <= now())
    AND  (sl.valid_until IS NULL OR sl.valid_until >  now())
    AND  sl.center_location IS NOT NULL
    AND  ST_DWithin(sl.center_location, seeker.pt, (sl.radius_km * 1000)::DOUBLE PRECISION)
    AND  c.status = 'published'
    AND  c.moderation_status = 'approved'
    AND  (p_category_id IS NULL OR c.category_id = p_category_id)
  ORDER  BY sl.slot_position NULLS LAST, distance_km ASC
  LIMIT  p_limit;
$$;
GRANT EXECUTE ON FUNCTION public.nearby_sponsored(
  DOUBLE PRECISION, DOUBLE PRECISION, UUID, INTEGER
) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- distance_to_class — for class detail page, returns km from seeker to class.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.distance_to_class(
  p_class_id UUID,
  p_lat      DOUBLE PRECISION,
  p_lng      DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ST_Distance(
    public.effective_class_location(p_class_id),
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  ) / 1000.0;
$$;
GRANT EXECUTE ON FUNCTION public.distance_to_class(UUID, DOUBLE PRECISION, DOUBLE PRECISION)
  TO anon, authenticated, service_role;

COMMIT;

-- ============================================================================
-- Post-geo-helpers checklist:
--   [ ] SELECT extname FROM pg_extension WHERE extname='postgis';     -- exists
--   [ ] SELECT * FROM public.nearby_classes(12.9716, 77.5946, 5);      -- empty (no classes yet)
--   [ ] EXPLAIN SELECT ... shows GIST index on classes.location used
--   [ ] Run 007_seed_categories.sql next
-- ============================================================================
