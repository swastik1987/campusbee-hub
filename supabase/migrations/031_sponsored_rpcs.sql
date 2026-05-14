-- ============================================================================
-- 031_sponsored_rpcs.sql  (Phase 8)
--
-- RPCs for sponsored listings + featured banners + impression/click counters.
--
-- Ranking rule (per Phase 8 design):
--   For a category × region intersection, return up to N rows ordered by
--     ST_Distance(center_location, seeker_location) ASC,
--     requested_at ASC.
--   N is read from platform_settings:
--     sponsored.slots_per_category  (JSONB map: { "<cat_uuid>": 5, "default": 3 })
--     falls back to sponsored.slots_per_region (legacy single int).
--
-- Featured banners surfaces:
--   home_banner    → global (no region filter); seeker_lat/lng ignored.
--   explore_banner → ST_DWithin filter using each banner's center + radius.
--
-- All read RPCs are STABLE + SECURITY DEFINER so anon visitors can hit them
-- without triggering RLS for non-active rows.  Counter RPCs are VOLATILE +
-- SECURITY DEFINER, return void.
-- ============================================================================

-- ── Helpers ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._sponsored_slot_count(p_category_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_map  JSONB;
  v_n    INTEGER;
BEGIN
  -- Per-category override
  SELECT value INTO v_map
  FROM   public.platform_settings
  WHERE  key = 'sponsored.slots_per_category';

  IF v_map IS NOT NULL THEN
    IF p_category_id IS NOT NULL
       AND v_map ? p_category_id::text THEN
      v_n := (v_map ->> p_category_id::text)::int;
      IF v_n IS NOT NULL AND v_n > 0 THEN
        RETURN v_n;
      END IF;
    END IF;

    -- "default" key inside the map
    IF v_map ? 'default' THEN
      v_n := (v_map ->> 'default')::int;
      IF v_n IS NOT NULL AND v_n > 0 THEN
        RETURN v_n;
      END IF;
    END IF;
  END IF;

  -- Legacy fallback
  SELECT (value)::text::int INTO v_n
  FROM   public.platform_settings
  WHERE  key = 'sponsored.slots_per_region';
  IF v_n IS NOT NULL AND v_n > 0 THEN
    RETURN v_n;
  END IF;

  RETURN 3;  -- final fallback
END;
$$;

GRANT EXECUTE ON FUNCTION public._sponsored_slot_count(UUID) TO anon, authenticated;


-- ── sponsored_for_location ───────────────────────────────────────────────────
-- Returns active, in-window, in-radius sponsored rows for the seeker location,
-- scoped to the given category if provided; otherwise all categories.

CREATE OR REPLACE FUNCTION public.sponsored_for_location(
  p_lat         NUMERIC,
  p_lng         NUMERIC,
  p_category_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id               UUID,
  class_id         UUID,
  provider_id      UUID,
  category_id      UUID,
  radius_km        NUMERIC,
  distance_km      NUMERIC,
  slot_position    INTEGER,
  valid_until      TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loc         geography;
  v_slot_count  INTEGER;
BEGIN
  v_loc := ST_MakePoint(p_lng, p_lat)::geography;
  v_slot_count := public._sponsored_slot_count(p_category_id);

  RETURN QUERY
  WITH ranked AS (
    SELECT
      sl.id,
      sl.class_id,
      sl.provider_id,
      sl.category_id,
      sl.radius_km,
      (ST_Distance(sl.center_location, v_loc) / 1000.0)::numeric AS distance_km,
      sl.valid_until,
      ROW_NUMBER() OVER (
        ORDER BY ST_Distance(sl.center_location, v_loc) ASC,
                 sl.requested_at ASC
      )::int AS slot_position
    FROM public.sponsored_listings sl
    WHERE sl.status = 'active'
      AND sl.valid_from  <= now()
      AND sl.valid_until >= now()
      AND ST_DWithin(sl.center_location, v_loc, sl.radius_km * 1000)
      AND (p_category_id IS NULL OR sl.category_id = p_category_id)
  )
  SELECT r.id, r.class_id, r.provider_id, r.category_id, r.radius_km,
         r.distance_km, r.slot_position, r.valid_until
  FROM   ranked r
  WHERE  r.slot_position <= v_slot_count
  ORDER  BY r.slot_position;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sponsored_for_location(NUMERIC, NUMERIC, UUID)
  TO anon, authenticated;


-- ── featured_banners_for_location ────────────────────────────────────────────
-- Returns active, approved (moderation), in-window banners for the seeker.
--   home_banner    → no region filter.
--   explore_banner → ST_DWithin filter.

CREATE OR REPLACE FUNCTION public.featured_banners_for_location(
  p_lat     NUMERIC,
  p_lng     NUMERIC,
  p_surface TEXT
)
RETURNS TABLE (
  id               UUID,
  provider_id      UUID,
  class_id         UUID,
  image_url        TEXT,
  target_url       TEXT,
  surface          TEXT,
  distance_km      NUMERIC,
  valid_until      TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loc geography;
BEGIN
  IF p_surface NOT IN ('home_banner','explore_banner') THEN
    RAISE EXCEPTION 'invalid surface: %', p_surface;
  END IF;

  IF p_surface = 'home_banner' THEN
    RETURN QUERY
    SELECT fb.id, fb.provider_id, fb.class_id, fb.image_url, fb.target_url,
           fb.surface, NULL::numeric AS distance_km, fb.valid_until
    FROM   public.featured_banners fb
    WHERE  fb.surface          = 'home_banner'
      AND  fb.status           = 'active'
      AND  fb.moderation_status = 'approved'
      AND  fb.valid_from  <= now()
      AND  fb.valid_until >= now()
    ORDER BY fb.requested_at ASC;
    RETURN;
  END IF;

  -- explore_banner
  v_loc := ST_MakePoint(p_lng, p_lat)::geography;
  RETURN QUERY
  SELECT fb.id, fb.provider_id, fb.class_id, fb.image_url, fb.target_url,
         fb.surface,
         (ST_Distance(fb.center_location, v_loc) / 1000.0)::numeric AS distance_km,
         fb.valid_until
  FROM   public.featured_banners fb
  WHERE  fb.surface           = 'explore_banner'
    AND  fb.status            = 'active'
    AND  fb.moderation_status = 'approved'
    AND  fb.valid_from  <= now()
    AND  fb.valid_until >= now()
    AND  ST_DWithin(fb.center_location, v_loc, fb.radius_km * 1000)
  ORDER BY ST_Distance(fb.center_location, v_loc) ASC,
           fb.requested_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.featured_banners_for_location(NUMERIC, NUMERIC, TEXT)
  TO anon, authenticated;


-- ── Counter RPCs ─────────────────────────────────────────────────────────────
-- VOLATILE, SECURITY DEFINER.  No-op if the row is not currently active —
-- prevents spam against expired or rejected slots.

CREATE OR REPLACE FUNCTION public.increment_sponsored_impression(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.sponsored_listings
  SET    impression_count = impression_count + 1
  WHERE  id = p_id
    AND  status = 'active'
    AND  valid_from  <= now()
    AND  valid_until >= now();
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_sponsored_click(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.sponsored_listings
  SET    click_count = click_count + 1
  WHERE  id = p_id
    AND  status = 'active'
    AND  valid_from  <= now()
    AND  valid_until >= now();
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_banner_impression(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.featured_banners
  SET    impression_count = impression_count + 1
  WHERE  id = p_id
    AND  status = 'active'
    AND  moderation_status = 'approved'
    AND  valid_from  <= now()
    AND  valid_until >= now();
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_banner_click(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.featured_banners
  SET    click_count = click_count + 1
  WHERE  id = p_id
    AND  status = 'active'
    AND  moderation_status = 'approved'
    AND  valid_from  <= now()
    AND  valid_until >= now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_sponsored_impression(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_sponsored_click(UUID)      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_banner_impression(UUID)    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_banner_click(UUID)         TO anon, authenticated;


-- ── refresh_sponsored_lifecycle ─────────────────────────────────────────────
-- Called by the `refresh-sponsored-slots` edge function (cron every 15 min)
-- to mature approved→active and active→expired transitions.

CREATE OR REPLACE FUNCTION public.refresh_sponsored_lifecycle()
RETURNS TABLE (
  sponsored_activated    INTEGER,
  sponsored_expired      INTEGER,
  banners_activated      INTEGER,
  banners_expired        INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sa INTEGER; v_se INTEGER; v_ba INTEGER; v_be INTEGER;
BEGIN
  WITH up AS (
    UPDATE public.sponsored_listings
    SET    status = 'active'
    WHERE  status = 'approved'
      AND  valid_from  <= now()
      AND  valid_until >= now()
    RETURNING 1
  )
  SELECT count(*) INTO v_sa FROM up;

  WITH up AS (
    UPDATE public.sponsored_listings
    SET    status = 'expired'
    WHERE  status IN ('approved','active')
      AND  valid_until < now()
    RETURNING 1
  )
  SELECT count(*) INTO v_se FROM up;

  WITH up AS (
    UPDATE public.featured_banners
    SET    status = 'active'
    WHERE  status = 'approved'
      AND  moderation_status = 'approved'
      AND  valid_from  <= now()
      AND  valid_until >= now()
    RETURNING 1
  )
  SELECT count(*) INTO v_ba FROM up;

  WITH up AS (
    UPDATE public.featured_banners
    SET    status = 'expired'
    WHERE  status IN ('approved','active')
      AND  valid_until < now()
    RETURNING 1
  )
  SELECT count(*) INTO v_be FROM up;

  RETURN QUERY SELECT v_sa, v_se, v_ba, v_be;
END;
$$;

-- Edge function uses service_role; no GRANT needed for anon/authenticated.
REVOKE EXECUTE ON FUNCTION public.refresh_sponsored_lifecycle() FROM PUBLIC;
