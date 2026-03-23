-- ============================================================
-- DEFINITIVE FIX: Remove ALL recursive policies from users table
--
-- Problem: PostgreSQL evaluates ALL policies (OR-combined). Any policy
-- on "users" that queries "users" (even via SECURITY DEFINER functions)
-- causes infinite recursion in Supabase managed Postgres.
--
-- Solution:
-- 1. Keep ONLY safe policies on users (auth.uid() direct check, column checks)
-- 2. Create SECURITY DEFINER RPC functions for admin user searches
-- 3. Frontend hooks will call these RPCs instead of querying users directly
-- ============================================================

-- ========== STEP 1: Drop ALL problematic policies on users ==========
-- These all cause recursion because they query users from within users policies

DROP POLICY IF EXISTS "Platform admin reads all users" ON public.users;
DROP POLICY IF EXISTS "Platform admin updates users" ON public.users;
DROP POLICY IF EXISTS "Apartment admin reads apartment users" ON public.users;
DROP POLICY IF EXISTS "Users read apartment co-residents" ON public.users;
DROP POLICY IF EXISTS "Anyone reads provider user profiles" ON public.users;

-- ========== STEP 2: Verify safe policies remain ==========
-- These use auth.uid() directly (no table subquery) — they're safe:
--   "Users can view own profile" → auth.uid() = auth_id
--   "Users can update own profile" → auth.uid() = auth_id
--   "Users can insert own profile" → auth.uid() = auth_id

-- ========== STEP 3: Add back the SAFE non-recursive policies ==========

-- Anyone can see provider profiles (checks column on current row, no subquery)
CREATE POLICY "Anyone reads provider user profiles"
  ON public.users
  FOR SELECT
  USING (is_provider = true);

-- ========== STEP 4: Create RPC functions for admin operations ==========
-- These bypass RLS entirely via SECURITY DEFINER

-- Admin search: search users by name/email/phone (for platform admin)
CREATE OR REPLACE FUNCTION admin_search_users(search_query text)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  mobile_number text,
  avatar_url text
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
  SELECT u.id, u.full_name, u.email, u.mobile_number, u.avatar_url
  FROM public.users u
  WHERE u.full_name ILIKE '%' || search_query || '%'
     OR u.email ILIKE '%' || search_query || '%'
     OR u.mobile_number ILIKE '%' || search_query || '%'
  ORDER BY u.full_name
  LIMIT 15;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Admin: update a user (e.g., set is_apartment_admin)
CREATE OR REPLACE FUNCTION admin_update_user(
  target_user_id uuid,
  set_apartment_admin boolean DEFAULT NULL,
  set_platform_admin boolean DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- Verify caller is platform admin
  IF NOT COALESCE(
    (SELECT u.is_platform_admin FROM public.users u WHERE u.auth_id = auth.uid()),
    false
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF set_apartment_admin IS NOT NULL THEN
    UPDATE public.users SET is_apartment_admin = set_apartment_admin WHERE id = target_user_id;
  END IF;

  IF set_platform_admin IS NOT NULL THEN
    UPDATE public.users SET is_platform_admin = set_platform_admin WHERE id = target_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin: get platform-wide user count
CREATE OR REPLACE FUNCTION admin_get_user_count()
RETURNS bigint AS $$
BEGIN
  -- Verify caller is platform admin
  IF NOT COALESCE(
    (SELECT u.is_platform_admin FROM public.users u WHERE u.auth_id = auth.uid()),
    false
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN (SELECT count(*) FROM public.users);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Admin: get all users with created_at for growth analytics
CREATE OR REPLACE FUNCTION admin_get_users_growth()
RETURNS TABLE (
  id uuid,
  created_at timestamptz
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
  SELECT u.id, u.created_at FROM public.users u ORDER BY u.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Apartment user search (for family linking invites)
CREATE OR REPLACE FUNCTION search_apartment_users(
  apt_id uuid,
  search_query text
)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  mobile_number text,
  avatar_url text
) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.full_name, u.email, u.mobile_number, u.avatar_url
  FROM public.users u
  WHERE u.id IN (
    SELECT f.primary_user_id FROM public.families f WHERE f.apartment_id = apt_id
  )
  AND (
    u.full_name ILIKE '%' || search_query || '%'
    OR u.email ILIKE '%' || search_query || '%'
    OR u.mobile_number ILIKE '%' || search_query || '%'
  )
  ORDER BY u.full_name
  LIMIT 15;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
