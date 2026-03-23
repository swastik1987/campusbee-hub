-- ============================================================
-- FIX: Infinite recursion in users table RLS policies
--
-- ERROR: 42P17 "infinite recursion detected in policy for relation users"
--
-- ROOT CAUSE: Policies on the "users" table contained subqueries like
--   SELECT ... FROM public.users WHERE auth_id = auth.uid()
-- When PostgreSQL evaluates RLS on "users", those subqueries trigger
-- RLS evaluation on "users" again → infinite loop.
--
-- FIX: Use SECURITY DEFINER helper functions (get_user_id() and
-- is_platform_admin()) which bypass RLS, breaking the recursion.
-- ============================================================

-- Drop ALL the recursive policies from migration 012
DROP POLICY IF EXISTS "Platform admin reads all users" ON public.users;
DROP POLICY IF EXISTS "Platform admin updates users" ON public.users;
DROP POLICY IF EXISTS "Apartment admin reads apartment users" ON public.users;
DROP POLICY IF EXISTS "Users read apartment co-residents" ON public.users;
DROP POLICY IF EXISTS "Anyone reads provider user profiles" ON public.users;

-- Recreate using SECURITY DEFINER functions (no recursion)

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

-- Users can read basic info of co-residents (family linking, chat)
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

-- Anyone can read provider user profiles (class listings, provider pages)
CREATE POLICY "Anyone reads provider user profiles"
  ON public.users
  FOR SELECT
  USING (is_provider = true);
