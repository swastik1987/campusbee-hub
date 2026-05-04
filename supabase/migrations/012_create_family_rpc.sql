-- ============================================================
-- CampusBee — 012_create_family_rpc.sql
--
-- Creates a SECURITY DEFINER RPC that creates (or returns) the
-- calling user's family + primary family_link row.
--
-- Why an RPC instead of a direct INSERT with RLS policy?
-- The families INSERT policy uses current_user_id() which does a
-- sub-SELECT on public.users. During RLS evaluation that sub-SELECT
-- is itself subject to RLS, creating a chicken-and-egg problem that
-- causes the WITH CHECK to evaluate to NULL → FALSE → 42501.
-- A SECURITY DEFINER function bypasses RLS entirely but still
-- verifies the caller via auth.uid() before touching any rows.
--
-- Run in: supabase.com/dashboard/project/uspqewlpgdsvabturfes/editor
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_own_family()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id   UUID;
  v_family_id UUID;
BEGIN
  -- 1. Resolve caller's internal user row
  SELECT id INTO v_user_id
  FROM public.users
  WHERE auth_id = auth.uid()
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found for auth.uid() = %', auth.uid();
  END IF;

  -- 2. Return existing family if one already exists (idempotent)
  SELECT id INTO v_family_id
  FROM public.families
  WHERE primary_user_id = v_user_id
  LIMIT 1;

  IF v_family_id IS NOT NULL THEN
    RETURN v_family_id;
  END IF;

  -- 3. Create the family row
  INSERT INTO public.families (primary_user_id)
  VALUES (v_user_id)
  RETURNING id INTO v_family_id;

  -- 4. Create the primary family_link
  --    accepted_at added by migration 011; ON CONFLICT is safe on re-runs.
  INSERT INTO public.family_links (family_id, user_id, role, status, accepted_at)
  VALUES (v_family_id, v_user_id, 'primary', 'active', now())
  ON CONFLICT (family_id, user_id) DO NOTHING;

  RETURN v_family_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_own_family() TO authenticated;
