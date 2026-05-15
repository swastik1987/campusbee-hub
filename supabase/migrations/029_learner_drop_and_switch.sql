-- ============================================================================
-- 029_learner_drop_and_switch.sql
--
-- Learner self-service:
--   1. Drop out of an active/pending/paused enrollment (instant).
--   2. Request a switch to another batch of the same class (needs instructor
--      approval). One pending switch per enrollment at a time.
--
-- Schema:
--   enrollments.pending_switch_to_batch_id  UUID NULL  (FK → batches)
--   enrollments.switch_requested_at         TIMESTAMPTZ NULL
--
-- RPCs (SECURITY DEFINER, all GRANTed to authenticated):
--   learner_drop_enrollment(p_enrollment_id)
--   learner_request_batch_switch(p_enrollment_id, p_to_batch_id, p_reason)
--   learner_cancel_batch_switch(p_enrollment_id)
--   provider_approve_batch_switch(p_enrollment_id)
--   provider_reject_batch_switch(p_enrollment_id, p_reason)
--
-- Also extends the migration 027 trigger to fire on batch_id changes so seat
-- counts stay accurate when a switch is approved.
--
-- Apply manually in Supabase SQL editor.
-- ============================================================================

BEGIN;

-- ── 1. Schema ──────────────────────────────────────────────────────────────

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS pending_switch_to_batch_id UUID
    REFERENCES public.batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS switch_requested_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_enrollments_pending_switch
  ON public.enrollments(pending_switch_to_batch_id)
  WHERE pending_switch_to_batch_id IS NOT NULL;

-- ── 2. Extend seat-count trigger to fire on batch_id changes ───────────────
-- The trigger function from 027 already handles "batch_id changed" but the
-- trigger predicate was UPDATE OF status only. Recreate with batch_id too.

DROP TRIGGER IF EXISTS trg_sync_batch_enrollment_count ON public.enrollments;

CREATE TRIGGER trg_sync_batch_enrollment_count
AFTER INSERT OR DELETE OR UPDATE OF status, batch_id ON public.enrollments
FOR EACH ROW
EXECUTE FUNCTION public.sync_batch_enrollment_count();

-- ── 3. learner_drop_enrollment ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.learner_drop_enrollment(
  p_enrollment_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id          UUID;
  v_enrolled_by      UUID;
  v_status           TEXT;
  v_class_title      TEXT;
  v_batch_name       TEXT;
  v_student_name     TEXT;
  v_provider_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM public.users WHERE auth_id = auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT e.enrolled_by, e.status, c.title, b.batch_name,
         COALESCE(fm.full_name, 'A student'), sp.user_id
    INTO v_enrolled_by, v_status, v_class_title, v_batch_name,
         v_student_name, v_provider_user_id
  FROM public.enrollments         e
  JOIN public.batches             b  ON b.id  = e.batch_id
  JOIN public.classes             c  ON c.id  = b.class_id
  JOIN public.service_providers   sp ON sp.id = c.provider_id
  LEFT JOIN public.family_members fm ON fm.id = e.family_member_id
  WHERE e.id = p_enrollment_id;

  IF v_enrolled_by IS NULL THEN
    RAISE EXCEPTION 'Enrollment not found';
  END IF;
  IF v_enrolled_by <> v_user_id THEN
    RAISE EXCEPTION 'Not authorised to modify this enrollment';
  END IF;
  IF v_status NOT IN ('active', 'pending', 'paused') THEN
    RAISE EXCEPTION 'Cannot drop an enrollment in status %', v_status;
  END IF;

  UPDATE public.enrollments
     SET status                     = 'dropped',
         dropped_at                 = now(),
         pending_switch_to_batch_id = NULL,
         switch_requested_at        = NULL,
         drop_reason                = COALESCE(drop_reason, 'Dropped by learner')
   WHERE id = p_enrollment_id;

  IF v_provider_user_id IS NOT NULL THEN
    PERFORM public.send_notification(
      v_provider_user_id,
      'Student dropped out',
      v_student_name || ' dropped out of ' || v_class_title || ' / ' || v_batch_name,
      'enrollment_dropped',
      'enrollment',
      p_enrollment_id
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.learner_drop_enrollment(UUID) TO authenticated;

-- ── 4. learner_request_batch_switch ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.learner_request_batch_switch(
  p_enrollment_id UUID,
  p_to_batch_id   UUID,
  p_reason        TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id          UUID;
  v_enrolled_by      UUID;
  v_status           TEXT;
  v_from_batch_id    UUID;
  v_from_class_id    UUID;
  v_to_class_id      UUID;
  v_to_status        TEXT;
  v_to_count         INTEGER;
  v_to_max           INTEGER;
  v_to_batch_name    TEXT;
  v_class_title      TEXT;
  v_student_name     TEXT;
  v_provider_user_id UUID;
  v_existing_switch  UUID;
BEGIN
  SELECT id INTO v_user_id FROM public.users WHERE auth_id = auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Enrollment context
  SELECT e.enrolled_by, e.status, e.batch_id, e.pending_switch_to_batch_id,
         b.class_id, c.title, COALESCE(fm.full_name, 'A student'), sp.user_id
    INTO v_enrolled_by, v_status, v_from_batch_id, v_existing_switch,
         v_from_class_id, v_class_title, v_student_name, v_provider_user_id
  FROM public.enrollments         e
  JOIN public.batches             b  ON b.id  = e.batch_id
  JOIN public.classes             c  ON c.id  = b.class_id
  JOIN public.service_providers   sp ON sp.id = c.provider_id
  LEFT JOIN public.family_members fm ON fm.id = e.family_member_id
  WHERE e.id = p_enrollment_id;

  IF v_enrolled_by IS NULL THEN
    RAISE EXCEPTION 'Enrollment not found';
  END IF;
  IF v_enrolled_by <> v_user_id THEN
    RAISE EXCEPTION 'Not authorised to modify this enrollment';
  END IF;
  IF v_status NOT IN ('active', 'pending') THEN
    RAISE EXCEPTION 'Cannot switch from an enrollment in status %', v_status;
  END IF;
  IF v_existing_switch IS NOT NULL THEN
    RAISE EXCEPTION 'A switch request is already pending for this enrollment';
  END IF;
  IF v_from_batch_id = p_to_batch_id THEN
    RAISE EXCEPTION 'Already enrolled in this batch';
  END IF;

  -- Target batch must exist, belong to the same class, be active, and have space
  SELECT b.class_id, b.status, b.current_enrollment_count, b.max_batch_size, b.batch_name
    INTO v_to_class_id, v_to_status, v_to_count, v_to_max, v_to_batch_name
  FROM public.batches b
  WHERE b.id = p_to_batch_id;

  IF v_to_class_id IS NULL THEN
    RAISE EXCEPTION 'Target batch not found';
  END IF;
  IF v_to_class_id <> v_from_class_id THEN
    RAISE EXCEPTION 'Target batch belongs to a different class';
  END IF;
  IF v_to_status NOT IN ('active', 'full') THEN
    RAISE EXCEPTION 'Target batch is not accepting students (status: %)', v_to_status;
  END IF;
  IF v_to_count >= v_to_max THEN
    RAISE EXCEPTION 'Target batch is full';
  END IF;

  UPDATE public.enrollments
     SET pending_switch_to_batch_id = p_to_batch_id,
         switch_requested_at        = now(),
         notes                      = COALESCE(
           CASE WHEN p_reason IS NOT NULL AND length(trim(p_reason)) > 0
                THEN 'Switch reason: ' || trim(p_reason)
                ELSE NULL
           END,
           notes
         )
   WHERE id = p_enrollment_id;

  IF v_provider_user_id IS NOT NULL THEN
    PERFORM public.send_notification(
      v_provider_user_id,
      'Batch switch requested',
      v_student_name || ' requested to switch to ' || v_to_batch_name || ' in ' || v_class_title,
      'batch_switch_requested',
      'enrollment',
      p_enrollment_id
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.learner_request_batch_switch(UUID, UUID, TEXT) TO authenticated;

-- ── 5. learner_cancel_batch_switch ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.learner_cancel_batch_switch(
  p_enrollment_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     UUID;
  v_enrolled_by UUID;
  v_pending     UUID;
BEGIN
  SELECT id INTO v_user_id FROM public.users WHERE auth_id = auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT enrolled_by, pending_switch_to_batch_id
    INTO v_enrolled_by, v_pending
  FROM public.enrollments
  WHERE id = p_enrollment_id;

  IF v_enrolled_by IS NULL THEN
    RAISE EXCEPTION 'Enrollment not found';
  END IF;
  IF v_enrolled_by <> v_user_id THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  IF v_pending IS NULL THEN
    RAISE EXCEPTION 'No pending switch to cancel';
  END IF;

  UPDATE public.enrollments
     SET pending_switch_to_batch_id = NULL,
         switch_requested_at        = NULL
   WHERE id = p_enrollment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.learner_cancel_batch_switch(UUID) TO authenticated;

-- ── 6. provider_approve_batch_switch ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.provider_approve_batch_switch(
  p_enrollment_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id          UUID;
  v_provider_id      UUID;
  v_class_provider   UUID;
  v_pending          UUID;
  v_from_batch_id    UUID;
  v_to_batch_name    TEXT;
  v_to_count         INTEGER;
  v_to_max           INTEGER;
  v_to_status        TEXT;
  v_enrolled_by      UUID;
  v_class_title      TEXT;
BEGIN
  SELECT id INTO v_user_id FROM public.users WHERE auth_id = auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_provider_id
  FROM public.service_providers
  WHERE user_id = v_user_id;
  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'Not a provider';
  END IF;

  -- Pull enrollment + class + target batch info; verify ownership.
  SELECT e.pending_switch_to_batch_id, e.batch_id, e.enrolled_by,
         c.provider_id, c.title
    INTO v_pending, v_from_batch_id, v_enrolled_by, v_class_provider, v_class_title
  FROM public.enrollments e
  JOIN public.batches     b ON b.id = e.batch_id
  JOIN public.classes     c ON c.id = b.class_id
  WHERE e.id = p_enrollment_id;

  IF v_pending IS NULL THEN
    RAISE EXCEPTION 'No pending switch to approve';
  END IF;
  IF v_class_provider <> v_provider_id THEN
    RAISE EXCEPTION 'Not authorised — class belongs to another provider';
  END IF;

  -- Re-check target capacity (could have filled up since request)
  SELECT current_enrollment_count, max_batch_size, status, batch_name
    INTO v_to_count, v_to_max, v_to_status, v_to_batch_name
  FROM public.batches
  WHERE id = v_pending;

  IF v_to_status IN ('cancelled', 'completed') THEN
    RAISE EXCEPTION 'Target batch is %', v_to_status;
  END IF;
  IF v_to_count >= v_to_max THEN
    RAISE EXCEPTION 'Target batch is now full — ask the learner to pick another batch';
  END IF;

  -- Perform the switch. The trigger will recount both batches.
  UPDATE public.enrollments
     SET batch_id                   = v_pending,
         pending_switch_to_batch_id = NULL,
         switch_requested_at        = NULL
   WHERE id = p_enrollment_id;

  -- Notify the learner
  PERFORM public.send_notification(
    v_enrolled_by,
    'Batch switch approved',
    'Your switch to ' || v_to_batch_name || ' in ' || v_class_title || ' is approved.',
    'batch_switch_approved',
    'enrollment',
    p_enrollment_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.provider_approve_batch_switch(UUID) TO authenticated;

-- ── 7. provider_reject_batch_switch ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.provider_reject_batch_switch(
  p_enrollment_id UUID,
  p_reason        TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        UUID;
  v_provider_id    UUID;
  v_class_provider UUID;
  v_pending        UUID;
  v_enrolled_by    UUID;
  v_class_title    TEXT;
  v_reason_msg     TEXT;
BEGIN
  SELECT id INTO v_user_id FROM public.users WHERE auth_id = auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_provider_id
  FROM public.service_providers
  WHERE user_id = v_user_id;
  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'Not a provider';
  END IF;

  SELECT e.pending_switch_to_batch_id, e.enrolled_by, c.provider_id, c.title
    INTO v_pending, v_enrolled_by, v_class_provider, v_class_title
  FROM public.enrollments e
  JOIN public.batches     b ON b.id = e.batch_id
  JOIN public.classes     c ON c.id = b.class_id
  WHERE e.id = p_enrollment_id;

  IF v_pending IS NULL THEN
    RAISE EXCEPTION 'No pending switch to reject';
  END IF;
  IF v_class_provider <> v_provider_id THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  UPDATE public.enrollments
     SET pending_switch_to_batch_id = NULL,
         switch_requested_at        = NULL
   WHERE id = p_enrollment_id;

  v_reason_msg := 'Your batch switch request for ' || v_class_title || ' was declined.';
  IF p_reason IS NOT NULL AND length(trim(p_reason)) > 0 THEN
    v_reason_msg := v_reason_msg || ' Reason: ' || trim(p_reason);
  END IF;

  PERFORM public.send_notification(
    v_enrolled_by,
    'Batch switch declined',
    v_reason_msg,
    'batch_switch_rejected',
    'enrollment',
    p_enrollment_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.provider_reject_batch_switch(UUID, TEXT) TO authenticated;

-- Reload PostgREST schema cache so the new columns + RPCs are visible
NOTIFY pgrst, 'reload schema';

COMMIT;
