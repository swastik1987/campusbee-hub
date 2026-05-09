-- ============================================================================
-- 018_provider_student_visibility.sql
--
-- Problem: providers cannot see student names or seeker names on the
-- /provider/students page because:
--   1. family_members SELECT is restricted to the family's own members.
--   2. users SELECT only allows reading rows where is_provider = true.
--
-- Fix: add two narrow SELECT policies so a provider can read the
-- family_member and user rows that are linked to enrollments in their
-- own classes.
-- ============================================================================

-- ── 1. Providers can read family_members enrolled in their classes ──────────
DROP POLICY IF EXISTS family_members_provider_enrolled_select ON public.family_members;

CREATE POLICY family_members_provider_enrolled_select ON public.family_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM   public.enrollments   e
      JOIN   public.batches       b  ON b.id  = e.batch_id
      JOIN   public.classes       c  ON c.id  = b.class_id
      JOIN   public.service_providers sp ON sp.id = c.provider_id
      WHERE  e.family_member_id = family_members.id
        AND  sp.user_id = public.current_user_id()
    )
  );

-- ── 2. Providers can read users (seekers) who enrolled in their classes ─────
DROP POLICY IF EXISTS users_provider_enrollers_select ON public.users;

CREATE POLICY users_provider_enrollers_select ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM   public.enrollments   e
      JOIN   public.batches       b  ON b.id  = e.batch_id
      JOIN   public.classes       c  ON c.id  = b.class_id
      JOIN   public.service_providers sp ON sp.id = c.provider_id
      WHERE  e.enrolled_by = users.id
        AND  sp.user_id = public.current_user_id()
    )
  );
