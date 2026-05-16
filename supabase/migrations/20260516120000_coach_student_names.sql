-- 20260516120000_coach_student_names.sql
-- Allow coaches (not only academy owners) to read student + seeker names for
-- batches they have an active assignment on.
--
-- Previously `get_provider_student_names` had a hard security guard requiring
-- the caller to be the service_providers.user_id of the provider — which
-- excluded coaches and made the /provider/students page show no rows for
-- them even when their dashboard count was non-zero.
--
-- The function stays SECURITY DEFINER so it bypasses RLS, but the security
-- guard now permits the caller to be EITHER:
--   (a) the academy owner (pu.auth_id = auth.uid()), OR
--   (b) an active coach assigned to that batch (is_coach_of_batch).
--
-- Re-runnable.

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
SECURITY DEFINER
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
    AND  (
      pu.auth_id = auth.uid()                                 -- academy owner
      OR public.is_coach_of_batch(e.batch_id)                 -- assigned coach
    )
$$;

GRANT EXECUTE ON FUNCTION public.get_provider_student_names(UUID[]) TO authenticated;
