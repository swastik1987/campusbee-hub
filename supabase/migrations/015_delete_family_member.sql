-- ============================================================
-- CampusBee — 015_delete_family_member.sql
--
-- Adds soft-delete support for family_members:
--   1. Adds `deleted_at TIMESTAMPTZ` column (idempotent)
--   2. Creates `delete_family_member(UUID)` SECURITY DEFINER RPC that:
--        • Validates caller is in the family (via is_in_family helper)
--        • Soft-deletes the member (is_active=false, deleted_at=now())
--        • Auto-drops active/pending enrollments → status='dropped'
--        • Notifies each affected provider via send_notification RPC
--        • Cancels registered demo_registrations
--        • Cancels waiting/offered waitlist_entries
--      Schema-aware: detects whether classes uses provider_id (v2)
--      or provider_registration_id (v1) and queries accordingly.
--
-- Run in: supabase.com/dashboard/project/.../editor
-- Safe to re-run (CREATE OR REPLACE + ADD COLUMN IF NOT EXISTS).
-- ============================================================

-- ── 1. Add deleted_at column to family_members (idempotent) ──────────────────

ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ── 2. delete_family_member SECURITY DEFINER RPC ─────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_family_member(p_member_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_family_id        UUID;
  v_member_name      TEXT;
  v_has_provider_id  BOOLEAN;
  v_enrollment_q     TEXT;
  v_rec              RECORD;
BEGIN
  -- ── Step 1: Load the member and check it isn't already deleted ──
  SELECT family_id, full_name
    INTO v_family_id, v_member_name
    FROM public.family_members
   WHERE id = p_member_id
     AND is_active IS DISTINCT FROM false;   -- accepts NULL (v1) or true

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'Member not found or already removed (id: %)', p_member_id;
  END IF;

  -- ── Step 2: Authorisation — caller must belong to this family ──
  IF NOT public.is_in_family(v_family_id) THEN
    RAISE EXCEPTION 'Unauthorized: you are not a member of this family';
  END IF;

  -- ── Step 3: Detect DB schema version ──
  -- v2: classes.provider_id → service_providers.user_id (direct)
  -- v1: classes.provider_registration_id → provider_apartment_registrations → service_providers
  SELECT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'classes'
       AND column_name  = 'provider_id'
  ) INTO v_has_provider_id;

  -- ── Step 4: Build schema-aware enrollment query ──
  IF v_has_provider_id THEN
    -- v2 join path
    v_enrollment_q := $q$
      SELECT
        e.id          AS enrollment_id,
        u.id          AS provider_user_id,
        c.title       AS class_title
      FROM public.enrollments   e
      JOIN public.batches       b   ON b.id  = e.batch_id
      JOIN public.classes       c   ON c.id  = b.class_id
      JOIN public.service_providers sp ON sp.id = c.provider_id
      JOIN public.users         u   ON u.id  = sp.user_id
     WHERE e.family_member_id = $1
       AND e.status IN ('active', 'pending')
    $q$;
  ELSE
    -- v1 join path (live DB as of May 2026)
    v_enrollment_q := $q$
      SELECT
        e.id          AS enrollment_id,
        u.id          AS provider_user_id,
        c.title       AS class_title
      FROM public.enrollments                     e
      JOIN public.batches                         b   ON b.id   = e.batch_id
      JOIN public.classes                         c   ON c.id   = b.class_id
      JOIN public.provider_apartment_registrations par ON par.id = c.provider_registration_id
      JOIN public.service_providers               sp  ON sp.id  = par.provider_id
      JOIN public.users                           u   ON u.id   = sp.user_id
     WHERE e.family_member_id = $1
       AND e.status IN ('active', 'pending')
    $q$;
  END IF;

  -- ── Step 5: Drop enrollments & notify each provider ──
  FOR v_rec IN EXECUTE v_enrollment_q USING p_member_id LOOP

    -- Mark enrollment as dropped
    UPDATE public.enrollments
       SET status      = 'dropped',
           dropped_at  = now(),
           drop_reason = 'Family member removed by account holder'
     WHERE id = v_rec.enrollment_id;

    -- Notify the provider (best-effort; skip if user_id not found)
    IF v_rec.provider_user_id IS NOT NULL THEN
      PERFORM public.send_notification(
        v_rec.provider_user_id,
        'Student removed from family',
        COALESCE(v_member_name, 'A student') ||
          ' has been removed from their family account and dropped from ' ||
          COALESCE(v_rec.class_title, 'a class') || '.',
        'member_deleted',
        'enrollment',
        v_rec.enrollment_id
      );
    END IF;

  END LOOP;

  -- ── Step 6: Cancel pending demo registrations ──
  UPDATE public.demo_registrations
     SET status = 'cancelled'
   WHERE family_member_id = p_member_id
     AND status = 'registered';

  -- ── Step 7: Cancel active waitlist entries ──
  UPDATE public.waitlist_entries
     SET status = 'cancelled'
   WHERE family_member_id = p_member_id
     AND status IN ('waiting', 'offered');

  -- ── Step 8: Soft-delete the family member (last, after cascades) ──
  UPDATE public.family_members
     SET is_active  = false,
         deleted_at = now()
   WHERE id = p_member_id;

END;
$$;

-- Grant execute to logged-in users (RLS inside the function enforces family membership)
GRANT EXECUTE ON FUNCTION public.delete_family_member(UUID) TO authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
