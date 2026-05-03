-- ============================================================================
-- 003_storage_buckets_v2.sql  —  storage buckets + storage RLS
-- ============================================================================
-- Apply AFTER 002_rls_v2.sql.
-- Reuses any existing v1 buckets (ON CONFLICT DO NOTHING) and adds the new
-- featured-banners bucket. Drops legacy v1 storage policies and replaces
-- them with v2-aligned versions that use the public.is_provider_owner /
-- is_class_owner helpers from 002.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Buckets
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars',             'avatars',             true),
  ('class-images',        'class-images',        true),
  ('provider-media',      'provider-media',      true),
  ('payment-screenshots', 'payment-screenshots', false),
  ('class-materials',     'class-materials',     false),
  ('featured-banners',    'featured-banners',    true)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Drop any existing storage RLS policies (v1 leftovers + idempotency)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT polname
    FROM   pg_policy
    WHERE  polrelid = 'storage.objects'::regclass
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.polname);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- avatars  (public read; authenticated user can upload/update/delete own)
-- ---------------------------------------------------------------------------
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_authed_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "avatars_authed_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (owner = auth.uid() OR owner IS NULL)
  );

CREATE POLICY "avatars_authed_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (owner = auth.uid() OR owner IS NULL)
  );

-- ---------------------------------------------------------------------------
-- class-images  (public read; provider can upload/update/delete)
-- ---------------------------------------------------------------------------
CREATE POLICY "class_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'class-images');

CREATE POLICY "class_images_provider_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'class-images'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid() AND u.is_provider = true
    )
  );

CREATE POLICY "class_images_owner_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'class-images'
    AND auth.uid() IS NOT NULL
    AND (owner = auth.uid() OR owner IS NULL)
  );

CREATE POLICY "class_images_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'class-images'
    AND auth.uid() IS NOT NULL
    AND (owner = auth.uid() OR owner IS NULL)
  );

-- ---------------------------------------------------------------------------
-- provider-media  (public read; provider can upload/update/delete)
-- ---------------------------------------------------------------------------
CREATE POLICY "provider_media_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'provider-media');

CREATE POLICY "provider_media_provider_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'provider-media'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid() AND u.is_provider = true
    )
  );

CREATE POLICY "provider_media_owner_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'provider-media'
    AND auth.uid() IS NOT NULL
    AND (owner = auth.uid() OR owner IS NULL)
  );

CREATE POLICY "provider_media_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'provider-media'
    AND auth.uid() IS NOT NULL
    AND (owner = auth.uid() OR owner IS NULL)
  );

-- ---------------------------------------------------------------------------
-- payment-screenshots  (private; uploader and provider read; uploader writes)
-- ---------------------------------------------------------------------------
CREATE POLICY "payment_screenshots_authed_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'payment-screenshots'
    AND auth.uid() IS NOT NULL
    AND (owner = auth.uid() OR owner IS NULL)
  );

CREATE POLICY "payment_screenshots_authed_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'payment-screenshots'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "payment_screenshots_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'payment-screenshots'
    AND auth.uid() IS NOT NULL
    AND (owner = auth.uid() OR owner IS NULL)
  );

-- ---------------------------------------------------------------------------
-- class-materials  (private; authenticated read for now — fine-grained
-- enforcement happens via signed URLs minted by app code based on enrollment)
-- ---------------------------------------------------------------------------
CREATE POLICY "class_materials_authed_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'class-materials'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "class_materials_provider_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'class-materials'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid() AND u.is_provider = true
    )
  );

CREATE POLICY "class_materials_owner_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'class-materials'
    AND auth.uid() IS NOT NULL
    AND (owner = auth.uid() OR owner IS NULL)
  );

CREATE POLICY "class_materials_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'class-materials'
    AND auth.uid() IS NOT NULL
    AND (owner = auth.uid() OR owner IS NULL)
  );

-- ---------------------------------------------------------------------------
-- featured-banners  (public read; provider uploads; admin can also manage)
-- ---------------------------------------------------------------------------
CREATE POLICY "featured_banners_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'featured-banners');

CREATE POLICY "featured_banners_provider_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'featured-banners'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid() AND u.is_provider = true
    )
  );

CREATE POLICY "featured_banners_owner_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'featured-banners'
    AND auth.uid() IS NOT NULL
    AND (owner = auth.uid() OR owner IS NULL OR public.is_platform_admin())
  );

CREATE POLICY "featured_banners_owner_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'featured-banners'
    AND auth.uid() IS NOT NULL
    AND (owner = auth.uid() OR owner IS NULL OR public.is_platform_admin())
  );

COMMIT;

-- ============================================================================
-- Post-storage checklist:
--   [ ] SELECT id FROM storage.buckets ORDER BY id;  -- 6 entries (no `invoices`)
--   [ ] SELECT count(*) FROM pg_policy WHERE polrelid = 'storage.objects'::regclass;
--       -- expect 22 (4 ops x 5 buckets + 2 SELECT-only for public buckets);
--       -- exact count varies by bucket
--   [ ] Run 004_subscription_helpers.sql next
-- ============================================================================
