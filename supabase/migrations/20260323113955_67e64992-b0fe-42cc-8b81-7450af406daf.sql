-- Fix search_path on existing functions
CREATE OR REPLACE FUNCTION public.get_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM users WHERE auth_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_platform_admin FROM users WHERE auth_id = auth.uid()),
    false
  )
$$;