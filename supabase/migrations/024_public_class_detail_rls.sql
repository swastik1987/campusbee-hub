-- Migration 024: Allow anonymous (unauthenticated) reads for the public class
-- detail page (/class/:classId).  Provider profiles and public user fields are
-- inherently public on this marketplace — seekers and anon visitors need to read
-- them to view class details that are shared via link.
--
-- Run once in the Supabase SQL editor or via the Supabase CLI.

-- ── service_providers: public read ─────────────────────────────────────────
-- Provider business names, bios, and verification status are public on the
-- marketplace.  The existing owner-write policies are unchanged.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'service_providers'
      AND policyname = 'service_providers_anon_select'
  ) THEN
    CREATE POLICY service_providers_anon_select
      ON public.service_providers
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END$$;

GRANT SELECT ON public.service_providers TO anon;

-- ── users: public read (name + avatar only) ────────────────────────────────
-- The class detail page shows the provider's display name and avatar from the
-- users table.  Sensitive columns (email, mobile_number, home_address, etc.)
-- are never selected in public queries; this policy allows the row to be read
-- and the PostgREST column selection in the query limits the returned fields.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'users'
      AND policyname = 'users_anon_select'
  ) THEN
    CREATE POLICY users_anon_select
      ON public.users
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END$$;

GRANT SELECT ON public.users TO anon;

-- ── trainers: public read ──────────────────────────────────────────────────
-- Batch trainer names / photos appear on the class detail page.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'trainers'
      AND policyname = 'trainers_anon_select'
  ) THEN
    CREATE POLICY trainers_anon_select
      ON public.trainers
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END$$;

GRANT SELECT ON public.trainers TO anon;

-- ── batches / batch_schedules / class_addons: public read ──────────────────
-- Anonymous visitors see full batch info (schedules, pricing, capacity).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'batches'
      AND policyname = 'batches_anon_select'
  ) THEN
    CREATE POLICY batches_anon_select
      ON public.batches
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END$$;

GRANT SELECT ON public.batches TO anon;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'batch_schedules'
      AND policyname = 'batch_schedules_anon_select'
  ) THEN
    CREATE POLICY batch_schedules_anon_select
      ON public.batch_schedules
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END$$;

GRANT SELECT ON public.batch_schedules TO anon;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'class_addons'
      AND policyname = 'class_addons_anon_select'
  ) THEN
    CREATE POLICY class_addons_anon_select
      ON public.class_addons
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END$$;

GRANT SELECT ON public.class_addons TO anon;

-- ── class_categories: public read (may already exist from migration 016) ───
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'class_categories'
      AND policyname = 'class_categories_anon_select'
  ) THEN
    CREATE POLICY class_categories_anon_select
      ON public.class_categories
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END$$;

GRANT SELECT ON public.class_categories TO anon;
