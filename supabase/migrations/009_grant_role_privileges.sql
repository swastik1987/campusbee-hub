-- ============================================================================
-- 009_grant_role_privileges.sql  —  grant CRUD to anon/authenticated
-- ============================================================================
-- 000_wipe_v1.sql recreated the public schema and granted USAGE to anon /
-- authenticated, but only granted ALL ON TABLES to postgres / service_role.
-- Result: every query from the browser (which uses the authenticated role
-- once logged in, or anon when not) hits a hard
--   "permission denied for table users"
-- before RLS even gets a chance to evaluate.
--
-- This migration grants the standard Supabase role privileges:
--   * anon            -> SELECT only (RLS gates which rows are visible)
--   * authenticated   -> SELECT, INSERT, UPDATE, DELETE (RLS gates rows)
--   * service_role    -> already has ALL via 000
--
-- Plus matching DEFAULT PRIVILEGES so any future tables created in `public`
-- automatically pick up the same grants.
-- ============================================================================

BEGIN;

-- ---- Grants on existing tables --------------------------------------------
GRANT SELECT                          ON ALL TABLES    IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE  ON ALL TABLES    IN SCHEMA public TO authenticated;

-- Sequences (for SERIAL / IDENTITY columns and nextval default expressions).
-- We don't currently use any non-UUID identifiers, but grant for safety.
GRANT USAGE, SELECT                   ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Functions / RPCs — RPC callers need EXECUTE. Each function we wrote in
-- 002 / 004 / 005 / 006 also has explicit GRANT EXECUTE statements scoped
-- per role, but blanket the rest just in case (idempotent).
GRANT EXECUTE                         ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- ---- Default privileges for tables created LATER in this schema -----------
-- (Future migrations don't have to remember to grant.)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT                         ON TABLES    TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES    TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT                  ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE                        ON FUNCTIONS TO anon, authenticated;

COMMIT;

-- ============================================================================
-- Verify (run these as anon / authenticated using a JWT in the SQL editor):
--   SELECT count(*) FROM public.class_categories;            -- works (RLS public)
--   INSERT INTO public.users (auth_id, email, full_name)
--   VALUES (auth.uid(), 'me@test.com', 'Me') RETURNING id;   -- works for authed user
-- ============================================================================
