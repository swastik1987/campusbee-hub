-- ──────────────────────────────────────────────────────────────────────────
-- 20260515120000_category_retag_subcat_creation.sql
-- Richer retag flow.
--
-- When a provider accepts an admin's retag suggestion, also create the
-- provider's requested sub-categories under the chosen target (when the
-- target is a top-level parent). Class.category_id is backfilled so any
-- class waiting on the request lands on the most-specific category.
--
-- Behaviour matrix:
--   request_type       | retag target    | what happens on accept
--   ───────────────────┼─────────────────┼───────────────────────────────────
--   new_subcategory    | top-level       | create requested_name as a sub of
--                      |                 | the target (skip dup by lower name)
--                      |                 | class.category_id = new (or dup) sub
--   new_subcategory    | sub-category    | nothing created
--                      |                 | class.category_id = retag target
--   new_category       | top-level       | create every requested_subcategory
--                      |                 | under the target (skip dups)
--                      |                 | class.category_id = retag target
--   new_category       | sub-category    | not allowed at the admin UI layer;
--                      |                 | RPC tolerates it by treating like
--                      |                 | sub-category target above
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.respond_to_category_retag(
  p_request_id UUID,
  p_accepted   BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req_type           TEXT;
  v_req_name           TEXT;
  v_req_subcats        TEXT[];
  v_retag_id           UUID;
  v_retag_is_parent    BOOLEAN;
  v_class_category_id  UUID;
  v_sub_slug           TEXT;
  v_subcat_name        TEXT;
  v_next_order         INT;
  v_new_sub_id         UUID;
BEGIN
  -- Decline path: revert request, drop the suggested target
  IF NOT p_accepted THEN
    UPDATE public.category_requests SET
      status            = 'retag_declined',
      retag_category_id = NULL,
      updated_at        = NOW()
    WHERE id = p_request_id;
    RETURN;
  END IF;

  -- Load request + retag target
  SELECT cr.request_type,
         cr.requested_name,
         cr.requested_subcategories,
         cr.retag_category_id,
         (cc.parent_id IS NULL)
    INTO v_req_type,
         v_req_name,
         v_req_subcats,
         v_retag_id,
         v_retag_is_parent
  FROM   public.category_requests cr
  JOIN   public.class_categories cc ON cc.id = cr.retag_category_id
  WHERE  cr.id = p_request_id;

  IF v_retag_id IS NULL THEN
    RAISE EXCEPTION 'category_request % has no retag target', p_request_id;
  END IF;

  -- Default: class points to the retag target itself
  v_class_category_id := v_retag_id;

  -- ── new_subcategory + parent target: create the requested sub ─────────────
  IF v_req_type = 'new_subcategory' AND v_retag_is_parent THEN
    -- Reuse an existing sub under this parent with the same name (case-insensitive)
    SELECT id INTO v_new_sub_id
    FROM   public.class_categories
    WHERE  parent_id = v_retag_id
      AND  lower(name) = lower(trim(v_req_name));

    IF v_new_sub_id IS NULL THEN
      v_sub_slug := lower(regexp_replace(trim(v_req_name), '[^a-zA-Z0-9]+', '-', 'g'));
      v_sub_slug := trim(both '-' from v_sub_slug);
      IF EXISTS (SELECT 1 FROM public.class_categories WHERE slug = v_sub_slug) THEN
        v_sub_slug := v_sub_slug || '-' || substring(gen_random_uuid()::text, 1, 6);
      END IF;

      SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_next_order
      FROM   public.class_categories
      WHERE  parent_id = v_retag_id;

      INSERT INTO public.class_categories (name, slug, icon, parent_id, sort_order, is_active)
      VALUES (v_req_name, v_sub_slug, NULL, v_retag_id, v_next_order, true)
      RETURNING id INTO v_new_sub_id;
    END IF;

    v_class_category_id := v_new_sub_id;

  -- ── new_category + parent target: create every requested sub ─────────────
  ELSIF v_req_type = 'new_category'
        AND v_retag_is_parent
        AND v_req_subcats IS NOT NULL
        AND array_length(v_req_subcats, 1) > 0 THEN

    SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_next_order
    FROM   public.class_categories
    WHERE  parent_id = v_retag_id;

    FOREACH v_subcat_name IN ARRAY v_req_subcats LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.class_categories
        WHERE  parent_id = v_retag_id
          AND  lower(name) = lower(trim(v_subcat_name))
      ) THEN
        v_sub_slug := lower(regexp_replace(trim(v_subcat_name), '[^a-zA-Z0-9]+', '-', 'g'));
        v_sub_slug := trim(both '-' from v_sub_slug);
        IF EXISTS (SELECT 1 FROM public.class_categories WHERE slug = v_sub_slug) THEN
          v_sub_slug := v_sub_slug || '-' || substring(gen_random_uuid()::text, 1, 6);
        END IF;

        INSERT INTO public.class_categories (name, slug, icon, parent_id, sort_order, is_active)
        VALUES (v_subcat_name, v_sub_slug, NULL, v_retag_id, v_next_order, true);

        v_next_order := v_next_order + 1;
      END IF;
    END LOOP;
    -- v_class_category_id stays as v_retag_id (the parent)
  END IF;

  -- Mark approved
  UPDATE public.category_requests SET
    status              = 'approved',
    created_category_id = v_class_category_id,
    updated_at          = NOW()
  WHERE id = p_request_id;

  -- Backfill classes that were waiting on this request
  UPDATE public.classes SET
    category_id                 = v_class_category_id,
    pending_category_request_id = NULL,
    updated_at                  = NOW()
  WHERE pending_category_request_id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_to_category_retag TO authenticated;
