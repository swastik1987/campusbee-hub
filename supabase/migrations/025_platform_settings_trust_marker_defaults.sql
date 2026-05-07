-- Migration 025: Seed default trust-marker thresholds in platform_settings.
--
-- These values control the New / Popular tags shown on class cards in the
-- Explore page.  Override any value in the platform_settings table at any
-- time — the frontend re-reads them every 5 minutes.
--
-- Run once in the Supabase SQL editor or via the Supabase CLI.

-- Ensure the key column has a unique constraint (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname    = 'platform_settings_key_unique'
      AND conrelid   = 'public.platform_settings'::regclass
  ) THEN
    ALTER TABLE public.platform_settings
      ADD CONSTRAINT platform_settings_key_unique UNIQUE (key);
  END IF;
END$$;

-- Seed defaults (skip if key already exists)
INSERT INTO public.platform_settings (key, value) VALUES
  ('new_class_days_threshold',   '7'),   -- classes created within N days → "New" tag
  ('popular_enrollment_min',     '10'),  -- classes with >= N total enrolled students → "Popular"
  ('popular_rating_min',         '4.0'), -- OR classes rated >= N stars ...
  ('popular_rating_count_min',   '5')    --   AND with >= N reviews → "Popular"
ON CONFLICT (key) DO NOTHING;

-- Allow authenticated seekers and anonymous visitors to read platform_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'platform_settings'
      AND policyname = 'platform_settings_public_select'
  ) THEN
    CREATE POLICY platform_settings_public_select
      ON public.platform_settings
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END$$;

GRANT SELECT ON public.platform_settings TO anon, authenticated;
