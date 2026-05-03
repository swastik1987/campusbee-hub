-- ============================================================================
-- 005_moderation_helpers.sql  —  moderation RPCs + status-mirror trigger
-- ============================================================================
-- Apply AFTER 004_subscription_helpers.sql.
-- These functions are the only sanctioned way to write to moderation_flags
-- and to mirror the resolved status onto the source row (classes,
-- featured_banners, service_providers, ...).
-- The actual AI scoring happens in the `ai-moderate-content` edge function
-- (Phase 3); these helpers are the DB write-side of that pipeline.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- submit_for_moderation — called by edge function with AI scoring result
-- ---------------------------------------------------------------------------
-- Behaviours:
--   * Inserts a moderation_flags row with the AI verdict
--   * Mirrors the verdict onto the source row's `moderation_status`
--   * Notifies the content owner if rejected
--
-- Status mapping for the source row:
--   'approved'  -> source moderation_status = 'approved'
--   'in_review' -> source moderation_status = 'in_review'
--   'rejected'  -> source moderation_status = 'rejected'
CREATE OR REPLACE FUNCTION public.submit_for_moderation(
  p_ref_type        TEXT,                  -- 'class_image' | 'class_text' | 'class_title' | 'class_description' | 'provider_avatar' | 'provider_bio' | 'banner'
  p_ref_id          UUID,
  p_owner_user_id   UUID,
  p_ai_provider     TEXT,                  -- 'sightengine' | 'openai' | 'manual'
  p_ai_score        NUMERIC DEFAULT NULL,
  p_ai_categories   JSONB   DEFAULT NULL,
  p_initial_status  TEXT    DEFAULT 'in_review',  -- usually computed by edge fn
  p_content_snapshot TEXT   DEFAULT NULL,
  p_image_url       TEXT    DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flag_id UUID;
BEGIN
  IF p_initial_status NOT IN ('in_review','approved','rejected') THEN
    RAISE EXCEPTION 'invalid initial status: %', p_initial_status;
  END IF;

  INSERT INTO public.moderation_flags (
    ref_type, ref_id, owner_user_id,
    content_snapshot, image_url,
    ai_provider, ai_score, ai_categories,
    status,
    reviewed_at, reviewed_by
  ) VALUES (
    p_ref_type, p_ref_id, p_owner_user_id,
    p_content_snapshot, p_image_url,
    p_ai_provider, p_ai_score, p_ai_categories,
    p_initial_status,
    CASE WHEN p_initial_status IN ('approved','rejected') THEN now() END,
    NULL  -- AI verdicts have no human reviewer
  ) RETURNING id INTO v_flag_id;

  -- Mirror onto source row
  PERFORM public._mirror_moderation_status(p_ref_type, p_ref_id, p_initial_status);

  -- Notify owner if auto-rejected (in_review queues silently; approved is silent too)
  IF p_initial_status = 'rejected' AND p_owner_user_id IS NOT NULL THEN
    PERFORM public.send_notification(
      p_owner_user_id,
      'Content Rejected',
      'Your ' || p_ref_type || ' was rejected by automated moderation. You can edit and resubmit.',
      'content_rejected',
      p_ref_type,
      p_ref_id
    );
  END IF;

  RETURN v_flag_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_for_moderation(
  TEXT, UUID, UUID, TEXT, NUMERIC, JSONB, TEXT, TEXT, TEXT
) TO service_role;
-- Note: NOT granted to authenticated. The edge function (running as service_role)
-- is the only caller. App code must go through the edge function so AI scoring
-- happens before insert.

-- ---------------------------------------------------------------------------
-- resolve_moderation_flag — admin reviews a queued flag
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_moderation_flag(
  p_flag_id UUID,
  p_status  TEXT,         -- 'approved' | 'rejected'
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

  -- Mirror to source row
  PERFORM public._mirror_moderation_status(v_flag.ref_type, v_flag.ref_id, p_status);

  -- Notify owner
  IF v_flag.owner_user_id IS NOT NULL THEN
    PERFORM public.send_notification(
      v_flag.owner_user_id,
      CASE WHEN p_status = 'approved' THEN 'Content Approved' ELSE 'Content Rejected' END,
      CASE
        WHEN p_status = 'approved' THEN 'Your ' || v_flag.ref_type || ' has been approved and is now live.'
        ELSE 'Your ' || v_flag.ref_type || ' was rejected by the moderation team. ' || COALESCE(p_notes, '')
      END,
      CASE WHEN p_status = 'approved' THEN 'content_approved' ELSE 'content_rejected' END,
      v_flag.ref_type,
      v_flag.ref_id
    );
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.resolve_moderation_flag(UUID, TEXT, TEXT)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- _mirror_moderation_status — internal helper writing to the source row
-- ---------------------------------------------------------------------------
-- For class images and titles/descriptions, we update classes.moderation_status.
-- For banners, featured_banners.moderation_status.
-- For provider avatars/bio, service_providers gets no moderation_status column
-- (moderation outcome only affects whether the avatar/bio is publicly shown via
-- app code; we simply leave the flag and let the app react). We still want
-- this helper to be a no-op for those types rather than an error.
CREATE OR REPLACE FUNCTION public._mirror_moderation_status(
  p_ref_type TEXT,
  p_ref_id   UUID,
  p_status   TEXT  -- 'approved' | 'in_review' | 'rejected'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  CASE p_ref_type
    WHEN 'class_image', 'class_text', 'class_title', 'class_description' THEN
      UPDATE public.classes
      SET    moderation_status = p_status,
             updated_at        = now()
      WHERE  id = p_ref_id;

      -- If a published class gets rejected, kick it back to draft
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

    WHEN 'provider_avatar', 'provider_bio' THEN
      -- No mirror column. App enforces visibility based on the latest flag.
      NULL;

    ELSE
      RAISE EXCEPTION 'unknown ref_type: %', p_ref_type;
  END CASE;
END;
$$;
-- Internal — no grants beyond function owner.

-- ---------------------------------------------------------------------------
-- get_pending_moderation_count — admin dashboard widget
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_pending_moderation_count()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::INTEGER
  FROM   public.moderation_flags
  WHERE  status = 'in_review';
$$;
GRANT EXECUTE ON FUNCTION public.get_pending_moderation_count() TO authenticated;

COMMIT;

-- ============================================================================
-- Post-moderation-helpers checklist:
--   [ ] SELECT public.get_pending_moderation_count();  -- 0
--   [ ] Verify policies: anon cannot SELECT moderation_flags
--   [ ] Run 006_geo_helpers.sql next
-- ============================================================================
