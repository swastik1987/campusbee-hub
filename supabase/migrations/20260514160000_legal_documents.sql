-- ============================================================================
-- Legal documents (Terms & Conditions, Privacy Policy) + acceptance audit trail
-- ----------------------------------------------------------------------------
-- Adds:
--   1. legal_documents          — versioned, append-only, anon-readable (active only)
--   2. legal_acceptances        — per-user acceptance record (IP + UA + fingerprint)
--   3. legal-documents bucket   — original .docx, admin-only, no DELETE policy
--   4. publish_legal_document() — admin RPC; new version, deactivates prior
--   5. record_legal_acceptance()— authenticated RPC; ties user to active version
--   6. get_active_legal_document() — public RPC; returns the active row (HTML)
--
-- Apply manually in Supabase SQL editor.
-- ============================================================================

-- ── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.legal_documents (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type            TEXT         NOT NULL CHECK (doc_type IN ('terms','privacy')),
  version             INTEGER      NOT NULL,
  title               TEXT         NOT NULL,
  html_content        TEXT         NOT NULL,
  original_file_path  TEXT,
  uploaded_by         UUID         REFERENCES public.users(id),
  uploaded_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  is_active           BOOLEAN      NOT NULL DEFAULT false,
  UNIQUE (doc_type, version)
);

-- Exactly one active row per doc_type
CREATE UNIQUE INDEX IF NOT EXISTS legal_documents_one_active_per_type
  ON public.legal_documents (doc_type)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS legal_documents_type_uploaded_at_idx
  ON public.legal_documents (doc_type, uploaded_at DESC);

CREATE TABLE IF NOT EXISTS public.legal_acceptances (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  doc_type              TEXT         NOT NULL CHECK (doc_type IN ('terms','privacy')),
  document_version_id   UUID         NOT NULL REFERENCES public.legal_documents(id),
  ip_address            INET,
  user_agent            TEXT,
  device_fingerprint    TEXT,
  accepted_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS legal_acceptances_user_idx
  ON public.legal_acceptances (user_id, accepted_at DESC);

CREATE INDEX IF NOT EXISTS legal_acceptances_version_idx
  ON public.legal_acceptances (document_version_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.legal_documents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;

-- legal_documents
-- Anonymous + authenticated can read ACTIVE docs (so /auth drawers work).
-- Platform admin can read ALL versions (history).
-- Inserts/updates flow exclusively through the publish_legal_document RPC; no
-- direct table INSERT/UPDATE policies (RPC runs SECURITY DEFINER).
-- No DELETE policy = nobody can delete (immutability).

DROP POLICY IF EXISTS legal_docs_active_anon_select   ON public.legal_documents;
DROP POLICY IF EXISTS legal_docs_admin_all_select     ON public.legal_documents;

CREATE POLICY legal_docs_active_anon_select ON public.legal_documents
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

CREATE POLICY legal_docs_admin_all_select ON public.legal_documents
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

-- legal_acceptances
-- User can read their own acceptances. Admin can read all.
-- Inserts flow through record_legal_acceptance RPC (SECURITY DEFINER).
-- No UPDATE, no DELETE policies = append-only audit log.

DROP POLICY IF EXISTS legal_accept_self_select   ON public.legal_acceptances;
DROP POLICY IF EXISTS legal_accept_admin_select  ON public.legal_acceptances;

CREATE POLICY legal_accept_self_select ON public.legal_acceptances
  FOR SELECT TO authenticated
  USING (user_id = public.current_user_id());

CREATE POLICY legal_accept_admin_select ON public.legal_acceptances
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

GRANT SELECT ON public.legal_documents   TO anon, authenticated;
GRANT SELECT ON public.legal_acceptances TO authenticated;

-- ── RPC: publish_legal_document ──────────────────────────────────────────────
-- Admin-only. Bumps version, deactivates prior active, inserts new active row.

CREATE OR REPLACE FUNCTION public.publish_legal_document(
  p_doc_type   TEXT,
  p_title      TEXT,
  p_html       TEXT,
  p_file_path  TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  v_admin_id   UUID;
  v_next_ver   INT;
  v_new_id     UUID;
BEGIN
  IF p_doc_type NOT IN ('terms','privacy') THEN
    RAISE EXCEPTION 'Invalid doc_type: %', p_doc_type;
  END IF;

  v_admin_id := public.current_user_id();
  IF v_admin_id IS NULL OR NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Forbidden — platform admin only';
  END IF;

  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Title is required';
  END IF;
  IF p_html IS NULL OR length(trim(p_html)) = 0 THEN
    RAISE EXCEPTION 'HTML content is required';
  END IF;

  -- Determine next version
  SELECT COALESCE(MAX(version), 0) + 1
    INTO v_next_ver
    FROM public.legal_documents
   WHERE doc_type = p_doc_type;

  -- Deactivate prior active row(s) for this doc_type
  UPDATE public.legal_documents
     SET is_active = false
   WHERE doc_type = p_doc_type AND is_active = true;

  INSERT INTO public.legal_documents
    (doc_type, version, title, html_content, original_file_path, uploaded_by, is_active)
  VALUES
    (p_doc_type, v_next_ver, p_title, p_html, p_file_path, v_admin_id, true)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_legal_document(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ── RPC: record_legal_acceptance ─────────────────────────────────────────────
-- Authenticated. Looks up the active document for the given doc_type and
-- inserts an acceptance row tying the current user to it. Silently no-ops if
-- there is no active document of that type yet.

CREATE OR REPLACE FUNCTION public.record_legal_acceptance(
  p_doc_type    TEXT,
  p_ip          TEXT DEFAULT NULL,
  p_user_agent  TEXT DEFAULT NULL,
  p_fingerprint TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  v_user_id    UUID;
  v_version_id UUID;
  v_new_id     UUID;
BEGIN
  IF p_doc_type NOT IN ('terms','privacy') THEN
    RAISE EXCEPTION 'Invalid doc_type: %', p_doc_type;
  END IF;

  v_user_id := public.current_user_id();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_version_id
    FROM public.legal_documents
   WHERE doc_type = p_doc_type AND is_active = true
   LIMIT 1;

  IF v_version_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.legal_acceptances
    (user_id, doc_type, document_version_id, ip_address, user_agent, device_fingerprint)
  VALUES
    (v_user_id, p_doc_type, v_version_id,
     NULLIF(p_ip, '')::INET, p_user_agent, p_fingerprint)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_legal_acceptance(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ── RPC: get_active_legal_document ───────────────────────────────────────────
-- Public (anon + authenticated). Returns the active row for a doc_type so the
-- /auth drawers can render before signup. Returns NULL row if none published.

CREATE OR REPLACE FUNCTION public.get_active_legal_document(p_doc_type TEXT)
RETURNS TABLE (
  id            UUID,
  doc_type      TEXT,
  version       INTEGER,
  title         TEXT,
  html_content  TEXT,
  uploaded_at   TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, doc_type, version, title, html_content, uploaded_at
    FROM public.legal_documents
   WHERE doc_type = p_doc_type AND is_active = true
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_legal_document(TEXT) TO anon, authenticated;

-- ── Storage bucket: legal-documents ──────────────────────────────────────────
-- Private bucket. Original .docx files live here, admin-only. The rendered
-- HTML is stored inline in legal_documents.html_content, so anonymous users
-- never need to read this bucket.

INSERT INTO storage.buckets (id, name, public)
VALUES ('legal-documents', 'legal-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS legal_docs_admin_read   ON storage.objects;
DROP POLICY IF EXISTS legal_docs_admin_insert ON storage.objects;

CREATE POLICY legal_docs_admin_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'legal-documents'
    AND public.is_platform_admin()
  );

CREATE POLICY legal_docs_admin_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'legal-documents'
    AND public.is_platform_admin()
  );

-- NOTE: no UPDATE / DELETE policies on this bucket → uploads are immutable.
