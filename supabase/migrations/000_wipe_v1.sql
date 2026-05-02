-- ============================================================================
-- 000_wipe_v1.sql
-- ============================================================================
-- Wipes the v1 schema in preparation for the v2 baseline.
--
-- WHEN TO RUN: once, immediately before 001_baseline_v2.sql (Phase 1).
-- WHAT IT DOES:
--   1. Drops the entire `public` schema (all v1 tables, functions, triggers,
--      types, sequences, views, indexes, RLS policies). Atomic via CASCADE.
--   2. Recreates `public` with standard Supabase grants.
--   3. Wipes the six v1 storage buckets and their objects.
--   4. Drops any leftover storage RLS policies (recreated in v2 003 migration).
--
-- WHAT IT PRESERVES (untouched):
--   * `auth` schema  -> all existing users, sessions, identities
--   * `storage` schema structure  -> only v1 bucket rows + objects are deleted
--   * `realtime`, `supabase_functions`, `extensions` schemas
--
-- IRREVERSIBLE. Take a Supabase backup first (Dashboard -> Database -> Backups).
-- ============================================================================

BEGIN;

-- ---- 1. Reset the public schema -------------------------------------------
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- ---- 2. Restore default grants (matches a fresh Supabase project) ---------
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL   ON SCHEMA public TO postgres, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES    TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TYPES     TO postgres, service_role;

-- ---- 3. Wipe v1 storage bucket objects, then the buckets ------------------
-- v2 recreates the needed buckets in 003_storage_buckets_v2.sql.
-- `invoices` is dropped permanently (no admin fee tracking in v2).
DELETE FROM storage.objects WHERE bucket_id IN (
  'avatars',
  'class-images',
  'provider-media',
  'payment-screenshots',
  'class-materials',
  'invoices'
);

DELETE FROM storage.buckets WHERE id IN (
  'avatars',
  'class-images',
  'provider-media',
  'payment-screenshots',
  'class-materials',
  'invoices'
);

-- ---- 4. Drop all leftover storage RLS policies ---------------------------
-- Many v1 storage policies referenced public.* tables that no longer exist
-- and would error on access. v2 003 migration recreates clean policies.
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

COMMIT;

-- ============================================================================
-- Post-wipe checklist:
--   [ ] auth.users still populated (SELECT count(*) FROM auth.users;)
--   [ ] public schema empty (SELECT count(*) FROM pg_tables WHERE schemaname='public'; -> 0)
--   [ ] No v1 buckets (SELECT id FROM storage.buckets; -> empty or non-v1 only)
--   [ ] Ready to run 001_baseline_v2.sql
-- ============================================================================
