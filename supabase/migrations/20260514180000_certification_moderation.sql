-- ============================================================================
-- 20260514180000_certification_moderation.sql
--   Wire `certification` ref_type into the moderation pipeline.
--   Adds bulk-approve RPC for platform admin.
-- ============================================================================
-- Why this is needed:
--   * `_mirror_moderation_status` raises an exception for unknown ref_types.
--     The `certification` value was added to `moderation_flags.ref_type` CHECK
--     in 20260513055502 but the mirror helper was never updated, so the
--     ai-moderate-content edge function fails on every cert submission.
--   * `submit_for_moderation` includes the AI verdict in `ai_categories`. For
--     the cert pipeline we also want a human-readable reason copied into
--     `certifications.moderation_notes`. Done via mirror.
--   * Admins need a bulk-approve action for cert queues from the same provider.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- _mirror_moderation_status — add certification branch
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._mirror_moderation_status(
  p_ref_type TEXT,
  p_ref_id   UUID,
  p_status   TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT;
BEGIN
  CASE p_ref_type
    WHEN 'class_image', 'class_text', 'class_title', 'class_description' THEN
      UPDATE public.classes
      SET    moderation_status = p_status,
             updated_at        = now()
      WHERE  id = p_ref_id;

      IF p_status = 'rejected' THEN
        UPDATE public.classes
        SET    status     = 'draft',
               updated_at = now()
        WHERE  id = p_ref_id AND status = 'published';
      END IF;

    WHEN 'banner' THEN
      UPDATE public.featured_banners
      SET    moderation_status = p_status
      WHERE  id = p_ref_id;

      IF p_status = 'rejected' THEN
        UPDATE public.featured_banners
        SET    status = 'rejected'
        WHERE  id = p_ref_id;
      END IF;

    WHEN 'certification' THEN
      -- Pull the human-readable reason out of the latest flag's
      -- ai_categories JSON (written by the edge function on cert rejects),
      -- falling back to a generic line if absent.
      SELECT COALESCE(
               (ai_categories ->> 'rejection_reason'),
               (ai_categories -> 'gemini_vision' ->> 'reasoning')
             )
      INTO   v_reason
      FROM   public.moderation_flags
      WHERE  ref_type = 'certification'
        AND  ref_id   = p_ref_id
      ORDER BY created_at DESC
      LIMIT 1;

      UPDATE public.certifications
      SET    moderation_status = p_status,
             moderation_notes  = CASE
               WHEN p_status = 'rejected' THEN COALESCE(v_reason, 'Rejected by automated review.')
               WHEN p_status = 'approved' THEN NULL
               ELSE moderation_notes
             END
      WHERE  id = p_ref_id;

    WHEN 'provider_avatar', 'provider_bio' THEN
      NULL;

    ELSE
      RAISE EXCEPTION 'unknown ref_type: %', p_ref_type;
  END CASE;
END;
$$;

-- ---------------------------------------------------------------------------
-- bulk_approve_certifications — admin batch action
-- ---------------------------------------------------------------------------
-- Approves every in_review certification flag whose ref_id is in p_cert_ids.
-- All target flags must belong to the same provider for safety; mismatches
-- are skipped (silently — counted in the returned `skipped` field).
-- Mirrors status, notifies each owner, and writes the audit trail
-- (reviewed_by + reviewed_at + action_notes).
CREATE OR REPLACE FUNCTION public.bulk_approve_certifications(
  p_provider_id UUID,
  p_cert_ids    UUID[],
  p_notes       TEXT DEFAULT NULL
)
RETURNS TABLE (approved_count INTEGER, skipped_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id   UUID;
  v_approved   INTEGER := 0;
  v_skipped    INTEGER := 0;
  v_flag       RECORD;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden: platform admin only';
  END IF;

  v_admin_id := public.current_user_id();

  FOR v_flag IN
    SELECT mf.id, mf.ref_id, mf.owner_user_id, c.provider_id
    FROM   public.moderation_flags mf
    JOIN   public.certifications  c ON c.id = mf.ref_id
    WHERE  mf.ref_type = 'certification'
      AND  mf.status   = 'in_review'
      AND  mf.ref_id   = ANY(p_cert_ids)
    FOR UPDATE OF mf
  LOOP
    IF v_flag.provider_id IS DISTINCT FROM p_provider_id THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    UPDATE public.moderation_flags
    SET    status       = 'approved',
           action_notes = COALESCE(p_notes, 'Bulk-approved by platform admin'),
           reviewed_by  = v_admin_id,
           reviewed_at  = now()
    WHERE  id = v_flag.id;

    PERFORM public._mirror_moderation_status('certification', v_flag.ref_id, 'approved');

    IF v_flag.owner_user_id IS NOT NULL THEN
      PERFORM public.send_notification(
        v_flag.owner_user_id,
        'Certification Approved',
        'Your certification has been verified and is now visible on your profile.',
        'certification_approved',
        'certification',
        v_flag.ref_id
      );
    END IF;

    v_approved := v_approved + 1;
  END LOOP;

  RETURN QUERY SELECT v_approved, v_skipped;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_approve_certifications(UUID, UUID[], TEXT)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- resolve_moderation_flag — extend notification path to cert-specific types
-- ---------------------------------------------------------------------------
-- The base function (in migration 005) sends generic content_approved /
-- content_rejected notifications. For certifications we override with the
-- cert-specific notification types so the in-app notification center can
-- render the right copy + link.
CREATE OR REPLACE FUNCTION public.resolve_moderation_flag(
  p_flag_id UUID,
  p_status  TEXT,
  p_notes   TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_user_id UUID;
  v_flag          RECORD;
  v_is_cert       BOOLEAN;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden: platform admin only';
  END IF;
  IF p_status NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'status must be approved or rejected';
  END IF;

  v_admin_user_id := public.current_user_id();

  SELECT * INTO v_flag
  FROM   public.moderation_flags
  WHERE  id = p_flag_id AND status = 'in_review'
  FOR UPDATE;

  IF v_flag.id IS NULL THEN
    RAISE EXCEPTION 'flag not found or not in review';
  END IF;

  UPDATE public.moderation_flags
  SET    status       = p_status,
         action_notes = p_notes,
         reviewed_by  = v_admin_user_id,
         reviewed_at  = now()
  WHERE  id = p_flag_id;

  PERFORM public._mirror_moderation_status(v_flag.ref_type, v_flag.ref_id, p_status);

  v_is_cert := (v_flag.ref_type = 'certification');

  IF v_flag.owner_user_id IS NOT NULL THEN
    PERFORM public.send_notification(
      v_flag.owner_user_id,
      CASE
        WHEN v_is_cert AND p_status = 'approved' THEN 'Certification Approved'
        WHEN v_is_cert AND p_status = 'rejected' THEN 'Certification Rejected'
        WHEN p_status = 'approved' THEN 'Content Approved'
        ELSE 'Content Rejected'
      END,
      CASE
        WHEN v_is_cert AND p_status = 'approved'
          THEN 'Your certification has been verified and is now visible on your profile.'
        WHEN v_is_cert AND p_status = 'rejected'
          THEN 'Your certification was rejected. ' || COALESCE(p_notes, 'Please review and re-upload.')
        WHEN p_status = 'approved'
          THEN 'Your ' || v_flag.ref_type || ' has been approved and is now live.'
        ELSE 'Your ' || v_flag.ref_type || ' was rejected by the moderation team. ' || COALESCE(p_notes, '')
      END,
      CASE
        WHEN v_is_cert AND p_status = 'approved' THEN 'certification_approved'
        WHEN v_is_cert AND p_status = 'rejected' THEN 'certification_rejected'
        WHEN p_status = 'approved' THEN 'content_approved'
        ELSE 'content_rejected'
      END,
      v_flag.ref_type,
      v_flag.ref_id
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_moderation_flag(UUID, TEXT, TEXT)
  TO authenticated;

COMMIT;

-- ============================================================================
-- Post-migration checklist:
--   [ ] Confirm certifications inserted via the app now successfully complete
--       the edge function call (no more "unknown ref_type" exceptions).
--   [ ] Confirm rejected certifications carry the rejection_reason in
--       certifications.moderation_notes.
--   [ ] Bulk approve as platform admin: should approve only matching provider's
--       certs and skip others.
-- ============================================================================
