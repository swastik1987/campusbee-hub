-- ============================================================================
-- 020_provider_student_names_rpc.sql
--
-- Problem: family_members_provider_enrolled_select (migration 018) causes
-- infinite recursion:
--   reading family_members
--     → its policy subqueries enrollments
--       → enr_family_select calls owns_family_member()
--         → owns_family_member queries family_members again
--           → recursion detected → entire enrollment query fails → empty list
--
-- Fix:
--   1. Drop the recursive family_members policy.
--   2. Add a SECURITY DEFINER RPC that bypasses RLS entirely and returns
--      student + seeker names for a provider's batch list.
--      The function includes its own security guard so providers can only
--      receive names for their own batches.
-- ============================================================================

-- ── 1. Drop the recursive policy ─────────────────────────────────────────────
DROP POLICY IF EXISTS family_members_provider_enrolled_select ON public.family_members;

-- ── 2. SECURITY DEFINER RPC for provider student names ───────────────────────
CREATE OR REPLACE FUNCTION public.get_provider_student_names(p_batch_ids UUID[])
RETURNS TABLE (
  enrollment_id    UUID,
  student_name     TEXT,
  student_relation TEXT,
  student_dob      DATE,
  student_age_grp  TEXT,
  seeker_id        UUID,
  seeker_name      TEXT,
  seeker_avatar    TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER                 -- runs as postgres → bypasses RLS
SET search_path = public, auth
AS $$
  SELECT
    e.id              AS enrollment_id,
    fm.full_name      AS student_name,
    fm.relationship   AS student_relation,
    fm.date_of_birth  AS student_dob,
    fm.age_group      AS student_age_grp,
    u.id              AS seeker_id,
    u.full_name       AS seeker_name,
    u.avatar_url      AS seeker_avatar
  FROM   public.enrollments        e
  JOIN   public.family_members     fm ON fm.id  = e.family_member_id
  JOIN   public.users              u  ON u.id   = e.enrolled_by
  JOIN   public.batches            b  ON b.id   = e.batch_id
  JOIN   public.classes            c  ON c.id   = b.class_id
  JOIN   public.service_providers  sp ON sp.id  = c.provider_id
  JOIN   public.users              pu ON pu.id  = sp.user_id
  WHERE  e.batch_id = ANY(p_batch_ids)
    AND  pu.auth_id  = auth.uid()    -- security guard: caller must be the provider
$$;

GRANT EXECUTE ON FUNCTION public.get_provider_student_names(UUID[]) TO authenticated;
