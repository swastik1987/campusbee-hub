-- Drop the recursive policies on users table
DROP POLICY IF EXISTS "Platform admin reads all users" ON users;
DROP POLICY IF EXISTS "Platform admin updates users" ON users;
DROP POLICY IF EXISTS "Apartment admin reads apartment users" ON users;
DROP POLICY IF EXISTS "Users read apartment co-residents" ON users;
DROP POLICY IF EXISTS "Anyone reads provider user profiles" ON users;

-- Recreate using SECURITY DEFINER functions that bypass RLS

-- Platform admin: use the existing is_platform_admin() SECURITY DEFINER function
CREATE POLICY "Platform admin reads all users" ON users
  FOR SELECT USING (is_platform_admin());

CREATE POLICY "Platform admin updates users" ON users
  FOR UPDATE USING (is_platform_admin());

-- For co-residents and apartment admin, create a helper that bypasses RLS
CREATE OR REPLACE FUNCTION public.get_user_apartment_ids(_auth_uid uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.apartment_id
  FROM families f
  JOIN users u ON u.id = f.primary_user_id
  WHERE u.auth_id = _auth_uid
$$;

CREATE OR REPLACE FUNCTION public.is_apartment_admin_for_any(_auth_uid uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT aa.apartment_id
  FROM apartment_admins aa
  JOIN users u ON u.id = aa.user_id
  WHERE u.auth_id = _auth_uid AND aa.is_active = true
$$;

-- Co-residents policy (no self-referencing subquery on users)
CREATE POLICY "Users read apartment co-residents" ON users
  FOR SELECT USING (
    id IN (
      SELECT f.primary_user_id FROM families f
      WHERE f.apartment_id IN (SELECT get_user_apartment_ids(auth.uid()))
    )
  );

-- Apartment admin reads users in their apartment
CREATE POLICY "Apartment admin reads apartment users" ON users
  FOR SELECT USING (
    id IN (
      SELECT f.primary_user_id FROM families f
      WHERE f.apartment_id IN (SELECT is_apartment_admin_for_any(auth.uid()))
    )
  );

-- Provider profiles readable by anyone
CREATE POLICY "Anyone reads provider user profiles" ON users
  FOR SELECT USING (is_provider = true);