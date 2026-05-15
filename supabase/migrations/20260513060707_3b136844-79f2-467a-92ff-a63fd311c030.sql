
-- 1) Fix admin RLS on category_requests (was comparing users.id to auth.uid(); should be auth_id)
DROP POLICY IF EXISTS cat_req_admin_select ON public.category_requests;
DROP POLICY IF EXISTS cat_req_admin_update ON public.category_requests;

CREATE POLICY cat_req_admin_select
  ON public.category_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid() AND u.is_platform_admin = true
    )
  );

CREATE POLICY cat_req_admin_update
  ON public.category_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid() AND u.is_platform_admin = true
    )
  );

-- 2) On approval, backfill any classes that referenced this pending request
CREATE OR REPLACE FUNCTION public.approve_category_request(
  p_request_id    uuid,
  p_admin_user_id uuid,
  p_final_name    text,
  p_final_icon    text DEFAULT NULL,
  p_parent_id     uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug          TEXT;
  v_sub_slug      TEXT;
  v_new_cat_id    UUID;
  v_req_name      TEXT;
  v_req_subcats   TEXT[];
  v_prov_user     UUID;
  v_next_order    INT;
  v_subcat_name   TEXT;
  v_subcat_order  INT := 1;
BEGIN
  SELECT requested_name, requested_subcategories
  INTO   v_req_name, v_req_subcats
  FROM   public.category_requests
  WHERE  id = p_request_id;

  v_slug := lower(regexp_replace(trim(p_final_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  IF EXISTS (SELECT 1 FROM public.class_categories WHERE slug = v_slug) THEN
    v_slug := v_slug || '-' || substring(gen_random_uuid()::text, 1, 6);
  END IF;

  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_next_order
  FROM   public.class_categories
  WHERE  (parent_id IS NULL) = (p_parent_id IS NULL);

  INSERT INTO public.class_categories (name, slug, icon, parent_id, sort_order, is_active)
  VALUES (p_final_name, v_slug, p_final_icon, p_parent_id, v_next_order, true)
  RETURNING id INTO v_new_cat_id;

  IF v_req_subcats IS NOT NULL AND array_length(v_req_subcats, 1) > 0 THEN
    FOREACH v_subcat_name IN ARRAY v_req_subcats LOOP
      v_sub_slug := lower(regexp_replace(trim(v_subcat_name), '[^a-zA-Z0-9]+', '-', 'g'));
      v_sub_slug := trim(both '-' from v_sub_slug);
      IF EXISTS (SELECT 1 FROM public.class_categories WHERE slug = v_sub_slug) THEN
        v_sub_slug := v_sub_slug || '-' || substring(gen_random_uuid()::text, 1, 6);
      END IF;
      INSERT INTO public.class_categories (name, slug, icon, parent_id, sort_order, is_active)
      VALUES (v_subcat_name, v_sub_slug, NULL, v_new_cat_id, v_subcat_order, true);
      v_subcat_order := v_subcat_order + 1;
    END LOOP;
  END IF;

  UPDATE public.category_requests SET
    status              = 'approved',
    admin_modified_name = p_final_name,
    admin_modified_icon = p_final_icon,
    reviewed_by         = p_admin_user_id,
    reviewed_at         = NOW(),
    created_category_id = v_new_cat_id,
    updated_at          = NOW()
  WHERE id = p_request_id;

  -- Backfill classes that were waiting on this request so they can be published
  UPDATE public.classes
  SET    category_id                 = v_new_cat_id,
         pending_category_request_id = NULL,
         updated_at                  = NOW()
  WHERE  pending_category_request_id = p_request_id;

  SELECT u.id INTO v_prov_user
  FROM   public.category_requests cr
  JOIN   public.service_providers sp ON sp.id = cr.provider_id
  JOIN   public.users u              ON u.id  = sp.user_id
  WHERE  cr.id = p_request_id;

  PERFORM public._cat_notify(
    v_prov_user,
    'Category Approved! 🎉',
    'Your "' || v_req_name || '" request has been approved. You can now create classes under it.',
    'category_approved',
    p_request_id
  );

  RETURN v_new_cat_id;
END;
$$;
