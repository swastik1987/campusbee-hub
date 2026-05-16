-- 20260515150000_coaches.sql
-- Coaches feature for Academy providers (Premium only).
--
-- An "Academy" provider on the Premium tier can invite multiple Coaches by
-- name + email. Coaches log in with that email and gain a "Coach" tag on
-- their Instructor profile. They can mark attendance, send payment reminders,
-- and manage only the classes / batches they have been assigned.
--
-- This migration:
--   1. Creates `coaches` (auth-linked team members) and `coach_assignments`
--      (class- or batch-scoped, with optional time-bounded temporary swaps).
--   2. Migrates existing `trainers` rows into `coaches` (status='active',
--      linked_user_id NULL) and copies `certifications.trainer_id` →
--      `certifications.coach_id` so the public profile keeps working.
--   3. Adds SECURITY DEFINER helpers (`current_coach_id`, `is_coach_of_class`,
--      `is_coach_of_batch`, `is_academy_member`) and extends RLS on the
--      relevant tables so coaches see/edit only their assigned scope.
--   4. Adds RPCs: invite_coach, assign_coach, swap_coach_temporary,
--      remove_coach, accept_coach_invite (auto-called on login when the
--      session email matches an invited coach), revert_expired_temporary_assignments.
--
-- Apply manually in the Supabase SQL editor. Safe to re-run.

-- ── 1. coaches table ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.coaches (
  id                     UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  academy_provider_id    UUID         NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  full_name              TEXT         NOT NULL,
  email                  TEXT         NOT NULL,
  phone                  TEXT,
  bio                    TEXT,
  qualifications         TEXT,
  experience_years       INTEGER,
  specializations        TEXT[]       DEFAULT '{}',
  photo_url              TEXT,
  linked_user_id         UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  status                 TEXT         NOT NULL DEFAULT 'invited'
                                      CHECK (status IN ('invited','active','removed')),
  invited_at             TIMESTAMPTZ  DEFAULT NOW(),
  accepted_at            TIMESTAMPTZ,
  removed_at             TIMESTAMPTZ,
  invited_by             UUID         REFERENCES public.users(id),
  created_at             TIMESTAMPTZ  DEFAULT NOW(),
  updated_at             TIMESTAMPTZ  DEFAULT NOW()
);

-- Email must be unique within an academy (no duplicates), but the same email
-- can be a coach at multiple academies.
CREATE UNIQUE INDEX IF NOT EXISTS coaches_academy_email_unique_idx
  ON public.coaches (academy_provider_id, LOWER(email))
  WHERE status <> 'removed';

CREATE INDEX IF NOT EXISTS coaches_academy_status_idx
  ON public.coaches (academy_provider_id, status);

CREATE INDEX IF NOT EXISTS coaches_linked_user_idx
  ON public.coaches (linked_user_id) WHERE linked_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS coaches_email_lookup_idx
  ON public.coaches (LOWER(email)) WHERE status = 'invited';

-- ── 2. coach_assignments table ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.coach_assignments (
  id                     UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id               UUID         NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  scope_type             TEXT         NOT NULL CHECK (scope_type IN ('class','batch')),
  scope_id               UUID         NOT NULL,
  is_temporary           BOOLEAN      NOT NULL DEFAULT FALSE,
  -- For temporary swaps: the coach who normally owns the scope. When the
  -- temporary window ends, the original coach's assignment is reinstated.
  original_coach_id      UUID         REFERENCES public.coaches(id) ON DELETE SET NULL,
  valid_from             TIMESTAMPTZ  DEFAULT NOW(),
  valid_until            TIMESTAMPTZ,
  status                 TEXT         NOT NULL DEFAULT 'active'
                                      CHECK (status IN ('active','ended','scheduled')),
  created_by             UUID         REFERENCES public.users(id),
  created_at             TIMESTAMPTZ  DEFAULT NOW(),
  updated_at             TIMESTAMPTZ  DEFAULT NOW()
);

-- Only one active assignment per scope at a time (admin re-assigns ⇒ end old, insert new)
CREATE UNIQUE INDEX IF NOT EXISTS coach_assignments_scope_active_idx
  ON public.coach_assignments (scope_type, scope_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS coach_assignments_coach_active_idx
  ON public.coach_assignments (coach_id, status);

CREATE INDEX IF NOT EXISTS coach_assignments_valid_until_idx
  ON public.coach_assignments (valid_until)
  WHERE status = 'active' AND valid_until IS NOT NULL;

-- ── 3. certifications.coach_id (parallel to trainer_id during migration) ─────

ALTER TABLE public.certifications
  ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES public.coaches(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS certifications_coach_id_idx
  ON public.certifications (coach_id) WHERE coach_id IS NOT NULL;

-- ── 4. One-time data migration from trainers → coaches ───────────────────────
-- Existing trainer rows are copied as 'active' coaches with no login link.
-- They will display on the public provider page; the admin can later invite
-- them (set linked_user_id, status='invited') to grant operational access.

DO $$
DECLARE
  v_trainers_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'trainers'
  ) INTO v_trainers_exists;

  IF v_trainers_exists THEN
    -- Copy trainers → coaches. We deliberately set status='active' and
    -- linked_user_id NULL: these are display-only profiles until invited.
    -- Use a synthetic email so the unique index doesn't collide; admin will
    -- replace it when promoting the trainer to a logged-in coach.
    INSERT INTO public.coaches (
      academy_provider_id, full_name, email, bio, qualifications,
      experience_years, specializations, photo_url, status,
      invited_at, accepted_at
    )
    SELECT
      t.provider_id,
      t.name,
      COALESCE(NULLIF(t.email, ''), 'trainer-' || t.id::text || '@coach.placeholder.local'),
      t.bio,
      t.qualifications,
      t.experience_years,
      COALESCE(t.specializations, '{}'),
      t.photo_url,
      'active',
      t.created_at,
      t.created_at
    FROM public.trainers t
    WHERE t.is_active = TRUE
      AND NOT EXISTS (
        SELECT 1 FROM public.coaches c
        WHERE c.academy_provider_id = t.provider_id
          AND LOWER(c.email) = LOWER(COALESCE(NULLIF(t.email, ''),
              'trainer-' || t.id::text || '@coach.placeholder.local'))
      );

    -- Copy certifications: map trainer_id → coach_id via (provider, name) lookup.
    UPDATE public.certifications cert
    SET coach_id = c.id
    FROM public.trainers t
    JOIN public.coaches c
      ON c.academy_provider_id = t.provider_id
     AND c.full_name = t.name
     AND c.status <> 'removed'
    WHERE cert.trainer_id = t.id
      AND cert.coach_id IS NULL;
  END IF;
END $$;

-- ── 5. updated_at trigger ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS coaches_touch_updated_at ON public.coaches;
CREATE TRIGGER coaches_touch_updated_at
  BEFORE UPDATE ON public.coaches
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS coach_assignments_touch_updated_at ON public.coach_assignments;
CREATE TRIGGER coach_assignments_touch_updated_at
  BEFORE UPDATE ON public.coach_assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── 6. SECURITY DEFINER helpers ──────────────────────────────────────────────

-- Returns the coach IDs the current authenticated user is linked to (active).
-- A user can be a coach at multiple academies → returns SETOF UUID.
CREATE OR REPLACE FUNCTION public.current_coach_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.coaches c
  JOIN public.users u ON u.id = c.linked_user_id
  WHERE u.auth_id = auth.uid()
    AND c.status = 'active'
$$;

-- Returns the academy provider IDs the current user has access to as either
-- the owner OR a coach. Used by RLS predicates that allow read-only access
-- to other academy classes.
CREATE OR REPLACE FUNCTION public.current_academy_provider_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.service_providers
    WHERE user_id = public.current_user_id()
  UNION
  SELECT c.academy_provider_id
  FROM public.coaches c
  JOIN public.users u ON u.id = c.linked_user_id
  WHERE u.auth_id = auth.uid()
    AND c.status = 'active'
$$;

-- True if the current user is the coach assigned to this class
-- (either directly OR via one of its batches OR via class scope).
CREATE OR REPLACE FUNCTION public.is_coach_of_class(p_class_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.coach_assignments ca
    WHERE ca.status = 'active'
      AND ca.coach_id IN (SELECT public.current_coach_ids())
      AND (
        (ca.scope_type = 'class' AND ca.scope_id = p_class_id)
        OR (ca.scope_type = 'batch' AND ca.scope_id IN (
              SELECT id FROM public.batches WHERE class_id = p_class_id))
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.is_coach_of_batch(p_batch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.coach_assignments ca
    WHERE ca.status = 'active'
      AND ca.coach_id IN (SELECT public.current_coach_ids())
      AND (
        (ca.scope_type = 'batch' AND ca.scope_id = p_batch_id)
        OR (ca.scope_type = 'class' AND ca.scope_id = (
              SELECT class_id FROM public.batches WHERE id = p_batch_id))
      )
  )
$$;

-- True if the current user is a coach (any active assignment) at the given academy.
-- Used for the "read-only on other academy classes" access rule.
CREATE OR REPLACE FUNCTION public.is_academy_member(p_provider_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.service_providers
    WHERE id = p_provider_id AND user_id = public.current_user_id()
  ) OR EXISTS (
    SELECT 1 FROM public.coaches c
    JOIN public.users u ON u.id = c.linked_user_id
    WHERE u.auth_id = auth.uid()
      AND c.status = 'active'
      AND c.academy_provider_id = p_provider_id
  )
$$;

GRANT EXECUTE ON FUNCTION public.current_coach_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_academy_provider_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_coach_of_class(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_coach_of_batch(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_academy_member(UUID) TO authenticated;

-- ── 7. RLS — coaches & coach_assignments ─────────────────────────────────────

ALTER TABLE public.coaches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_assignments  ENABLE ROW LEVEL SECURITY;

-- Coaches table
DROP POLICY IF EXISTS coaches_admin_all       ON public.coaches;
DROP POLICY IF EXISTS coaches_self_select     ON public.coaches;
DROP POLICY IF EXISTS coaches_public_select   ON public.coaches;

-- Academy admin: full CRUD on their own coaches
CREATE POLICY coaches_admin_all ON public.coaches
  FOR ALL TO authenticated
  USING (academy_provider_id IN (
    SELECT id FROM public.service_providers WHERE user_id = public.current_user_id()
  ))
  WITH CHECK (academy_provider_id IN (
    SELECT id FROM public.service_providers WHERE user_id = public.current_user_id()
  ));

-- A coach can read their own row (so they can see their tag / details)
CREATE POLICY coaches_self_select ON public.coaches
  FOR SELECT TO authenticated
  USING (linked_user_id = public.current_user_id());

-- Public can see active coaches on the provider profile page (no email/phone — those are filtered client-side)
CREATE POLICY coaches_public_select ON public.coaches
  FOR SELECT TO anon, authenticated
  USING (status = 'active');

-- Coach assignments
DROP POLICY IF EXISTS coach_assignments_admin_all       ON public.coach_assignments;
DROP POLICY IF EXISTS coach_assignments_self_select     ON public.coach_assignments;

CREATE POLICY coach_assignments_admin_all ON public.coach_assignments
  FOR ALL TO authenticated
  USING (coach_id IN (
    SELECT c.id FROM public.coaches c
    JOIN public.service_providers sp ON sp.id = c.academy_provider_id
    WHERE sp.user_id = public.current_user_id()
  ))
  WITH CHECK (coach_id IN (
    SELECT c.id FROM public.coaches c
    JOIN public.service_providers sp ON sp.id = c.academy_provider_id
    WHERE sp.user_id = public.current_user_id()
  ));

CREATE POLICY coach_assignments_self_select ON public.coach_assignments
  FOR SELECT TO authenticated
  USING (coach_id IN (SELECT public.current_coach_ids()));

-- ── 8. Extend RLS on operational tables to grant coach access ────────────────

-- Classes: existing policy allows the owning provider. Add a coach branch.
DROP POLICY IF EXISTS classes_coach_select ON public.classes;
DROP POLICY IF EXISTS classes_coach_update ON public.classes;

CREATE POLICY classes_coach_select ON public.classes
  FOR SELECT TO authenticated
  USING (
    public.is_academy_member(provider_id)
  );

-- Coaches can edit classes they are assigned to (academy admin handles others via own policy)
CREATE POLICY classes_coach_update ON public.classes
  FOR UPDATE TO authenticated
  USING (public.is_coach_of_class(id))
  WITH CHECK (public.is_coach_of_class(id));

-- Batches
DROP POLICY IF EXISTS batches_coach_select ON public.batches;
DROP POLICY IF EXISTS batches_coach_update ON public.batches;

CREATE POLICY batches_coach_select ON public.batches
  FOR SELECT TO authenticated
  USING (
    class_id IN (
      SELECT id FROM public.classes WHERE public.is_academy_member(provider_id)
    )
  );

CREATE POLICY batches_coach_update ON public.batches
  FOR UPDATE TO authenticated
  USING (public.is_coach_of_batch(id))
  WITH CHECK (public.is_coach_of_batch(id));

-- Attendance records: coach can mark for assigned batches
DROP POLICY IF EXISTS attendance_records_coach_all ON public.attendance_records;

CREATE POLICY attendance_records_coach_all ON public.attendance_records
  FOR ALL TO authenticated
  USING (public.is_coach_of_batch(batch_id))
  WITH CHECK (public.is_coach_of_batch(batch_id));

-- Payments: coach can read + send reminders (insert reminder log) for assigned batches
DROP POLICY IF EXISTS payments_coach_select ON public.payments;

CREATE POLICY payments_coach_select ON public.payments
  FOR SELECT TO authenticated
  USING (
    enrollment_id IN (
      SELECT id FROM public.enrollments
      WHERE public.is_coach_of_batch(batch_id)
    )
  );

-- Enrollments
DROP POLICY IF EXISTS enrollments_coach_select ON public.enrollments;
DROP POLICY IF EXISTS enrollments_coach_update ON public.enrollments;

CREATE POLICY enrollments_coach_select ON public.enrollments
  FOR SELECT TO authenticated
  USING (public.is_coach_of_batch(batch_id));

CREATE POLICY enrollments_coach_update ON public.enrollments
  FOR UPDATE TO authenticated
  USING (public.is_coach_of_batch(batch_id))
  WITH CHECK (public.is_coach_of_batch(batch_id));

-- Class materials & announcements
DROP POLICY IF EXISTS class_materials_coach_all ON public.class_materials;
DROP POLICY IF EXISTS announcements_coach_all   ON public.announcements;

CREATE POLICY class_materials_coach_all ON public.class_materials
  FOR ALL TO authenticated
  USING (public.is_coach_of_class(class_id))
  WITH CHECK (public.is_coach_of_class(class_id));

CREATE POLICY announcements_coach_all ON public.announcements
  FOR ALL TO authenticated
  USING (
    (class_id IS NOT NULL AND public.is_coach_of_class(class_id))
    OR (batch_id IS NOT NULL AND public.is_coach_of_batch(batch_id))
  )
  WITH CHECK (
    (class_id IS NOT NULL AND public.is_coach_of_class(class_id))
    OR (batch_id IS NOT NULL AND public.is_coach_of_batch(batch_id))
  );

-- ── 9. RPCs ──────────────────────────────────────────────────────────────────

-- Invite a coach. Called by the academy admin. Returns the coach row.
CREATE OR REPLACE FUNCTION public.invite_coach(
  p_academy_provider_id UUID,
  p_full_name           TEXT,
  p_email               TEXT,
  p_phone               TEXT DEFAULT NULL,
  p_bio                 TEXT DEFAULT NULL,
  p_qualifications      TEXT DEFAULT NULL,
  p_experience_years    INTEGER DEFAULT NULL,
  p_specializations     TEXT[] DEFAULT '{}',
  p_photo_url           TEXT DEFAULT NULL
)
RETURNS public.coaches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := public.current_user_id();
  v_coach     public.coaches;
  v_linked    UUID;
BEGIN
  -- Authorize: caller must own the academy provider
  IF NOT EXISTS (
    SELECT 1 FROM public.service_providers
    WHERE id = p_academy_provider_id AND user_id = v_caller_id
  ) THEN
    RAISE EXCEPTION 'not authorized to invite coaches for this academy';
  END IF;

  -- Auto-link if the email already belongs to a user
  SELECT id INTO v_linked FROM public.users
    WHERE LOWER(email) = LOWER(p_email) LIMIT 1;

  -- Reactivate a previously removed row if present
  UPDATE public.coaches
     SET status = 'invited',
         full_name = p_full_name,
         phone = p_phone,
         bio = p_bio,
         qualifications = p_qualifications,
         experience_years = p_experience_years,
         specializations = COALESCE(p_specializations, '{}'),
         photo_url = p_photo_url,
         invited_at = NOW(),
         accepted_at = NULL,
         removed_at = NULL,
         invited_by = v_caller_id,
         linked_user_id = v_linked
   WHERE academy_provider_id = p_academy_provider_id
     AND LOWER(email) = LOWER(p_email)
     AND status = 'removed'
   RETURNING * INTO v_coach;

  IF v_coach.id IS NOT NULL THEN
    -- If the invited email already matches an existing user, auto-accept.
    IF v_linked IS NOT NULL THEN
      UPDATE public.coaches SET status = 'active', accepted_at = NOW()
       WHERE id = v_coach.id RETURNING * INTO v_coach;
    END IF;
    RETURN v_coach;
  END IF;

  INSERT INTO public.coaches (
    academy_provider_id, full_name, email, phone, bio, qualifications,
    experience_years, specializations, photo_url, linked_user_id,
    status, invited_by
  ) VALUES (
    p_academy_provider_id, p_full_name, p_email, p_phone, p_bio, p_qualifications,
    p_experience_years, COALESCE(p_specializations, '{}'), p_photo_url, v_linked,
    CASE WHEN v_linked IS NOT NULL THEN 'active' ELSE 'invited' END,
    v_caller_id
  )
  RETURNING * INTO v_coach;

  IF v_linked IS NOT NULL THEN
    UPDATE public.coaches SET accepted_at = NOW() WHERE id = v_coach.id
      RETURNING * INTO v_coach;
  END IF;

  RETURN v_coach;
END $$;

-- Assign a coach to a class or batch. If a temporary swap, valid_from/until are required.
-- Ends any existing active assignment for the same scope before inserting.
CREATE OR REPLACE FUNCTION public.assign_coach(
  p_coach_id     UUID,
  p_scope_type   TEXT,
  p_scope_id     UUID,
  p_is_temporary BOOLEAN DEFAULT FALSE,
  p_valid_from   TIMESTAMPTZ DEFAULT NULL,
  p_valid_until  TIMESTAMPTZ DEFAULT NULL
)
RETURNS public.coach_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   UUID := public.current_user_id();
  v_academy_id  UUID;
  v_orig_coach  UUID;
  v_row         public.coach_assignments;
BEGIN
  IF p_scope_type NOT IN ('class','batch') THEN
    RAISE EXCEPTION 'invalid scope_type: %', p_scope_type;
  END IF;

  -- Resolve & authorize: the coach must belong to an academy the caller owns
  SELECT academy_provider_id INTO v_academy_id
    FROM public.coaches WHERE id = p_coach_id AND status <> 'removed';

  IF v_academy_id IS NULL THEN
    RAISE EXCEPTION 'coach not found or removed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.service_providers
    WHERE id = v_academy_id AND user_id = v_caller_id
  ) THEN
    RAISE EXCEPTION 'not authorized to assign coaches for this academy';
  END IF;

  -- Verify scope belongs to the same academy
  IF p_scope_type = 'class' THEN
    PERFORM 1 FROM public.classes
      WHERE id = p_scope_id AND provider_id = v_academy_id;
  ELSE
    PERFORM 1 FROM public.batches b
      JOIN public.classes c ON c.id = b.class_id
      WHERE b.id = p_scope_id AND c.provider_id = v_academy_id;
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'scope does not belong to this academy';
  END IF;

  IF p_is_temporary AND p_valid_until IS NULL THEN
    RAISE EXCEPTION 'temporary assignment requires valid_until';
  END IF;

  -- End any existing active assignment for this scope
  IF p_is_temporary THEN
    SELECT coach_id INTO v_orig_coach FROM public.coach_assignments
      WHERE scope_type = p_scope_type AND scope_id = p_scope_id AND status = 'active';
  END IF;

  UPDATE public.coach_assignments
     SET status = 'ended', updated_at = NOW()
   WHERE scope_type = p_scope_type AND scope_id = p_scope_id AND status = 'active';

  INSERT INTO public.coach_assignments (
    coach_id, scope_type, scope_id, is_temporary,
    original_coach_id, valid_from, valid_until, status, created_by
  ) VALUES (
    p_coach_id, p_scope_type, p_scope_id, p_is_temporary,
    v_orig_coach,
    COALESCE(p_valid_from, NOW()),
    p_valid_until,
    'active', v_caller_id
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END $$;

-- Convenience: end an assignment (e.g. unassign a coach permanently from a scope)
CREATE OR REPLACE FUNCTION public.end_coach_assignment(p_assignment_id UUID)
RETURNS public.coach_assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.coach_assignments;
BEGIN
  UPDATE public.coach_assignments
     SET status = 'ended', updated_at = NOW()
   WHERE id = p_assignment_id
     AND coach_id IN (
       SELECT c.id FROM public.coaches c
       JOIN public.service_providers sp ON sp.id = c.academy_provider_id
       WHERE sp.user_id = public.current_user_id()
     )
   RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'assignment not found or not authorized';
  END IF;
  RETURN v_row;
END $$;

-- Soft-remove a coach: end all their active assignments, mark status='removed'.
-- History stays for audit.
CREATE OR REPLACE FUNCTION public.remove_coach(p_coach_id UUID)
RETURNS public.coaches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.coaches;
BEGIN
  UPDATE public.coach_assignments
     SET status = 'ended', updated_at = NOW()
   WHERE coach_id = p_coach_id AND status = 'active';

  UPDATE public.coaches
     SET status = 'removed', removed_at = NOW()
   WHERE id = p_coach_id
     AND academy_provider_id IN (
       SELECT id FROM public.service_providers WHERE user_id = public.current_user_id()
     )
   RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'coach not found or not authorized';
  END IF;
  RETURN v_row;
END $$;

-- Called automatically when a user logs in. Looks for any 'invited' coach
-- rows matching the user's email and links + activates them.
-- Idempotent — safe to call on every session resume.
CREATE OR REPLACE FUNCTION public.accept_coach_invites()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID := public.current_user_id();
  v_email      TEXT;
  v_count      INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;
  SELECT email INTO v_email FROM public.users WHERE id = v_user_id;
  IF v_email IS NULL THEN
    RETURN 0;
  END IF;

  WITH upd AS (
    UPDATE public.coaches
       SET linked_user_id = v_user_id,
           status = 'active',
           accepted_at = COALESCE(accepted_at, NOW())
     WHERE LOWER(email) = LOWER(v_email)
       AND status = 'invited'
     RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM upd;
  RETURN v_count;
END $$;

-- Daily cron: revert assignments whose valid_until has passed. If a temporary
-- assignment ends and an original_coach_id was recorded, reinstate them.
CREATE OR REPLACE FUNCTION public.revert_expired_coach_assignments()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row    RECORD;
  v_count  INTEGER := 0;
BEGIN
  FOR v_row IN
    SELECT id, scope_type, scope_id, original_coach_id, is_temporary
    FROM public.coach_assignments
    WHERE status = 'active'
      AND valid_until IS NOT NULL
      AND valid_until <= NOW()
  LOOP
    UPDATE public.coach_assignments
       SET status = 'ended', updated_at = NOW()
     WHERE id = v_row.id;
    v_count := v_count + 1;

    IF v_row.is_temporary AND v_row.original_coach_id IS NOT NULL THEN
      -- Reinstate the original coach if they're still active
      INSERT INTO public.coach_assignments (
        coach_id, scope_type, scope_id, is_temporary, status, created_by
      )
      SELECT v_row.original_coach_id, v_row.scope_type, v_row.scope_id, FALSE, 'active', NULL
      WHERE EXISTS (
        SELECT 1 FROM public.coaches WHERE id = v_row.original_coach_id AND status = 'active'
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION public.invite_coach(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_coach(UUID, TEXT, UUID, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_coach_assignment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_coach(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_coach_invites() TO authenticated;
-- revert_expired_coach_assignments runs from the edge function via service_role.

-- ── 10. Privilege grants for the new tables ──────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coaches            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_assignments  TO authenticated;
GRANT SELECT                          ON public.coaches            TO anon;

-- ── 11. Payment reminder log (manual button trail) ───────────────────────────

CREATE TABLE IF NOT EXISTS public.payment_reminder_log (
  id            UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id    UUID         REFERENCES public.payments(id) ON DELETE CASCADE,
  enrollment_id UUID         REFERENCES public.enrollments(id) ON DELETE CASCADE,
  sent_by       UUID         NOT NULL REFERENCES public.users(id),
  channel       TEXT         NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','email','whatsapp')),
  notes         TEXT,
  sent_at       TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_reminder_log_payment_idx
  ON public.payment_reminder_log (payment_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS payment_reminder_log_enrollment_idx
  ON public.payment_reminder_log (enrollment_id, sent_at DESC);

ALTER TABLE public.payment_reminder_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_reminder_log_insert ON public.payment_reminder_log;
DROP POLICY IF EXISTS payment_reminder_log_select ON public.payment_reminder_log;

CREATE POLICY payment_reminder_log_insert ON public.payment_reminder_log
  FOR INSERT TO authenticated
  WITH CHECK (
    sent_by = public.current_user_id() AND (
      -- Academy admin: enrollment belongs to a batch under their provider
      enrollment_id IN (
        SELECT e.id FROM public.enrollments e
        JOIN public.batches b ON b.id = e.batch_id
        JOIN public.classes c ON c.id = b.class_id
        WHERE c.provider_id IN (
          SELECT id FROM public.service_providers WHERE user_id = public.current_user_id()
        )
      )
      OR enrollment_id IN (
        SELECT e.id FROM public.enrollments e
        WHERE public.is_coach_of_batch(e.batch_id)
      )
    )
  );

CREATE POLICY payment_reminder_log_select ON public.payment_reminder_log
  FOR SELECT TO authenticated
  USING (
    sent_by = public.current_user_id() OR
    enrollment_id IN (
      SELECT e.id FROM public.enrollments e
      JOIN public.batches b ON b.id = e.batch_id
      JOIN public.classes c ON c.id = b.class_id
      WHERE c.provider_id IN (
        SELECT id FROM public.service_providers WHERE user_id = public.current_user_id()
      )
    )
  );

GRANT SELECT, INSERT ON public.payment_reminder_log TO authenticated;

-- RPC: log a reminder + send the notification. Returns the log row.
CREATE OR REPLACE FUNCTION public.send_payment_reminder(p_payment_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS public.payment_reminder_log
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id     UUID := public.current_user_id();
  v_enrollment_id UUID;
  v_payer_user_id UUID;
  v_class_title   TEXT;
  v_amount        NUMERIC;
  v_authorized    BOOLEAN := FALSE;
  v_log           public.payment_reminder_log;
BEGIN
  SELECT p.enrollment_id, p.user_id, p.amount, c.title
    INTO v_enrollment_id, v_payer_user_id, v_amount, v_class_title
  FROM public.payments p
  JOIN public.enrollments e ON e.id = p.enrollment_id
  JOIN public.batches b ON b.id = e.batch_id
  JOIN public.classes c ON c.id = b.class_id
  WHERE p.id = p_payment_id;

  IF v_enrollment_id IS NULL THEN
    RAISE EXCEPTION 'payment not found';
  END IF;

  -- Authorize: academy admin OR coach of the batch
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments e
    JOIN public.batches b ON b.id = e.batch_id
    JOIN public.classes c ON c.id = b.class_id
    WHERE e.id = v_enrollment_id
      AND c.provider_id IN (
        SELECT id FROM public.service_providers WHERE user_id = v_caller_id
      )
  ) OR public.is_coach_of_batch(
    (SELECT batch_id FROM public.enrollments WHERE id = v_enrollment_id)
  )
  INTO v_authorized;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'not authorized to send reminder for this payment';
  END IF;

  INSERT INTO public.payment_reminder_log (payment_id, enrollment_id, sent_by, channel, notes)
  VALUES (p_payment_id, v_enrollment_id, v_caller_id, 'in_app', p_notes)
  RETURNING * INTO v_log;

  PERFORM public.send_notification(
    v_payer_user_id,
    'Payment reminder',
    'Pending payment of ₹' || v_amount::text || ' for ' || COALESCE(v_class_title, 'your class'),
    'payment_reminder',
    'payment',
    p_payment_id
  );

  RETURN v_log;
END $$;

GRANT EXECUTE ON FUNCTION public.send_payment_reminder(UUID, TEXT) TO authenticated;
