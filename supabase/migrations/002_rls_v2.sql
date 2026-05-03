-- ============================================================================
-- 002_rls_v2.sql  —  RLS policies + SECURITY DEFINER helpers
-- ============================================================================
-- Apply AFTER 001_baseline_v2.sql.
-- Pattern: foundational helpers first, then enable RLS table-by-table with
-- policies. send_notification RPC also lives here since notifications RLS
-- depends on it.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER helpers
-- ---------------------------------------------------------------------------
-- All helpers stash their result into a single CTE-style lookup. They run as
-- the function owner (postgres) which bypasses RLS, so policies can call them
-- without triggering recursion.

-- Map auth.uid() -> public.users.id
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- Is the current user a platform admin?
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (SELECT is_platform_admin FROM public.users WHERE auth_id = auth.uid() LIMIT 1),
    false
  );
$$;

-- Does the current user own this provider?
CREATE OR REPLACE FUNCTION public.is_provider_owner(p_provider_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.service_providers sp
    JOIN public.users u ON u.id = sp.user_id
    WHERE sp.id = p_provider_id AND u.auth_id = auth.uid()
  );
$$;

-- Does the current user own this class (via its provider)?
CREATE OR REPLACE FUNCTION public.is_class_owner(p_class_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes c
    JOIN public.service_providers sp ON sp.id = c.provider_id
    JOIN public.users u ON u.id = sp.user_id
    WHERE c.id = p_class_id AND u.auth_id = auth.uid()
  );
$$;

-- Does the current user belong to this family (primary or linked)?
CREATE OR REPLACE FUNCTION public.is_in_family(p_family_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.families f
    JOIN public.users u ON u.id = f.primary_user_id
    WHERE f.id = p_family_id AND u.auth_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.family_links fl
    JOIN public.users u ON u.id = fl.user_id
    WHERE fl.family_id = p_family_id
      AND fl.status = 'active'
      AND u.auth_id = auth.uid()
  );
$$;

-- Does the current user own this family member (via family link)?
CREATE OR REPLACE FUNCTION public.owns_family_member(p_member_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members fm
    WHERE fm.id = p_member_id
      AND public.is_in_family(fm.family_id)
  );
$$;

-- Does the current user own this enrollment (as the family)?
CREATE OR REPLACE FUNCTION public.owns_enrollment(p_enrollment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.id = p_enrollment_id
      AND public.owns_family_member(e.family_member_id)
  );
$$;

-- Does the current user provide the class this enrollment is for?
CREATE OR REPLACE FUNCTION public.provider_of_enrollment(p_enrollment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments e
    JOIN public.batches b   ON b.id = e.batch_id
    JOIN public.classes c   ON c.id = b.class_id
    WHERE e.id = p_enrollment_id
      AND public.is_provider_owner(c.provider_id)
  );
$$;

-- Is the current user a participant in this chat conversation?
CREATE OR REPLACE FUNCTION public.is_chat_participant(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_conversations cc
    WHERE cc.id = p_conversation_id
      AND public.current_user_id() = ANY (cc.participant_ids)
  );
$$;

-- ---------------------------------------------------------------------------
-- send_notification — single canonical insert path for notifications
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_notification(
  p_user_id   UUID,
  p_title     TEXT,
  p_body      TEXT,
  p_type      TEXT,
  p_ref_type  TEXT DEFAULT NULL,
  p_ref_id    UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, title, body, type, ref_type, ref_id)
  VALUES (p_user_id, p_title, p_body, p_type, p_ref_type, p_ref_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.send_notification(UUID, TEXT, TEXT, TEXT, TEXT, UUID)
  TO authenticated, service_role;


-- ---------------------------------------------------------------------------
-- Enable RLS on every public table
-- ---------------------------------------------------------------------------
ALTER TABLE public.users                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_links                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_invites                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_providers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainers                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_subscription_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_categories               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_schedules                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_addons                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_sessions                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_registrations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist_entries               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_materials                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsored_listings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_banners               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_flags               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings              ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- USERS
-- ============================================================================
CREATE POLICY users_self_select ON public.users
  FOR SELECT USING (auth_id = auth.uid());
CREATE POLICY users_public_provider_select ON public.users
  FOR SELECT USING (is_provider = true);
CREATE POLICY users_admin_select ON public.users
  FOR SELECT USING (public.is_platform_admin());
CREATE POLICY users_self_insert ON public.users
  FOR INSERT WITH CHECK (auth_id = auth.uid());
CREATE POLICY users_self_update ON public.users
  FOR UPDATE USING (auth_id = auth.uid()) WITH CHECK (auth_id = auth.uid());

-- ============================================================================
-- FAMILIES
-- ============================================================================
CREATE POLICY families_member_select ON public.families
  FOR SELECT USING (public.is_in_family(id));
CREATE POLICY families_admin_select ON public.families
  FOR SELECT USING (public.is_platform_admin());
CREATE POLICY families_self_insert ON public.families
  FOR INSERT WITH CHECK (primary_user_id = public.current_user_id());
CREATE POLICY families_primary_update ON public.families
  FOR UPDATE USING (primary_user_id = public.current_user_id());
CREATE POLICY families_primary_delete ON public.families
  FOR DELETE USING (primary_user_id = public.current_user_id());

-- ============================================================================
-- FAMILY_MEMBERS
-- ============================================================================
CREATE POLICY family_members_in_family_select ON public.family_members
  FOR SELECT USING (public.is_in_family(family_id));
CREATE POLICY family_members_admin_select ON public.family_members
  FOR SELECT USING (public.is_platform_admin());
CREATE POLICY family_members_in_family_insert ON public.family_members
  FOR INSERT WITH CHECK (public.is_in_family(family_id));
CREATE POLICY family_members_in_family_update ON public.family_members
  FOR UPDATE USING (public.is_in_family(family_id));
CREATE POLICY family_members_in_family_delete ON public.family_members
  FOR DELETE USING (public.is_in_family(family_id));

-- ============================================================================
-- FAMILY_LINKS
-- ============================================================================
CREATE POLICY family_links_in_family_select ON public.family_links
  FOR SELECT USING (public.is_in_family(family_id) OR user_id = public.current_user_id());
CREATE POLICY family_links_self_insert ON public.family_links
  FOR INSERT WITH CHECK (user_id = public.current_user_id());
CREATE POLICY family_links_self_update ON public.family_links
  FOR UPDATE USING (user_id = public.current_user_id() OR public.is_in_family(family_id));
CREATE POLICY family_links_self_delete ON public.family_links
  FOR DELETE USING (user_id = public.current_user_id() OR public.is_in_family(family_id));

-- ============================================================================
-- FAMILY_INVITES
-- ============================================================================
CREATE POLICY family_invites_owner_select ON public.family_invites
  FOR SELECT USING (
    public.is_in_family(family_id)
    OR invited_user_id = public.current_user_id()
  );
CREATE POLICY family_invites_owner_insert ON public.family_invites
  FOR INSERT WITH CHECK (public.is_in_family(family_id));
CREATE POLICY family_invites_owner_update ON public.family_invites
  FOR UPDATE USING (
    public.is_in_family(family_id)
    OR invited_user_id = public.current_user_id()
  );
CREATE POLICY family_invites_owner_delete ON public.family_invites
  FOR DELETE USING (public.is_in_family(family_id));


-- ============================================================================
-- SERVICE_PROVIDERS  (public profile)
-- ============================================================================
CREATE POLICY providers_public_select ON public.service_providers
  FOR SELECT USING (suspended_at IS NULL);
CREATE POLICY providers_self_select ON public.service_providers
  FOR SELECT USING (user_id = public.current_user_id());
CREATE POLICY providers_admin_select ON public.service_providers
  FOR SELECT USING (public.is_platform_admin());
CREATE POLICY providers_self_insert ON public.service_providers
  FOR INSERT WITH CHECK (user_id = public.current_user_id());
CREATE POLICY providers_self_update ON public.service_providers
  FOR UPDATE USING (user_id = public.current_user_id());
CREATE POLICY providers_admin_update ON public.service_providers
  FOR UPDATE USING (public.is_platform_admin());

-- ============================================================================
-- TRAINERS
-- ============================================================================
CREATE POLICY trainers_public_select ON public.trainers
  FOR SELECT USING (true);
CREATE POLICY trainers_owner_modify ON public.trainers
  FOR ALL USING (public.is_provider_owner(provider_id))
         WITH CHECK (public.is_provider_owner(provider_id));

-- ============================================================================
-- SUBSCRIPTION REQUESTS
-- ============================================================================
CREATE POLICY subreq_owner_select ON public.provider_subscription_requests
  FOR SELECT USING (public.is_provider_owner(provider_id));
CREATE POLICY subreq_admin_select ON public.provider_subscription_requests
  FOR SELECT USING (public.is_platform_admin());
CREATE POLICY subreq_owner_insert ON public.provider_subscription_requests
  FOR INSERT WITH CHECK (public.is_provider_owner(provider_id));
CREATE POLICY subreq_admin_update ON public.provider_subscription_requests
  FOR UPDATE USING (public.is_platform_admin());

-- ============================================================================
-- CLASS CATEGORIES  (public read, admin-managed)
-- ============================================================================
CREATE POLICY categories_public_select ON public.class_categories
  FOR SELECT USING (true);
CREATE POLICY categories_admin_modify ON public.class_categories
  FOR ALL USING (public.is_platform_admin())
         WITH CHECK (public.is_platform_admin());

-- ============================================================================
-- CLASSES
-- ============================================================================
CREATE POLICY classes_public_select ON public.classes
  FOR SELECT USING (status = 'published' AND moderation_status = 'approved');
CREATE POLICY classes_owner_select ON public.classes
  FOR SELECT USING (public.is_provider_owner(provider_id));
CREATE POLICY classes_admin_select ON public.classes
  FOR SELECT USING (public.is_platform_admin());
CREATE POLICY classes_owner_insert ON public.classes
  FOR INSERT WITH CHECK (public.is_provider_owner(provider_id));
CREATE POLICY classes_owner_update ON public.classes
  FOR UPDATE USING (public.is_provider_owner(provider_id));
CREATE POLICY classes_owner_delete ON public.classes
  FOR DELETE USING (public.is_provider_owner(provider_id));
CREATE POLICY classes_admin_update ON public.classes
  FOR UPDATE USING (public.is_platform_admin());

-- ============================================================================
-- BATCHES
-- ============================================================================
CREATE POLICY batches_public_select ON public.batches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = batches.class_id
        AND c.status = 'published'
        AND c.moderation_status = 'approved'
    )
  );
CREATE POLICY batches_owner_modify ON public.batches
  FOR ALL USING (public.is_class_owner(class_id))
         WITH CHECK (public.is_class_owner(class_id));

-- ============================================================================
-- BATCH SCHEDULES
-- ============================================================================
CREATE POLICY schedules_public_select ON public.batch_schedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.batches b
      JOIN public.classes c ON c.id = b.class_id
      WHERE b.id = batch_schedules.batch_id
        AND c.status = 'published'
        AND c.moderation_status = 'approved'
    )
  );
CREATE POLICY schedules_owner_modify ON public.batch_schedules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.batches b
      WHERE b.id = batch_schedules.batch_id
        AND public.is_class_owner(b.class_id)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.batches b
      WHERE b.id = batch_schedules.batch_id
        AND public.is_class_owner(b.class_id)
    )
  );

-- ============================================================================
-- CLASS ADDONS
-- ============================================================================
CREATE POLICY addons_public_select ON public.class_addons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_addons.class_id
        AND c.status = 'published'
        AND c.moderation_status = 'approved'
    )
  );
CREATE POLICY addons_owner_modify ON public.class_addons
  FOR ALL USING (public.is_class_owner(class_id))
         WITH CHECK (public.is_class_owner(class_id));

-- ============================================================================
-- DEMO SESSIONS
-- ============================================================================
CREATE POLICY demos_public_select ON public.demo_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = demo_sessions.class_id
        AND c.status = 'published'
        AND c.moderation_status = 'approved'
    )
  );
CREATE POLICY demos_owner_modify ON public.demo_sessions
  FOR ALL USING (public.is_class_owner(class_id))
         WITH CHECK (public.is_class_owner(class_id));

-- ============================================================================
-- DEMO REGISTRATIONS
-- ============================================================================
CREATE POLICY demoreg_family_select ON public.demo_registrations
  FOR SELECT USING (public.owns_family_member(family_member_id));
CREATE POLICY demoreg_provider_select ON public.demo_registrations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.demo_sessions ds
      WHERE ds.id = demo_registrations.demo_session_id
        AND public.is_class_owner(ds.class_id)
    )
  );
CREATE POLICY demoreg_family_insert ON public.demo_registrations
  FOR INSERT WITH CHECK (
    public.owns_family_member(family_member_id)
    AND registered_by = public.current_user_id()
  );
CREATE POLICY demoreg_family_update ON public.demo_registrations
  FOR UPDATE USING (public.owns_family_member(family_member_id));
CREATE POLICY demoreg_provider_update ON public.demo_registrations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.demo_sessions ds
      WHERE ds.id = demo_registrations.demo_session_id
        AND public.is_class_owner(ds.class_id)
    )
  );

-- ============================================================================
-- ENROLLMENTS
-- ============================================================================
CREATE POLICY enr_family_select ON public.enrollments
  FOR SELECT USING (public.owns_family_member(family_member_id));
CREATE POLICY enr_provider_select ON public.enrollments
  FOR SELECT USING (public.provider_of_enrollment(id));
CREATE POLICY enr_admin_select ON public.enrollments
  FOR SELECT USING (public.is_platform_admin());
CREATE POLICY enr_family_insert ON public.enrollments
  FOR INSERT WITH CHECK (
    public.owns_family_member(family_member_id)
    AND enrolled_by = public.current_user_id()
  );
CREATE POLICY enr_family_update ON public.enrollments
  FOR UPDATE USING (public.owns_family_member(family_member_id));
CREATE POLICY enr_provider_update ON public.enrollments
  FOR UPDATE USING (public.provider_of_enrollment(id));
CREATE POLICY enr_family_delete ON public.enrollments
  FOR DELETE USING (public.owns_family_member(family_member_id));

-- ============================================================================
-- WAITLIST ENTRIES
-- ============================================================================
CREATE POLICY waitlist_family_select ON public.waitlist_entries
  FOR SELECT USING (public.owns_family_member(family_member_id));
CREATE POLICY waitlist_provider_select ON public.waitlist_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.batches b
      WHERE b.id = waitlist_entries.batch_id
        AND public.is_class_owner(b.class_id)
    )
  );
CREATE POLICY waitlist_family_insert ON public.waitlist_entries
  FOR INSERT WITH CHECK (public.owns_family_member(family_member_id));
CREATE POLICY waitlist_family_delete ON public.waitlist_entries
  FOR DELETE USING (public.owns_family_member(family_member_id));

-- ============================================================================
-- ATTENDANCE
-- ============================================================================
CREATE POLICY attendance_family_select ON public.attendance_records
  FOR SELECT USING (public.owns_enrollment(enrollment_id));
CREATE POLICY attendance_provider_select ON public.attendance_records
  FOR SELECT USING (public.provider_of_enrollment(enrollment_id));
CREATE POLICY attendance_provider_modify ON public.attendance_records
  FOR ALL USING (public.provider_of_enrollment(enrollment_id))
         WITH CHECK (public.provider_of_enrollment(enrollment_id));

-- ============================================================================
-- PAYMENTS
-- ============================================================================
CREATE POLICY payments_payer_select ON public.payments
  FOR SELECT USING (payer_user_id = public.current_user_id());
CREATE POLICY payments_provider_select ON public.payments
  FOR SELECT USING (public.is_provider_owner(provider_id));
CREATE POLICY payments_admin_select ON public.payments
  FOR SELECT USING (public.is_platform_admin());
CREATE POLICY payments_payer_insert ON public.payments
  FOR INSERT WITH CHECK (payer_user_id = public.current_user_id());
CREATE POLICY payments_provider_insert ON public.payments
  FOR INSERT WITH CHECK (public.is_provider_owner(provider_id));
CREATE POLICY payments_provider_update ON public.payments
  FOR UPDATE USING (public.is_provider_owner(provider_id));

-- ============================================================================
-- REVIEWS
-- ============================================================================
CREATE POLICY reviews_public_select ON public.reviews
  FOR SELECT USING (true);
CREATE POLICY reviews_self_insert ON public.reviews
  FOR INSERT WITH CHECK (reviewer_user_id = public.current_user_id());
CREATE POLICY reviews_self_update ON public.reviews
  FOR UPDATE USING (reviewer_user_id = public.current_user_id());
CREATE POLICY reviews_provider_reply ON public.reviews
  FOR UPDATE USING (public.is_class_owner(class_id));
CREATE POLICY reviews_self_delete ON public.reviews
  FOR DELETE USING (reviewer_user_id = public.current_user_id());

-- ============================================================================
-- ANNOUNCEMENTS
-- ============================================================================
CREATE POLICY announcements_provider_modify ON public.announcements
  FOR ALL USING (public.is_provider_owner(provider_id))
         WITH CHECK (public.is_provider_owner(provider_id));
-- Enrolled families read announcements for their batches/classes
CREATE POLICY announcements_enrolled_select ON public.announcements
  FOR SELECT USING (
    -- general provider announcements (no class/batch) visible to anyone enrolled with that provider
    EXISTS (
      SELECT 1 FROM public.enrollments e
      JOIN public.batches b ON b.id = e.batch_id
      JOIN public.classes c ON c.id = b.class_id
      WHERE c.provider_id = announcements.provider_id
        AND public.owns_family_member(e.family_member_id)
        AND (announcements.batch_id IS NULL OR announcements.batch_id = e.batch_id)
        AND (announcements.class_id IS NULL OR announcements.class_id = c.id)
    )
  );

-- ============================================================================
-- CHAT
-- ============================================================================
CREATE POLICY chat_conv_participant_select ON public.chat_conversations
  FOR SELECT USING (public.current_user_id() = ANY (participant_ids));
CREATE POLICY chat_conv_participant_insert ON public.chat_conversations
  FOR INSERT WITH CHECK (public.current_user_id() = ANY (participant_ids));
CREATE POLICY chat_conv_participant_update ON public.chat_conversations
  FOR UPDATE USING (public.current_user_id() = ANY (participant_ids));

CREATE POLICY chat_msg_participant_select ON public.chat_messages
  FOR SELECT USING (public.is_chat_participant(conversation_id));
CREATE POLICY chat_msg_self_insert ON public.chat_messages
  FOR INSERT WITH CHECK (
    sender_id = public.current_user_id()
    AND public.is_chat_participant(conversation_id)
  );
CREATE POLICY chat_msg_self_update ON public.chat_messages
  FOR UPDATE USING (
    public.is_chat_participant(conversation_id)
  );

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================
CREATE POLICY notif_self_select ON public.notifications
  FOR SELECT USING (user_id = public.current_user_id());
CREATE POLICY notif_self_update ON public.notifications
  FOR UPDATE USING (user_id = public.current_user_id());
CREATE POLICY notif_self_delete ON public.notifications
  FOR DELETE USING (user_id = public.current_user_id());
-- INSERT goes through send_notification RPC (SECURITY DEFINER) — no user-facing INSERT policy

-- ============================================================================
-- CLASS MATERIALS
-- ============================================================================
CREATE POLICY materials_owner_modify ON public.class_materials
  FOR ALL USING (public.is_class_owner(class_id))
         WITH CHECK (public.is_class_owner(class_id));
CREATE POLICY materials_enrolled_select ON public.class_materials
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.enrollments e
      JOIN public.batches b ON b.id = e.batch_id
      WHERE b.class_id = class_materials.class_id
        AND (class_materials.batch_id IS NULL OR class_materials.batch_id = e.batch_id)
        AND public.owns_family_member(e.family_member_id)
        AND e.status IN ('active','paused','completed')
    )
  );

-- ============================================================================
-- SPONSORED LISTINGS
-- ============================================================================
CREATE POLICY sponsored_public_select ON public.sponsored_listings
  FOR SELECT USING (status = 'active');
CREATE POLICY sponsored_owner_select ON public.sponsored_listings
  FOR SELECT USING (public.is_provider_owner(provider_id));
CREATE POLICY sponsored_admin_select ON public.sponsored_listings
  FOR SELECT USING (public.is_platform_admin());
CREATE POLICY sponsored_owner_insert ON public.sponsored_listings
  FOR INSERT WITH CHECK (public.is_provider_owner(provider_id));
CREATE POLICY sponsored_owner_cancel ON public.sponsored_listings
  FOR UPDATE USING (public.is_provider_owner(provider_id) AND status IN ('pending','active'));
CREATE POLICY sponsored_admin_update ON public.sponsored_listings
  FOR UPDATE USING (public.is_platform_admin());

-- ============================================================================
-- FEATURED BANNERS
-- ============================================================================
CREATE POLICY banners_public_select ON public.featured_banners
  FOR SELECT USING (status = 'active' AND moderation_status = 'approved');
CREATE POLICY banners_owner_select ON public.featured_banners
  FOR SELECT USING (public.is_provider_owner(provider_id));
CREATE POLICY banners_admin_select ON public.featured_banners
  FOR SELECT USING (public.is_platform_admin());
CREATE POLICY banners_owner_insert ON public.featured_banners
  FOR INSERT WITH CHECK (public.is_provider_owner(provider_id));
CREATE POLICY banners_owner_update ON public.featured_banners
  FOR UPDATE USING (public.is_provider_owner(provider_id) AND status IN ('pending','active'));
CREATE POLICY banners_admin_update ON public.featured_banners
  FOR UPDATE USING (public.is_platform_admin());

-- ============================================================================
-- MODERATION FLAGS
-- ============================================================================
CREATE POLICY mod_owner_select ON public.moderation_flags
  FOR SELECT USING (owner_user_id = public.current_user_id());
CREATE POLICY mod_admin_select ON public.moderation_flags
  FOR SELECT USING (public.is_platform_admin());
CREATE POLICY mod_admin_update ON public.moderation_flags
  FOR UPDATE USING (public.is_platform_admin());
-- INSERT happens via submit_for_moderation RPC; no user-facing INSERT policy

-- ============================================================================
-- REFERRALS
-- ============================================================================
CREATE POLICY referrals_self_select ON public.referrals
  FOR SELECT USING (referrer_id = public.current_user_id());
CREATE POLICY referrals_self_insert ON public.referrals
  FOR INSERT WITH CHECK (referrer_id = public.current_user_id());

-- ============================================================================
-- PLATFORM SETTINGS
-- ============================================================================
CREATE POLICY settings_public_select ON public.platform_settings
  FOR SELECT USING (true);
CREATE POLICY settings_admin_modify ON public.platform_settings
  FOR ALL USING (public.is_platform_admin())
         WITH CHECK (public.is_platform_admin());

COMMIT;

-- ============================================================================
-- Post-RLS checklist:
--   [ ] SELECT count(*) FROM pg_policy WHERE polrelid::regclass::text LIKE 'public.%';  -- expect 80+
--   [ ] As anonymous: SELECT * FROM public.classes;  -- works (returns nothing yet)
--   [ ] As anonymous: INSERT INTO public.users ...;  -- denied
--   [ ] Run 003_storage_buckets_v2.sql next
-- ============================================================================
