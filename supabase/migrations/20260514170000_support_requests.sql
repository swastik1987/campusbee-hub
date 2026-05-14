-- ============================================================================
-- Support requests + recommendations (user → platform admin)
-- ----------------------------------------------------------------------------
-- Adds:
--   1. support_requests            — user-raised tickets and recommendations
--   2. support_request_attachments — up to 5 files per request (jpg/png/pdf, ≤5MB)
--   3. support-attachments bucket  — private; owner + admin SELECT, owner INSERT
--   4. resolve_support_request()   — admin RPC; marks resolved + sends notification
--
-- Apply manually in Supabase SQL editor.
-- ============================================================================

-- ── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.support_requests (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type                 TEXT         NOT NULL CHECK (type IN ('support','recommendation')),
  subject              TEXT         NOT NULL CHECK (length(trim(subject)) BETWEEN 1 AND 120),
  body                 TEXT         NOT NULL CHECK (length(trim(body))    BETWEEN 1 AND 2000),
  status               TEXT         NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  resolved_by          UUID         REFERENCES public.users(id),
  resolved_at          TIMESTAMPTZ,
  resolution_comment   TEXT,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_requests_user_idx
  ON public.support_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS support_requests_status_idx
  ON public.support_requests (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.support_request_attachments (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  support_request_id   UUID         NOT NULL REFERENCES public.support_requests(id) ON DELETE CASCADE,
  file_path            TEXT         NOT NULL,
  file_name            TEXT         NOT NULL,
  mime_type            TEXT         NOT NULL
                                      CHECK (mime_type IN ('image/jpeg','image/png','application/pdf')),
  size_bytes           INTEGER      NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_request_attachments_request_idx
  ON public.support_request_attachments (support_request_id);

-- Enforce max 5 attachments per request
CREATE OR REPLACE FUNCTION public._support_attachment_limit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (
    SELECT count(*)
      FROM public.support_request_attachments
     WHERE support_request_id = NEW.support_request_id
  ) >= 5 THEN
    RAISE EXCEPTION 'Maximum of 5 attachments per support request';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_attachment_limit_trg ON public.support_request_attachments;

CREATE TRIGGER support_attachment_limit_trg
  BEFORE INSERT ON public.support_request_attachments
  FOR EACH ROW EXECUTE FUNCTION public._support_attachment_limit();

-- updated_at trigger on support_requests
CREATE OR REPLACE FUNCTION public._support_requests_touch_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_requests_touch_updated_trg ON public.support_requests;

CREATE TRIGGER support_requests_touch_updated_trg
  BEFORE UPDATE ON public.support_requests
  FOR EACH ROW EXECUTE FUNCTION public._support_requests_touch_updated();

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.support_requests             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_request_attachments  ENABLE ROW LEVEL SECURITY;

-- support_requests
DROP POLICY IF EXISTS support_req_self_select   ON public.support_requests;
DROP POLICY IF EXISTS support_req_admin_select  ON public.support_requests;
DROP POLICY IF EXISTS support_req_self_insert   ON public.support_requests;
DROP POLICY IF EXISTS support_req_admin_update  ON public.support_requests;

CREATE POLICY support_req_self_select ON public.support_requests
  FOR SELECT TO authenticated
  USING (user_id = public.current_user_id());

CREATE POLICY support_req_admin_select ON public.support_requests
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

CREATE POLICY support_req_self_insert ON public.support_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_user_id());

-- Admin updates (status/resolution) flow through resolve_support_request RPC.
-- Provide an UPDATE policy anyway for direct admin tweaks if needed.
CREATE POLICY support_req_admin_update ON public.support_requests
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin());

-- support_request_attachments
DROP POLICY IF EXISTS support_att_owner_select ON public.support_request_attachments;
DROP POLICY IF EXISTS support_att_admin_select ON public.support_request_attachments;
DROP POLICY IF EXISTS support_att_owner_insert ON public.support_request_attachments;

CREATE POLICY support_att_owner_select ON public.support_request_attachments
  FOR SELECT TO authenticated
  USING (
    support_request_id IN (
      SELECT id FROM public.support_requests
       WHERE user_id = public.current_user_id()
    )
  );

CREATE POLICY support_att_admin_select ON public.support_request_attachments
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

CREATE POLICY support_att_owner_insert ON public.support_request_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    support_request_id IN (
      SELECT id FROM public.support_requests
       WHERE user_id = public.current_user_id()
    )
  );

GRANT SELECT, INSERT         ON public.support_requests            TO authenticated;
GRANT SELECT, INSERT         ON public.support_request_attachments TO authenticated;
GRANT UPDATE                 ON public.support_requests            TO authenticated;

-- ── RPC: resolve_support_request ─────────────────────────────────────────────
-- Admin-only. Marks the request resolved with an optional comment and notifies
-- the original user.

CREATE OR REPLACE FUNCTION public.resolve_support_request(
  p_request_id UUID,
  p_comment    TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  v_admin_id   UUID;
  v_user_id    UUID;
  v_subject    TEXT;
  v_type       TEXT;
BEGIN
  v_admin_id := public.current_user_id();
  IF v_admin_id IS NULL OR NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden — platform admin only';
  END IF;

  SELECT user_id, subject, type
    INTO v_user_id, v_subject, v_type
    FROM public.support_requests
   WHERE id = p_request_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Support request not found: %', p_request_id;
  END IF;

  UPDATE public.support_requests
     SET status             = 'resolved',
         resolved_by        = v_admin_id,
         resolved_at        = now(),
         resolution_comment = NULLIF(trim(COALESCE(p_comment, '')), '')
   WHERE id = p_request_id;

  PERFORM public.send_notification(
    v_user_id,
    CASE WHEN v_type = 'recommendation'
         THEN 'Your recommendation has been reviewed'
         ELSE 'Your support request has been resolved'
    END,
    COALESCE(
      'Subject: ' || v_subject
      || CASE
           WHEN NULLIF(trim(COALESCE(p_comment, '')), '') IS NOT NULL
             THEN E'\n\nAdmin note: ' || trim(p_comment)
           ELSE ''
         END,
      'Subject: ' || v_subject
    ),
    'support_resolved',
    'support_request',
    p_request_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_support_request(UUID, TEXT) TO authenticated;

-- ── Storage bucket: support-attachments ──────────────────────────────────────
-- Private. Object paths: {user_id}/{request_id}/{uuid}-{filename}.
-- Owner can read + insert; platform admin can read.
-- No UPDATE / DELETE policies → attachments are immutable.

INSERT INTO storage.buckets (id, name, public)
VALUES ('support-attachments', 'support-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS support_att_storage_owner_read   ON storage.objects;
DROP POLICY IF EXISTS support_att_storage_admin_read   ON storage.objects;
DROP POLICY IF EXISTS support_att_storage_owner_insert ON storage.objects;

-- Object's first path segment is the user's internal users.id (UUID string).
CREATE POLICY support_att_storage_owner_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = public.current_user_id()::text
  );

CREATE POLICY support_att_storage_admin_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND public.is_platform_admin()
  );

CREATE POLICY support_att_storage_owner_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'support-attachments'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = public.current_user_id()::text
  );
