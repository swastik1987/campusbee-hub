-- ============================================================
-- CampusBee — hotfix: families INSERT RLS + schema compat
--
-- Run once in the Supabase SQL editor:
--   supabase.com/dashboard/project/uspqewlpgdsvabturfes/editor
--
-- Fixes two things:
-- 1. families INSERT fails with 42501 (RLS) because the policy's
--    current_user_id() helper may return NULL if auth_id lookup
--    fails, or the helper may not exist. Replaces all INSERT
--    policies with an inline subquery version that is more robust.
-- 2. If the live DB still has the v1 schema with apartment_id NOT NULL
--    on families, makes it nullable so v2 inserts (no apartment_id)
--    can proceed.
-- ============================================================

-- ── 1. Re-create the current_user_id() helper ───────────────────────────────
--    (idempotent; safe to re-run)
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_id() TO authenticated;

-- ── 2. families — make apartment_id nullable (v1 → v2 compat) ───────────────
--    If the column doesn't exist this is a no-op. If it exists as NOT NULL
--    in v1, this lifts the constraint so v2 inserts (no apartment_id) work.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'families'
      AND column_name  = 'apartment_id'
      AND is_nullable  = 'NO'
  ) THEN
    ALTER TABLE public.families ALTER COLUMN apartment_id DROP NOT NULL;
    RAISE NOTICE 'families.apartment_id made nullable (was NOT NULL)';
  ELSE
    RAISE NOTICE 'families.apartment_id already nullable or absent — no change';
  END IF;
END;
$$;

-- ── 3. families — drop ALL existing INSERT policies then recreate ────────────
--    Drop by both v1 and v2 policy names so the script is idempotent.
DROP POLICY IF EXISTS families_self_insert        ON public.families;
DROP POLICY IF EXISTS "Users can create own family" ON public.families;
DROP POLICY IF EXISTS "Users manage own family"    ON public.families;

-- New policy: inline subquery — no dependency on current_user_id()
CREATE POLICY families_self_insert ON public.families
  FOR INSERT
  WITH CHECK (
    primary_user_id = (
      SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1
    )
  );

-- ── 4. family_links — ensure accepted_at column exists ──────────────────────
--    v1 family_links doesn't have this column; v2 code inserts it.
ALTER TABLE public.family_links
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- ── 5. family_links — drop ALL existing INSERT policies then recreate ────────
DROP POLICY IF EXISTS family_links_self_insert  ON public.family_links;
DROP POLICY IF EXISTS "Self link insert"         ON public.family_links;

-- New policy: inline subquery
CREATE POLICY family_links_self_insert ON public.family_links
  FOR INSERT
  WITH CHECK (
    user_id = (
      SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1
    )
  );

-- ── 6. Ensure RLS is enabled on both tables ──────────────────────────────────
ALTER TABLE public.families    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_links ENABLE ROW LEVEL SECURITY;
