-- ============================================================
-- 022: Category requests + Certifications
-- ============================================================

-- Allow classes.category_id to be NULL (needed for pending-category classes)
ALTER TABLE public.classes
  ALTER COLUMN category_id DROP NOT NULL;

-- Add pending_category_request_id to classes
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS pending_category_request_id UUID;

-- ── Category Requests ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.category_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id           UUID NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  description           TEXT,
  icon                  TEXT,
  parent_category_id    UUID REFERENCES public.class_categories(id) ON DELETE SET NULL,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason      TEXT,
  requested_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by           UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at           TIMESTAMPTZ
);

-- FK from classes back to category_requests (added after table created)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'classes_pending_category_request_id_fkey'
      AND conrelid = 'public.classes'::regclass
  ) THEN
    ALTER TABLE public.classes
      ADD CONSTRAINT classes_pending_category_request_id_fkey
        FOREIGN KEY (pending_category_request_id)
        REFERENCES public.category_requests(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── Certifications ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.certifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type          TEXT NOT NULL CHECK (owner_type IN ('provider', 'trainer')),
  provider_id         UUID REFERENCES public.service_providers(id) ON DELETE CASCADE,
  trainer_id          UUID REFERENCES public.trainers(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  issuing_authority   TEXT,
  year_obtained       INT,
  image_url           TEXT NOT NULL,
  moderation_status   TEXT NOT NULL DEFAULT 'pending'
                        CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'in_review')),
  moderation_notes    TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Storage bucket ──────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('certifications', 'certifications', true)
ON CONFLICT (id) DO NOTHING;

-- ── RLS: category_requests ─────────────────────────────────
ALTER TABLE public.category_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "providers_read_own_cat_requests" ON public.category_requests;
CREATE POLICY "providers_read_own_cat_requests" ON public.category_requests
  FOR SELECT USING (
    provider_id IN (
      SELECT id FROM public.service_providers WHERE user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND is_platform_admin = true)
  );

DROP POLICY IF EXISTS "providers_insert_cat_requests" ON public.category_requests;
CREATE POLICY "providers_insert_cat_requests" ON public.category_requests
  FOR INSERT WITH CHECK (
    provider_id IN (
      SELECT id FROM public.service_providers WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "platform_admin_manage_cat_requests" ON public.category_requests;
CREATE POLICY "platform_admin_manage_cat_requests" ON public.category_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND is_platform_admin = true)
  );

-- ── RLS: certifications ────────────────────────────────────
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "providers_manage_own_certs" ON public.certifications;
CREATE POLICY "providers_manage_own_certs" ON public.certifications
  FOR ALL USING (
    (owner_type = 'provider' AND provider_id IN (
      SELECT id FROM public.service_providers WHERE user_id = auth.uid()
    ))
    OR
    (owner_type = 'trainer' AND trainer_id IN (
      SELECT t.id FROM public.trainers t
      JOIN public.service_providers sp ON t.provider_id = sp.id
      WHERE sp.user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "public_read_approved_certs" ON public.certifications;
CREATE POLICY "public_read_approved_certs" ON public.certifications
  FOR SELECT USING (moderation_status = 'approved');

-- ── Storage policies: certifications ──────────────────────
DROP POLICY IF EXISTS "cert_upload" ON storage.objects;
CREATE POLICY "cert_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'certifications' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "cert_read" ON storage.objects;
CREATE POLICY "cert_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'certifications');

DROP POLICY IF EXISTS "cert_delete" ON storage.objects;
CREATE POLICY "cert_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'certifications' AND auth.uid() IS NOT NULL);

-- ── Grants ─────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON public.category_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certifications TO authenticated;
GRANT SELECT ON public.category_requests TO anon;
GRANT SELECT ON public.certifications TO anon;
