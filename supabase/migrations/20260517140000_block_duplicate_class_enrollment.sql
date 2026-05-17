-- ============================================================================
-- 20260517140000_block_duplicate_class_enrollment.sql
--
-- Problem: nothing at the DB level stops a learner from enrolling the same
-- family_member into two batches of the SAME class. The frontend has
-- a "first-time enrollment" lookup (used only to skip the registration fee),
-- but the actual INSERT path is unconstrained, so racing tabs, direct API
-- calls, or a simple UI bypass can produce two concurrent "active" enrollments
-- for one member in one class.
--
-- Fix: BEFORE INSERT/UPDATE trigger on `enrollments` that resolves
-- batch_id → class_id and raises an error if any OTHER row exists for the
-- same family_member in any batch of the same class with status ∈
-- {active, pending, paused}. The error code is set so the frontend can
-- distinguish this from generic failures and show the drop/switch prompt.
--
-- Status set: matches the frontend rule
--   - 'active'  → currently in a batch
--   - 'pending' → awaiting provider approval (seat is held)
--   - 'paused'  → temporarily paused, intent to return
-- 'completed' / 'dropped' / 'rejected' are NOT blocking — a learner who
-- finished a previous batch may legitimately re-enroll for a new term.
--
-- This is a hard safety net. The frontend (EnrollFlow) gates the same rule
-- in the UI with a friendlier drop/switch prompt; this trigger guarantees
-- correctness even if the UI is bypassed.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_one_active_enrollment_per_class()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_id     UUID;
  v_existing_id  UUID;
  v_existing_batch_name TEXT;
BEGIN
  -- Only enforce when the row's new status is one of the "occupying" states.
  -- An insert/transition to dropped/completed/rejected can never create a
  -- duplicate hold, so skip the check there.
  IF NEW.status IS NULL OR NEW.status NOT IN ('active', 'pending', 'paused') THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, only re-check if the relevant fields changed (perf nicety;
  -- correctness is identical either way).
  IF TG_OP = 'UPDATE'
     AND OLD.batch_id IS NOT DISTINCT FROM NEW.batch_id
     AND OLD.family_member_id IS NOT DISTINCT FROM NEW.family_member_id
     AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Resolve class for the target batch.
  SELECT class_id INTO v_class_id
  FROM public.batches
  WHERE id = NEW.batch_id;

  IF v_class_id IS NULL THEN
    -- Batch row gone or missing class_id — let normal FK constraint surface that.
    RETURN NEW;
  END IF;

  -- Look for any OTHER enrollment row for the same family_member in any batch
  -- of the same class with a blocking status.
  SELECT e.id, b.batch_name
  INTO   v_existing_id, v_existing_batch_name
  FROM   public.enrollments e
  JOIN   public.batches b ON b.id = e.batch_id
  WHERE  e.family_member_id = NEW.family_member_id
    AND  b.class_id = v_class_id
    AND  e.status IN ('active', 'pending', 'paused')
    AND  (TG_OP <> 'UPDATE' OR e.id <> NEW.id)
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Use a recognisable SQLSTATE + structured message so the frontend can
    -- detect this specific case and route the user into the drop/switch prompt.
    -- We pack the existing enrollment id and batch name into the message so
    -- the client can navigate without an extra round-trip.
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = format(
        'duplicate_class_enrollment: family member already enrolled in this class (existing_enrollment_id=%s, existing_batch=%s)',
        v_existing_id, COALESCE(v_existing_batch_name, '?')
      );
  END IF;

  RETURN NEW;
END;
$$;

-- Drop & recreate the trigger so this migration is idempotent.
DROP TRIGGER IF EXISTS enforce_one_active_enrollment_per_class_trg ON public.enrollments;

CREATE TRIGGER enforce_one_active_enrollment_per_class_trg
BEFORE INSERT OR UPDATE ON public.enrollments
FOR EACH ROW
EXECUTE FUNCTION public.enforce_one_active_enrollment_per_class();

-- ── Sanity smoke test (commented) ────────────────────────────────────────────
-- After applying, this should fail with the duplicate_class_enrollment error:
--   INSERT INTO enrollments (batch_id, family_member_id, enrolled_by, status)
--   VALUES ('<batch-A-of-class-X>', '<member>', '<user>', 'active');
--   INSERT INTO enrollments (batch_id, family_member_id, enrolled_by, status)
--   VALUES ('<batch-B-of-class-X>', '<member>', '<user>', 'active');  -- ✗ raises
--
-- These should still succeed (status not blocking):
--   INSERT ... status='dropped';
--   INSERT ... status='completed';
