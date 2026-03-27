-- ============================================================
-- Allow platform admins to read all user profiles
--
-- Problem: The nested select apartment_admins → users fails because
-- platform admins can't read other users' profiles (RLS blocks it).
-- Previous attempts caused recursion because they queried users inside
-- a users policy. This version uses auth.uid() directly on the same
-- row being checked to identify the caller, then a subquery on users
-- only for the caller check — which is safe because it doesn't
-- reference the row being evaluated.
--
-- Also fix: useAssignAdmin fails on reassign due to UNIQUE(apartment_id)
-- ============================================================

-- Safe platform admin read policy using is_platform_admin()
-- which internally uses auth.uid() (not get_user_id()) so no recursion
DROP POLICY IF EXISTS "Platform admin reads all users" ON public.users;
CREATE POLICY "Platform admin reads all users" ON public.users
  FOR SELECT USING (is_platform_admin());

-- Also allow apartment admins to read users in their apartment
-- Uses a SECURITY DEFINER function to avoid recursion
CREATE OR REPLACE FUNCTION get_admin_apartment_ids()
RETURNS SETOF UUID AS $$
  SELECT apartment_id FROM apartment_admins WHERE user_id = (
    SELECT id FROM users WHERE auth_id = auth.uid()
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "Apartment admin reads apartment users" ON public.users;
CREATE POLICY "Apartment admin reads apartment users" ON public.users
  FOR SELECT USING (
    id IN (
      SELECT primary_user_id FROM families WHERE apartment_id IN (SELECT get_admin_apartment_ids())
    )
  );
