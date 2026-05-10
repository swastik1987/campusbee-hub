-- 028_category_requests.sql
-- Provider-initiated category / sub-category request workflow.
-- Admin can approve (optionally editing name + icon), reject (with reason),
-- or re-tag (map to existing category, pending provider confirmation).
--
-- NOTE: apply manually in Supabase SQL editor:
--   https://supabase.com/dashboard/project/uspqewlpgdsvabturfes/sql
--
-- Safe to re-run: drops the table + RPCs before recreating.

-- ── Drop old objects first (idempotent re-run) ────────────────────────────────

DROP TABLE IF EXISTS public.category_requests CASCADE;

DROP FUNCTION IF EXISTS public._cat_notify(UUID, TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.approve_category_request(UUID, UUID, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.reject_category_request(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.retag_category_request(UUID, UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.respond_to_category_retag(UUID, BOOLEAN);

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE public.category_requests (
  id                   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id          UUID        NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  requested_by         UUID        NOT NULL REFERENCES public.users(id),
  request_type         TEXT        NOT NULL CHECK (request_type IN ('new_category', 'new_subcategory')),
  parent_category_id   UUID        REFERENCES public.class_categories(id),
  requested_name       TEXT        NOT NULL,
  requested_icon       TEXT,
  description          TEXT,
  -- Review outcome
  status               TEXT        NOT NULL DEFAULT 'pending'
                                   CHECK (status IN ('pending','approved','rejected','retag_pending','retag_declined')),
  admin_notes          TEXT,               -- rejection reason OR retag explanation
  admin_modified_name  TEXT,               -- admin can rename before approving
  admin_modified_icon  TEXT,               -- admin can re-icon before approving
  retag_category_id    UUID        REFERENCES public.class_categories(id),  -- existing cat admin maps to
  reviewed_by          UUID        REFERENCES public.users(id),
  reviewed_at          TIMESTAMPTZ,
  created_category_id  UUID        REFERENCES public.class_categories(id),  -- populated on approval
  requested_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.category_requests ENABLE ROW LEVEL SECURITY;

-- Providers see their own requests
CREATE POLICY "cat_req_provider_select" ON public.category_requests
  FOR SELECT USING (
    provider_id IN (SELECT id FROM public.service_providers WHERE user_id = auth.uid())
  );

-- Platform admins see all requests
CREATE POLICY "cat_req_admin_select" ON public.category_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_platform_admin = true)
  );

-- Providers insert their own requests
CREATE POLICY "cat_req_provider_insert" ON public.category_requests
  FOR INSERT WITH CHECK (
    provider_id IN (SELECT id FROM public.service_providers WHERE user_id = auth.uid())
    AND requested_by = auth.uid()
  );

-- Providers update their own (for retag accept / decline)
CREATE POLICY "cat_req_provider_update" ON public.category_requests
  FOR UPDATE USING (
    provider_id IN (SELECT id FROM public.service_providers WHERE user_id = auth.uid())
  );

-- Platform admins update all (for review actions)
CREATE POLICY "cat_req_admin_update" ON public.category_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_platform_admin = true)
  );

GRANT SELECT, INSERT, UPDATE ON public.category_requests TO authenticated;

-- ── Helper: safe notify (wraps send_notification so missing types don't abort) ──

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
  NULL; -- best-effort; never abort the main operation
END;
$$;

-- ── RPC: approve_category_request ─────────────────────────────────────────────
-- Atomically creates a row in class_categories, marks the request approved,
-- and notifies the provider.

CREATE OR REPLACE FUNCTION public.approve_category_request(
  p_request_id    UUID,
  p_admin_user_id UUID,
  p_final_name    TEXT,
  p_final_icon    TEXT    DEFAULT NULL,
  p_parent_id     UUID    DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_slug       TEXT;
  v_new_cat_id UUID;
  v_req_name   TEXT;
  v_prov_user  UUID;
  v_next_order INT;
BEGIN
  SELECT requested_name INTO v_req_name
  FROM public.category_requests WHERE id = p_request_id;

  -- Build a unique slug from the final name
  v_slug := lower(regexp_replace(trim(p_final_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  IF EXISTS (SELECT 1 FROM public.class_categories WHERE slug = v_slug) THEN
    v_slug := v_slug || '-' || substring(gen_random_uuid()::text, 1, 6);
  END IF;

  -- Determine next sort_order
  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_next_order
  FROM public.class_categories
  WHERE (parent_id IS NULL) = (p_parent_id IS NULL);

  -- Create the new category
  INSERT INTO public.class_categories (name, slug, icon, parent_id, sort_order, is_active)
  VALUES (p_final_name, v_slug, p_final_icon, p_parent_id, v_next_order, true)
  RETURNING id INTO v_new_cat_id;

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

  -- Find the requesting user
  SELECT u.id INTO v_prov_user
  FROM public.category_requests cr
  JOIN public.service_providers sp ON sp.id = cr.provider_id
  JOIN public.users u ON u.id = sp.user_id
  WHERE cr.id = p_request_id;

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
  FROM public.category_requests WHERE id = p_request_id;

  UPDATE public.category_requests SET
    status      = 'rejected',
    admin_notes = p_reason,
    reviewed_by = p_admin_user_id,
    reviewed_at = NOW(),
    updated_at  = NOW()
  WHERE id = p_request_id;

  SELECT u.id INTO v_prov_user
  FROM public.category_requests cr
  JOIN public.service_providers sp ON sp.id = cr.provider_id
  JOIN public.users u ON u.id = sp.user_id
  WHERE cr.id = p_request_id;

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
-- Admin maps the request to an existing category; provider must confirm.

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
  FROM public.category_requests WHERE id = p_request_id;

  SELECT name INTO v_existing_name
  FROM public.class_categories WHERE id = p_retag_cat_id;

  UPDATE public.category_requests SET
    status            = 'retag_pending',
    retag_category_id = p_retag_cat_id,
    admin_notes       = p_notes,
    reviewed_by       = p_admin_user_id,
    reviewed_at       = NOW(),
    updated_at        = NOW()
  WHERE id = p_request_id;

  SELECT u.id INTO v_prov_user
  FROM public.category_requests cr
  JOIN public.service_providers sp ON sp.id = cr.provider_id
  JOIN public.users u ON u.id = sp.user_id
  WHERE cr.id = p_request_id;

  PERFORM public._cat_notify(
    v_prov_user,
    'Category Re-tag Suggestion',
    'Admin suggests mapping "' || v_req_name || '" → existing category "' || v_existing_name || '". Visit My Category Requests to Accept or Decline.',
    'category_retag_suggested',
    p_request_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.retag_category_request TO authenticated;

-- ── RPC: respond_to_category_retag ────────────────────────────────────────────
-- Provider accepts → request approved, points created_category_id at the
-- existing category.  Provider declines → status = retag_declined, provider
-- may submit a new request.

CREATE OR REPLACE FUNCTION public.respond_to_category_retag(
  p_request_id UUID,
  p_accepted   BOOLEAN
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_accepted THEN
    UPDATE public.category_requests SET
      status              = 'approved',
      created_category_id = retag_category_id, -- point at the existing cat
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
