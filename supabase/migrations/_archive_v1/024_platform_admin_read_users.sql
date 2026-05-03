-- ============================================================
-- FIX: Platform admin can't see apartment admin details
--
-- Problem: Nested select apartment_admins → users fails because
-- RLS on users blocks platform admin from reading other profiles.
-- We CANNOT add a policy on users that calls is_platform_admin()
-- because it causes infinite recursion (migrations 013-015 removed
-- these exact policies for this reason).
--
-- Solution: SECURITY DEFINER RPC that returns apartments with
-- admin and requester user details, bypassing RLS entirely.
-- ============================================================

-- Drop any previously created recursive policies (safety cleanup)
DROP POLICY IF EXISTS "Platform admin reads all users" ON public.users;
DROP POLICY IF EXISTS "Apartment admin reads apartment users" ON public.users;
DROP FUNCTION IF EXISTS get_admin_apartment_ids();

-- RPC: Get apartments with enriched admin + requester details
CREATE OR REPLACE FUNCTION platform_get_apartments()
RETURNS TABLE (
  id uuid,
  name text,
  city text,
  locality text,
  pin_code text,
  total_units int,
  status text,
  logo_url text,
  created_at timestamptz,
  admin_user_id uuid,
  admin_name text,
  admin_email text,
  admin_phone text,
  requester_name text,
  requester_email text,
  requester_phone text
) AS $$
BEGIN
  -- Verify caller is platform admin
  IF NOT COALESCE(
    (SELECT u.is_platform_admin FROM public.users u WHERE u.auth_id = auth.uid()),
    false
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    ac.id,
    ac.name::text,
    ac.city::text,
    ac.locality::text,
    ac.pin_code::text,
    ac.total_units,
    ac.status::text,
    ac.logo_url::text,
    ac.created_at,
    aa_user.id AS admin_user_id,
    aa_user.full_name::text AS admin_name,
    aa_user.email::text AS admin_email,
    aa_user.mobile_number::text AS admin_phone,
    reg_user.full_name::text AS requester_name,
    reg_user.email::text AS requester_email,
    reg_user.mobile_number::text AS requester_phone
  FROM apartment_complexes ac
  LEFT JOIN apartment_admins aa ON aa.apartment_id = ac.id
  LEFT JOIN users aa_user ON aa_user.id = aa.user_id
  LEFT JOIN users reg_user ON reg_user.id = ac.registered_by
  ORDER BY ac.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- RPC: Get single apartment detail with admin + requester
CREATE OR REPLACE FUNCTION platform_get_apartment_detail(apt_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  city text,
  locality text,
  pin_code text,
  total_units int,
  status text,
  logo_url text,
  created_at timestamptz,
  admin_user_id uuid,
  admin_name text,
  admin_email text,
  admin_phone text,
  requester_name text,
  requester_email text,
  requester_phone text
) AS $$
BEGIN
  IF NOT COALESCE(
    (SELECT u.is_platform_admin FROM public.users u WHERE u.auth_id = auth.uid()),
    false
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    ac.id,
    ac.name::text,
    ac.city::text,
    ac.locality::text,
    ac.pin_code::text,
    ac.total_units,
    ac.status::text,
    ac.logo_url::text,
    ac.created_at,
    aa_user.id AS admin_user_id,
    aa_user.full_name::text AS admin_name,
    aa_user.email::text AS admin_email,
    aa_user.mobile_number::text AS admin_phone,
    reg_user.full_name::text AS requester_name,
    reg_user.email::text AS requester_email,
    reg_user.mobile_number::text AS requester_phone
  FROM apartment_complexes ac
  LEFT JOIN apartment_admins aa ON aa.apartment_id = ac.id
  LEFT JOIN users aa_user ON aa_user.id = aa.user_id
  LEFT JOIN users reg_user ON reg_user.id = ac.registered_by
  WHERE ac.id = apt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
