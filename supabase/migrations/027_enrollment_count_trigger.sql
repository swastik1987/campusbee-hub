-- ============================================================================
-- 027_enrollment_count_trigger.sql
--
-- Problem: batches.current_enrollment_count is a plain INTEGER DEFAULT 0 with
-- no mechanism to keep it in sync with actual enrollment rows.  All seat-count
-- displays (provider batch cards, provider students page, seeker class detail,
-- enroll-flow full/waitlist check) were therefore always showing 0 slots used.
--
-- Fix:
--   1. A SECURITY DEFINER trigger function that recounts enrollments with
--      status IN ('active','pending') for the affected batch and writes the
--      result back into batches.current_enrollment_count.
--   2. It also auto-flips batches.status between 'active' and 'full' so the
--      seeker enroll-flow "Full – Waitlist open" indicator stays correct.
--   3. A one-time backfill so existing data is immediately accurate.
-- ============================================================================

-- ── 1. Trigger function ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_batch_enrollment_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_id UUID;
  v_old_batch UUID;
  v_count     INTEGER;
  v_max       INTEGER;
BEGIN
  -- ── Identify which batch(es) need refreshing ─────────────────────────────
  IF TG_OP = 'DELETE' THEN
    v_batch_id := OLD.batch_id;
  ELSE
    v_batch_id := NEW.batch_id;
  END IF;

  -- If batch_id itself changed (shouldn't happen, but be safe), also refresh
  -- the previous batch.
  IF TG_OP = 'UPDATE' AND OLD.batch_id IS DISTINCT FROM NEW.batch_id THEN
    v_old_batch := OLD.batch_id;

    SELECT COUNT(*) INTO v_count
    FROM   public.enrollments
    WHERE  batch_id = v_old_batch
      AND  status IN ('active', 'pending');

    SELECT max_batch_size INTO v_max FROM public.batches WHERE id = v_old_batch;

    UPDATE public.batches
    SET    current_enrollment_count = v_count,
           status = CASE
             WHEN status IN ('paused', 'cancelled', 'completed', 'draft') THEN status
             WHEN v_count >= v_max THEN 'full'
             ELSE 'active'
           END
    WHERE  id = v_old_batch;
  END IF;

  -- ── Refresh the primary batch ─────────────────────────────────────────────
  SELECT COUNT(*) INTO v_count
  FROM   public.enrollments
  WHERE  batch_id = v_batch_id
    AND  status IN ('active', 'pending');

  SELECT max_batch_size INTO v_max FROM public.batches WHERE id = v_batch_id;

  UPDATE public.batches
  SET    current_enrollment_count = v_count,
         status = CASE
           WHEN status IN ('paused', 'cancelled', 'completed', 'draft') THEN status
           WHEN v_count >= v_max THEN 'full'
           ELSE 'active'
         END
  WHERE  id = v_batch_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ── 2. Trigger on enrollments ─────────────────────────────────────────────

-- Drop first so re-running this migration is safe
DROP TRIGGER IF EXISTS trg_sync_batch_enrollment_count ON public.enrollments;

CREATE TRIGGER trg_sync_batch_enrollment_count
AFTER INSERT OR DELETE OR UPDATE OF status ON public.enrollments
FOR EACH ROW
EXECUTE FUNCTION public.sync_batch_enrollment_count();

-- ── 3. One-time backfill for existing data ────────────────────────────────

-- Set current_enrollment_count = # of active/pending enrollments per batch
WITH counts AS (
  SELECT batch_id, COUNT(*) AS cnt
  FROM   public.enrollments
  WHERE  status IN ('active', 'pending')
  GROUP  BY batch_id
)
UPDATE public.batches b
SET    current_enrollment_count = c.cnt
FROM   counts c
WHERE  b.id = c.batch_id;

-- Zero out batches with no qualifying enrollments (avoids leftover dirty data)
UPDATE public.batches
SET    current_enrollment_count = 0
WHERE  id NOT IN (
  SELECT DISTINCT batch_id FROM public.enrollments
  WHERE  status IN ('active', 'pending')
);

-- Fix any batches whose status should reflect their real capacity state
UPDATE public.batches
SET    status = 'full'
WHERE  status = 'active'
  AND  current_enrollment_count >= max_batch_size;

UPDATE public.batches
SET    status = 'active'
WHERE  status = 'full'
  AND  current_enrollment_count < max_batch_size;
