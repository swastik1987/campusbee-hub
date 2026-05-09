-- ============================================================================
-- 019_fix_users_rls_recursion.sql
--
-- Migration 018 added `users_provider_enrollers_select` which calls
-- current_user_id() — a STABLE SECURITY DEFINER function.
-- PostgreSQL inlines STABLE functions into RLS policy expressions.
-- The inlined body contains `SELECT id FROM public.users ...`, and since
-- the policy is ON public.users, PostgreSQL detects infinite recursion and
-- raises: "infinite recursion detected in policy for relation 'users'".
-- This breaks all queries on public.users, including auth profile loads.
--
-- Fix: drop the broken policy; create a VOLATILE SECURITY DEFINER helper.
-- VOLATILE functions are never inlined by the planner, so the
-- public.users reference inside the function body stays hidden from the
-- policy-recursion detector.  SECURITY DEFINER (postgres owner) ensures
-- the internal users lookup bypasses RLS at runtime.
-- ============================================================================

-- ── 1. Drop the broken policy immediately ────────────────────────────────────
DROP POLICY IF EXISTS users_provider_enrollers_select ON public.users;

-- ── 2. Create a VOLATILE helper (not inlinable) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.is_enrolled_by_my_provider(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
VOLATILE                  -- must be VOLATILE so the planner never inlines it
SECURITY DEFINER          -- runs as postgres → bypasses RLS inside the function
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.enrollments       e
    JOIN   public.batches           b  ON b.id   = e.batch_id
    JOIN   public.classes           c  ON c.id   = b.class_id
    JOIN   public.service_providers sp ON sp.id  = c.provider_id
    JOIN   public.users             u  ON u.id   = sp.user_id
    WHERE  e.enrolled_by = p_user_id     -- the user row being checked
      AND  u.auth_id     = auth.uid()    -- current auth session must be their provider
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_enrolled_by_my_provider(UUID) TO authenticated;

-- ── 3. Recreate the policy using the non-inlinable helper ────────────────────
DROP POLICY IF EXISTS users_provider_enrollers_select ON public.users;

CREATE POLICY users_provider_enrollers_select ON public.users
  FOR SELECT USING (
    public.is_enrolled_by_my_provider(id)
  );
