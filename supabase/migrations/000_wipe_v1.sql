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
--
-- WHAT IT PRESERVES (untouched):
--   * `auth` schema  -> all existing users, sessions, identities
--   * `storage` schema  -> existing buckets and objects remain
--   * `realtime`, `supabase_functions`, `extensions` schemas
--
-- STORAGE NOTES:
--   * The v1 storage RLS policies reference only `bucket_id` and `auth.uid()`,
--     not public.* tables, so they remain valid after this wipe.
--   * v1 buckets (avatars, class-images, provider-media, payment-screenshots,
--     class-materials, invoices) are kept. The Phase 1 storage migration
--     (003_storage_buckets_v2.sql) uses ON CONFLICT DO NOTHING to coexist.
--   * Orphaned v1 storage objects become unreferenced files. They are harmless
--     storage waste — clean up at leisure via Supabase Dashboard -> Storage,
--     or leave them. The `invoices` bucket is unused in v2 (admin fees gone).
--   * Direct DELETE FROM storage.* is blocked by Supabase's protect_delete
--     trigger; use the Storage REST API or Dashboard to remove objects.
--
-- IRREVERSIBLE for the public schema. Take a Supabase backup first
-- (Dashboard -> Database -> Backups).
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

COMMIT;

-- ============================================================================
-- Post-wipe checklist:
--   [ ] auth.users still populated (SELECT count(*) FROM auth.users;)
--   [ ] public schema empty (SELECT count(*) FROM pg_tables WHERE schemaname='public'; -> 0)
--   [ ] Storage buckets still listed in Dashboard -> Storage (kept on purpose)
--   [ ] Ready to run 001_baseline_v2.sql
-- ============================================================================
