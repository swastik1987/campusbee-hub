-- 20260516120000_coach_student_names.sql
-- Allow coaches (not only academy owners) to read student + seeker names for
-- batches they have an active assignment on.
--
-- Defensively detects whether the coaches infrastructure (`is_coach_of_batch`
-- helper from migration 20260515150000_coaches.sql) is present:
--   - if YES → security guard is (academy owner OR assigned coach)
--   - if NO  → security guard stays academy-owner-only (the original 020 form)
-- so it's safe to apply this migration before or after the coaches migration,
-- and the function never references a non-existent helper.
--
-- Re-runnable.

DO $$
DECLARE
  v_has_coach_helper BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_coach_of_batch'
  ) INTO v_has_coach_helper;

  IF v_has_coach_helper THEN
    EXECUTE $fn$
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
      AS $body$
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
            pu.auth_id = auth.uid()
            OR public.is_coach_of_batch(e.batch_id)
          )
      $body$;
    $fn$;
  ELSE
    EXECUTE $fn$
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
      AS $body$
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
          AND  pu.auth_id = auth.uid()
      $body$;
    $fn$;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.get_provider_student_names(UUID[]) TO authenticated;
