-- 028_category_requests.sql
-- Provider-initiated category / sub-category request workflow.
-- Admin can approve (optionally editing name + icon), reject (with reason),
-- or re-tag (map to existing category, pending provider confirmation).
--
-- NOTE: apply manually in Supabase SQL editor:
--   https://supabase.com/dashboard/project/uspqewlpgdsvabturfes/sql
--
-- Safe to re-run: uses CREATE TABLE IF NOT EXISTS and DROP POLICY IF EXISTS,
-- so re-running does NOT wipe existing category_requests rows. RPC bodies are
-- always refreshed via CREATE OR REPLACE.

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.category_requests (
  id                       UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id              UUID          NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  request_type             TEXT          NOT NULL CHECK (request_type IN ('new_category', 'new_subcategory')),
  parent_category_id       UUID          REFERENCES public.class_categories(id),
  requested_name           TEXT          NOT NULL,
  requested_icon           TEXT,                          -- only relevant for new_category
  requested_subcategories  TEXT[],                        -- sub-cat names to auto-create on approval (new_category only)
  description              TEXT,
  -- Review outcome
  status                   TEXT          NOT NULL DEFAULT 'pending'
                                         CHECK (status IN ('pending','approved','rejected','retag_pending','retag_declined')),
  admin_notes              TEXT,                          -- rejection reason OR retag explanation
  admin_modified_name      TEXT,
  admin_modified_icon      TEXT,
  retag_category_id        UUID          REFERENCES public.class_categories(id),
  reviewed_by              UUID          REFERENCES public.users(id),
  reviewed_at              TIMESTAMPTZ,
  created_category_id      UUID          REFERENCES public.class_categories(id),
  requested_at             TIMESTAMPTZ   DEFAULT NOW(),
  updated_at               TIMESTAMPTZ   DEFAULT NOW(),
  -- Provider can soft-hide non-pending requests from their dashboard.
  -- Enforced by trigger below: pending requests must keep this NULL.
  dismissed_at             TIMESTAMPTZ
);

-- Idempotent re-add for older DBs created before dismissed_at existed
ALTER TABLE public.category_requests
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS category_requests_provider_active_idx
  ON public.category_requests (provider_id, status, dismissed_at);

-- Guard: a pending request must keep dismissed_at NULL.
CREATE OR REPLACE FUNCTION public.cat_req_block_dismiss_pending()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.dismissed_at IS NOT NULL AND NEW.status = 'pending' THEN
    RAISE EXCEPTION 'cannot dismiss a pending category request';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cat_req_block_dismiss_pending_trg ON public.category_requests;
CREATE TRIGGER cat_req_block_dismiss_pending_trg
  BEFORE INSERT OR UPDATE OF dismissed_at, status
  ON public.category_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.cat_req_block_dismiss_pending();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.category_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies so re-running refreshes them without altering row data
DROP POLICY IF EXISTS cat_req_provider_select  ON public.category_requests;
DROP POLICY IF EXISTS cat_req_provider_insert  ON public.category_requests;
DROP POLICY IF EXISTS cat_req_provider_update  ON public.category_requests;
DROP POLICY IF EXISTS cat_req_admin_select     ON public.category_requests;
DROP POLICY IF EXISTS cat_req_admin_update     ON public.category_requests;

-- Providers see / insert / update their own requests.
-- IMPORTANT: service_providers.user_id stores public.users.id, NOT auth.uid().
-- Always resolve through public.current_user_id().
CREATE POLICY cat_req_provider_select ON public.category_requests
  FOR SELECT TO authenticated
  USING (provider_id IN (
    SELECT id FROM public.service_providers WHERE user_id = public.current_user_id()
  ));

CREATE POLICY cat_req_provider_insert ON public.category_requests
  FOR INSERT TO authenticated
  WITH CHECK (provider_id IN (
    SELECT id FROM public.service_providers WHERE user_id = public.current_user_id()
  ));

CREATE POLICY cat_req_provider_update ON public.category_requests
  FOR UPDATE TO authenticated
  USING (provider_id IN (
    SELECT id FROM public.service_providers WHERE user_id = public.current_user_id()
  ));

-- Platform admins see / update all requests.
-- IMPORTANT: compare auth.uid() against users.auth_id, NOT users.id.
CREATE POLICY cat_req_admin_select ON public.category_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid() AND u.is_platform_admin = true
    )
  );

CREATE POLICY cat_req_admin_update ON public.category_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid() AND u.is_platform_admin = true
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.category_requests TO authenticated;

-- ── Helper: safe notify ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._cat_notify(
  p_user_id UUID,
  p_title   TEXT,
  p_body    TEXT,
  p_type    TEXT,
  p_ref_id  UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.send_notification(p_user_id, p_title, p_body, p_type, 'category_request', p_ref_id);
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- ── RPC: approve_category_request ─────────────────────────────────────────────
-- Creates the category, auto-creates any requested_subcategories, marks
-- request approved, backfills classes that referenced the pending request,
-- notifies provider.

CREATE OR REPLACE FUNCTION public.approve_category_request(
  p_request_id    UUID,
  p_admin_user_id UUID,
  p_final_name    TEXT,
  p_final_icon    TEXT  DEFAULT NULL,
  p_parent_id     UUID  DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  -- Build a unique slug from the final name
  v_slug := lower(regexp_replace(trim(p_final_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  IF EXISTS (SELECT 1 FROM public.class_categories WHERE slug = v_slug) THEN
    v_slug := v_slug || '-' || substring(gen_random_uuid()::text, 1, 6);
  END IF;

  -- Determine sort_order for the new category
  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_next_order
  FROM   public.class_categories
  WHERE  (parent_id IS NULL) = (p_parent_id IS NULL);

  -- Create the main category
  INSERT INTO public.class_categories (name, slug, icon, parent_id, sort_order, is_active)
  VALUES (p_final_name, v_slug, p_final_icon, p_parent_id, v_next_order, true)
  RETURNING id INTO v_new_cat_id;

  -- Auto-create requested sub-categories (new_category requests only)
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

  -- Mark the request approved
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

  -- Find the provider's user account
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

GRANT EXECUTE ON FUNCTION public.approve_category_request TO authenticated;

-- ── RPC: reject_category_request ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reject_category_request(
  p_request_id    UUID,
  p_admin_user_id UUID,
  p_reason        TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_req_name  TEXT;
  v_prov_user UUID;
BEGIN
  SELECT requested_name INTO v_req_name
  FROM   public.category_requests WHERE id = p_request_id;

  UPDATE public.category_requests SET
    status      = 'rejected',
    admin_notes = p_reason,
    reviewed_by = p_admin_user_id,
    reviewed_at = NOW(),
    updated_at  = NOW()
  WHERE id = p_request_id;

  SELECT u.id INTO v_prov_user
  FROM   public.category_requests cr
  JOIN   public.service_providers sp ON sp.id = cr.provider_id
  JOIN   public.users u              ON u.id  = sp.user_id
  WHERE  cr.id = p_request_id;

  PERFORM public._cat_notify(
    v_prov_user,
    'Category Request Declined',
    'Your "' || v_req_name || '" request was declined. Reason: ' || p_reason,
    'category_rejected',
    p_request_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_category_request TO authenticated;

-- ── RPC: retag_category_request ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.retag_category_request(
  p_request_id    UUID,
  p_admin_user_id UUID,
  p_retag_cat_id  UUID,
  p_notes         TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_req_name      TEXT;
  v_existing_name TEXT;
  v_prov_user     UUID;
BEGIN
  SELECT requested_name INTO v_req_name
  FROM   public.category_requests WHERE id = p_request_id;

  SELECT name INTO v_existing_name
  FROM   public.class_categories WHERE id = p_retag_cat_id;

  UPDATE public.category_requests SET
    status            = 'retag_pending',
    retag_category_id = p_retag_cat_id,
    admin_notes       = p_notes,
    reviewed_by       = p_admin_user_id,
    reviewed_at       = NOW(),
    updated_at        = NOW()
  WHERE id = p_request_id;

  SELECT u.id INTO v_prov_user
  FROM   public.category_requests cr
  JOIN   public.service_providers sp ON sp.id = cr.provider_id
  JOIN   public.users u              ON u.id  = sp.user_id
  WHERE  cr.id = p_request_id;

  PERFORM public._cat_notify(
    v_prov_user,
    'Category Re-tag Suggestion',
    'Admin suggests mapping "' || v_req_name || '" → existing "' || v_existing_name || '". Visit My Category Requests to Accept or Decline.',
    'category_retag_suggested',
    p_request_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.retag_category_request TO authenticated;

-- ── RPC: respond_to_category_retag ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.respond_to_category_retag(
  p_request_id UUID,
  p_accepted   BOOLEAN
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_accepted THEN
    UPDATE public.category_requests SET
      status              = 'approved',
      created_category_id = retag_category_id,
      updated_at          = NOW()
    WHERE id = p_request_id;
  ELSE
    UPDATE public.category_requests SET
      status            = 'retag_declined',
      retag_category_id = NULL,
      updated_at        = NOW()
    WHERE id = p_request_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_to_category_retag TO authenticated;
