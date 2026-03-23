-- ============================================================
-- DEFINITIVE FIX: Infinite recursion on users table (42P17)
--
-- The SECURITY DEFINER functions (get_user_id, is_platform_admin)
-- were still triggering RLS because Supabase managed Postgres uses
-- FORCE ROW LEVEL SECURITY, which applies RLS even to table owners.
--
-- Fix: Add SET row_security = off to the helper functions so they
-- explicitly disable RLS during execution. Then drop and recreate
-- ALL problematic policies.
-- ============================================================

-- ========== STEP 1: Fix helper functions ==========
-- Add row_security = off so these functions TRULY bypass RLS

CREATE OR REPLACE FUNCTION get_user_id()
RETURNS UUID AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
SET row_security = off;

CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_platform_admin FROM public.users WHERE auth_id = auth.uid()),
    false
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
SET row_security = off;


-- ========== STEP 2: Drop ALL non-basic policies on users ==========
-- Keep only the 3 bootstrap policies that use auth.uid() directly

DROP POLICY IF EXISTS "Platform admin reads all users" ON public.users;
DROP POLICY IF EXISTS "Platform admin updates users" ON public.users;
DROP POLICY IF EXISTS "Apartment admin reads apartment users" ON public.users;
DROP POLICY IF EXISTS "Users read apartment co-residents" ON public.users;
DROP POLICY IF EXISTS "Anyone reads provider user profiles" ON public.users;


-- ========== STEP 3: Recreate policies using fixed functions ==========

-- Platform admins can read all user profiles
CREATE POLICY "Platform admin reads all users"
  ON public.users
  FOR SELECT
  USING (is_platform_admin());

-- Platform admin can update any user (assigning admin roles)
CREATE POLICY "Platform admin updates users"
  ON public.users
  FOR UPDATE
  USING (is_platform_admin());

-- Apartment admins can read users in their apartment
CREATE POLICY "Apartment admin reads apartment users"
  ON public.users
  FOR SELECT
  USING (
    id IN (
      SELECT f.primary_user_id FROM public.families f
      WHERE f.apartment_id IN (
        SELECT aa.apartment_id FROM public.apartment_admins aa
        WHERE aa.user_id = get_user_id()
        AND aa.is_active = true
      )
    )
  );

-- Users can read co-residents in their apartment
CREATE POLICY "Users read apartment co-residents"
  ON public.users
  FOR SELECT
  USING (
    id IN (
      SELECT f2.primary_user_id FROM public.families f2
      WHERE f2.apartment_id IN (
        SELECT f1.apartment_id FROM public.families f1
        WHERE f1.primary_user_id = get_user_id()
      )
    )
  );

-- Anyone can read provider user profiles (for class listings)
CREATE POLICY "Anyone reads provider user profiles"
  ON public.users
  FOR SELECT
  USING (is_provider = true);
