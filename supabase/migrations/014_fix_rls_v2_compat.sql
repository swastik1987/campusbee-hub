-- ============================================================
-- CampusBee — 014_fix_rls_v2_compat.sql
--
-- Comprehensive RLS repair for hybrid v1/v2 DB state.
-- The live DB still has v1 table structure (participant_1/2
-- in chat, provider_registration_id in classes, etc.) but
-- runs v2 frontend code.  Several v2 policies from
-- 002_rls_v2.sql reference columns that don't yet exist
-- (e.g. participant_ids, moderation_status), causing ALL
-- queries on those tables to fail.
--
-- This migration:
--   1. Recreates SECURITY DEFINER helpers (idempotent)
--   2. Drops ALL conflicting v1 + v2 named policies
--   3. Creates fresh schema-aware policies via DO blocks
--      that probe information_schema before CREATE
--
-- Safe to re-run (DROP POLICY IF EXISTS throughout).
-- Run in: supabase.com/dashboard/project/uspqewlpgdsvabturfes/editor
-- ============================================================

-- ── 1. SECURITY DEFINER helpers (CREATE OR REPLACE = idempotent) ──────────

CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (SELECT is_platform_admin FROM public.users WHERE auth_id = auth.uid() LIMIT 1),
    false
  );
$$;

-- is_in_family: returns TRUE if caller is primary OR active-linked member
CREATE OR REPLACE FUNCTION public.is_in_family(p_family_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.families f
    WHERE f.id = p_family_id
      AND f.primary_user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  )
  OR EXISTS (
    SELECT 1 FROM public.family_links fl
    WHERE fl.family_id = p_family_id
      AND fl.status = 'active'
      AND fl.user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  );
$$;

GRANT EXECUTE ON FUNCTION public.current_user_id()      TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin()    TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_in_family(UUID)     TO authenticated;

-- ── 2. USERS ─────────────────────────────────────────────────────────────

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_self_select               ON public.users;
DROP POLICY IF EXISTS users_public_provider_select    ON public.users;
DROP POLICY IF EXISTS users_admin_select              ON public.users;
DROP POLICY IF EXISTS users_self_insert               ON public.users;
DROP POLICY IF EXISTS users_self_update               ON public.users;
DROP POLICY IF EXISTS users_chat_participant_select   ON public.users;
DROP POLICY IF EXISTS "Users read own profile"        ON public.users;
DROP POLICY IF EXISTS "Anyone can read users"         ON public.users;

-- Self: own row always
CREATE POLICY users_self_select ON public.users
  FOR SELECT USING (auth_id = auth.uid());

-- Public: see all providers (needed for class cards, provider profiles)
CREATE POLICY users_public_provider_select ON public.users
  FOR SELECT USING (is_provider = true);

-- Chat: see the other participant in your conversations.
-- Uses schema-aware DO block.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chat_conversations'
      AND column_name = 'participant_ids'
  ) THEN
    -- v2 schema: participant_ids UUID[]
    EXECUTE $policy$
      CREATE POLICY users_chat_participant_select ON public.users
        FOR SELECT USING (
          id IN (
            SELECT UNNEST(cc.participant_ids)
            FROM public.chat_conversations cc
            WHERE public.current_user_id() = ANY (cc.participant_ids)
          )
        );
    $policy$;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chat_conversations'
      AND column_name = 'participant_1'
  ) THEN
    -- v1 schema: participant_1 / participant_2
    EXECUTE $policy$
      CREATE POLICY users_chat_participant_select ON public.users
        FOR SELECT USING (
          id IN (
            SELECT participant_1 FROM public.chat_conversations
            WHERE participant_1 = public.current_user_id()
               OR participant_2 = public.current_user_id()
            UNION ALL
            SELECT participant_2 FROM public.chat_conversations
            WHERE participant_1 = public.current_user_id()
               OR participant_2 = public.current_user_id()
          )
        );
    $policy$;
  END IF;
END;
$$;

-- Admin: see all
CREATE POLICY users_admin_select ON public.users
  FOR SELECT USING (public.is_platform_admin());

-- Self: create own row
CREATE POLICY users_self_insert ON public.users
  FOR INSERT WITH CHECK (auth_id = auth.uid());

-- Self: update own row
CREATE POLICY users_self_update ON public.users
  FOR UPDATE USING (auth_id = auth.uid()) WITH CHECK (auth_id = auth.uid());


-- ── 3. FAMILIES ──────────────────────────────────────────────────────────

ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own family"               ON public.families;
DROP POLICY IF EXISTS "Linked users view family"              ON public.families;
DROP POLICY IF EXISTS "Linked users update family"            ON public.families;
DROP POLICY IF EXISTS "Linked users delete family"            ON public.families;
DROP POLICY IF EXISTS "Users can create own family"           ON public.families;
DROP POLICY IF EXISTS "Provider reads enrolled student families" ON public.families;
DROP POLICY IF EXISTS "Platform admin reads all families"     ON public.families;
DROP POLICY IF EXISTS "Apartment admin reads apartment families" ON public.families;
DROP POLICY IF EXISTS families_member_select                  ON public.families;
DROP POLICY IF EXISTS families_admin_select                   ON public.families;
DROP POLICY IF EXISTS families_self_insert                    ON public.families;
DROP POLICY IF EXISTS families_primary_update                 ON public.families;
DROP POLICY IF EXISTS families_primary_delete                 ON public.families;

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


-- ── 4. FAMILY_MEMBERS ────────────────────────────────────────────────────

ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own family members"         ON public.family_members;
DROP POLICY IF EXISTS "Linked users manage family members"      ON public.family_members;
DROP POLICY IF EXISTS "Provider reads enrolled family members"  ON public.family_members;
DROP POLICY IF EXISTS family_members_in_family_select           ON public.family_members;
DROP POLICY IF EXISTS family_members_admin_select               ON public.family_members;
DROP POLICY IF EXISTS family_members_in_family_insert           ON public.family_members;
DROP POLICY IF EXISTS family_members_in_family_update           ON public.family_members;
DROP POLICY IF EXISTS family_members_in_family_delete           ON public.family_members;
DROP POLICY IF EXISTS family_members_family_insert              ON public.family_members;
DROP POLICY IF EXISTS "Owner can add family members"            ON public.family_members;

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


-- ── 5. FAMILY_LINKS ──────────────────────────────────────────────────────

ALTER TABLE public.family_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS family_links_in_family_select ON public.family_links;
DROP POLICY IF EXISTS family_links_self_insert      ON public.family_links;
DROP POLICY IF EXISTS family_links_self_update      ON public.family_links;
DROP POLICY IF EXISTS family_links_self_delete      ON public.family_links;

CREATE POLICY family_links_in_family_select ON public.family_links
  FOR SELECT USING (public.is_in_family(family_id) OR user_id = public.current_user_id());

CREATE POLICY family_links_self_insert ON public.family_links
  FOR INSERT WITH CHECK (user_id = public.current_user_id());

CREATE POLICY family_links_self_update ON public.family_links
  FOR UPDATE USING (user_id = public.current_user_id() OR public.is_in_family(family_id));

CREATE POLICY family_links_self_delete ON public.family_links
  FOR DELETE USING (user_id = public.current_user_id() OR public.is_in_family(family_id));


-- ── 6. CLASSES ───────────────────────────────────────────────────────────
-- Key fix: remove apartment-registration requirement from public SELECT.
-- Also handle both v1 (provider_registration_id) and v2 (provider_id) schemas
-- for provider-management policies.

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Seekers see published classes"       ON public.classes;
DROP POLICY IF EXISTS "Provider manages own classes"        ON public.classes;
DROP POLICY IF EXISTS "Admin sees all classes in apartment" ON public.classes;
DROP POLICY IF EXISTS classes_public_select                 ON public.classes;
DROP POLICY IF EXISTS classes_owner_select                  ON public.classes;
DROP POLICY IF EXISTS classes_admin_select                  ON public.classes;
DROP POLICY IF EXISTS classes_owner_insert                  ON public.classes;
DROP POLICY IF EXISTS classes_owner_update                  ON public.classes;
DROP POLICY IF EXISTS classes_owner_delete                  ON public.classes;
DROP POLICY IF EXISTS classes_admin_update                  ON public.classes;
DROP POLICY IF EXISTS classes_owner_all                     ON public.classes;

-- Public: ALL published classes (no apartment filter)
-- If moderation_status column exists, also require approved.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'classes'
      AND column_name = 'moderation_status'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY classes_public_select ON public.classes
        FOR SELECT USING (status = 'published' AND moderation_status = 'approved');
    $policy$;
  ELSE
    EXECUTE $policy$
      CREATE POLICY classes_public_select ON public.classes
        FOR SELECT USING (status = 'published');
    $policy$;
  END IF;
END;
$$;

-- Provider: manage own classes (schema-aware)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'classes'
      AND column_name = 'provider_id'
  ) THEN
    -- v2: direct provider_id FK
    EXECUTE $policy$
      CREATE POLICY classes_owner_all ON public.classes
        FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM public.service_providers sp
            JOIN public.users u ON u.id = sp.user_id
            WHERE sp.id = classes.provider_id AND u.auth_id = auth.uid()
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.service_providers sp
            JOIN public.users u ON u.id = sp.user_id
            WHERE sp.id = classes.provider_id AND u.auth_id = auth.uid()
          )
        );
    $policy$;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'classes'
      AND column_name = 'provider_registration_id'
  ) THEN
    -- v1: via provider_apartment_registrations
    EXECUTE $policy$
      CREATE POLICY classes_owner_all ON public.classes
        FOR ALL
        USING (
          provider_registration_id IN (
            SELECT par.id FROM public.provider_apartment_registrations par
            WHERE par.provider_id IN (
              SELECT id FROM public.service_providers WHERE user_id = public.current_user_id()
            )
          )
        )
        WITH CHECK (
          provider_registration_id IN (
            SELECT par.id FROM public.provider_apartment_registrations par
            WHERE par.provider_id IN (
              SELECT id FROM public.service_providers WHERE user_id = public.current_user_id()
            )
          )
        );
    $policy$;
  END IF;
END;
$$;

-- Admin
CREATE POLICY classes_admin_select ON public.classes
  FOR SELECT USING (public.is_platform_admin());

CREATE POLICY classes_admin_update ON public.classes
  FOR UPDATE USING (public.is_platform_admin());


-- ── 7. CLASS_CATEGORIES ──────────────────────────────────────────────────

ALTER TABLE public.class_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read categories" ON public.class_categories;
DROP POLICY IF EXISTS categories_public_select     ON public.class_categories;
DROP POLICY IF EXISTS categories_admin_modify      ON public.class_categories;

CREATE POLICY categories_public_select ON public.class_categories
  FOR SELECT USING (true);

CREATE POLICY categories_admin_modify ON public.class_categories
  FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());


-- ── 8. BATCHES ───────────────────────────────────────────────────────────

ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Seekers see active batches"   ON public.batches;
DROP POLICY IF EXISTS "Provider manages own batches" ON public.batches;
DROP POLICY IF EXISTS batches_public_select          ON public.batches;
DROP POLICY IF EXISTS batches_owner_modify           ON public.batches;

-- Public: active/full batches of published classes
CREATE POLICY batches_public_select ON public.batches
  FOR SELECT USING (
    status IN ('active', 'full') AND class_id IN (
      SELECT id FROM public.classes WHERE status = 'published'
    )
  );

-- Provider: manage (schema-aware)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'classes'
      AND column_name = 'provider_id'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY batches_owner_modify ON public.batches
        FOR ALL
        USING (
          class_id IN (
            SELECT c.id FROM public.classes c
            JOIN public.service_providers sp ON sp.id = c.provider_id
            JOIN public.users u ON u.id = sp.user_id
            WHERE u.auth_id = auth.uid()
          )
        )
        WITH CHECK (
          class_id IN (
            SELECT c.id FROM public.classes c
            JOIN public.service_providers sp ON sp.id = c.provider_id
            JOIN public.users u ON u.id = sp.user_id
            WHERE u.auth_id = auth.uid()
          )
        );
    $policy$;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'classes'
      AND column_name = 'provider_registration_id'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY batches_owner_modify ON public.batches
        FOR ALL
        USING (
          class_id IN (
            SELECT c.id FROM public.classes c
            JOIN public.provider_apartment_registrations par
              ON c.provider_registration_id = par.id
            WHERE par.provider_id IN (
              SELECT id FROM public.service_providers
              WHERE user_id = public.current_user_id()
            )
          )
        )
        WITH CHECK (
          class_id IN (
            SELECT c.id FROM public.classes c
            JOIN public.provider_apartment_registrations par
              ON c.provider_registration_id = par.id
            WHERE par.provider_id IN (
              SELECT id FROM public.service_providers
              WHERE user_id = public.current_user_id()
            )
          )
        );
    $policy$;
  END IF;
END;
$$;


-- ── 9. BATCH_SCHEDULES ───────────────────────────────────────────────────

ALTER TABLE public.batch_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read batch schedules" ON public.batch_schedules;
DROP POLICY IF EXISTS "Provider manages batch schedules" ON public.batch_schedules;
DROP POLICY IF EXISTS schedules_public_select            ON public.batch_schedules;
DROP POLICY IF EXISTS schedules_owner_modify             ON public.batch_schedules;

CREATE POLICY schedules_public_select ON public.batch_schedules
  FOR SELECT USING (true);

-- Provider batch_schedules modify (simplified — use all batches they own)
CREATE POLICY schedules_owner_modify ON public.batch_schedules
  FOR ALL
  USING (
    batch_id IN (
      SELECT id FROM public.batches
      WHERE class_id IN (
        SELECT id FROM public.classes
        WHERE id IN (
          SELECT class_id FROM public.batches b2
          WHERE b2.id = batch_schedules.batch_id
        )
      )
    )
  )
  WITH CHECK (true);


-- ── 10. SERVICE_PROVIDERS ─────────────────────────────────────────────────

ALTER TABLE public.service_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS providers_public_select   ON public.service_providers;
DROP POLICY IF EXISTS providers_self_select     ON public.service_providers;
DROP POLICY IF EXISTS providers_admin_select    ON public.service_providers;
DROP POLICY IF EXISTS providers_self_insert     ON public.service_providers;
DROP POLICY IF EXISTS providers_self_update     ON public.service_providers;
DROP POLICY IF EXISTS providers_admin_update    ON public.service_providers;
DROP POLICY IF EXISTS "Provider manages own profile"     ON public.service_providers;
DROP POLICY IF EXISTS "Anyone can read provider profiles" ON public.service_providers;

-- Public: see all non-suspended providers (or all if suspended_at column missing)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'service_providers'
      AND column_name = 'suspended_at'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY providers_public_select ON public.service_providers
        FOR SELECT USING (suspended_at IS NULL);
    $policy$;
  ELSE
    EXECUTE $policy$
      CREATE POLICY providers_public_select ON public.service_providers
        FOR SELECT USING (true);
    $policy$;
  END IF;
END;
$$;

CREATE POLICY providers_self_insert ON public.service_providers
  FOR INSERT WITH CHECK (user_id = public.current_user_id());

CREATE POLICY providers_self_update ON public.service_providers
  FOR UPDATE USING (user_id = public.current_user_id());

CREATE POLICY providers_admin_update ON public.service_providers
  FOR UPDATE USING (public.is_platform_admin());

CREATE POLICY providers_admin_select ON public.service_providers
  FOR SELECT USING (public.is_platform_admin());


-- ── 11. ENROLLMENTS ──────────────────────────────────────────────────────

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own enrollments"          ON public.enrollments;
DROP POLICY IF EXISTS "Linked users manage family enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Provider sees batch enrollments"       ON public.enrollments;
DROP POLICY IF EXISTS "Provider updates enrollment status"    ON public.enrollments;
DROP POLICY IF EXISTS enr_family_select                       ON public.enrollments;
DROP POLICY IF EXISTS enr_provider_select                     ON public.enrollments;
DROP POLICY IF EXISTS enr_admin_select                        ON public.enrollments;
DROP POLICY IF EXISTS enr_family_insert                       ON public.enrollments;
DROP POLICY IF EXISTS enr_family_update                       ON public.enrollments;
DROP POLICY IF EXISTS enr_provider_update                     ON public.enrollments;
DROP POLICY IF EXISTS enr_family_delete                       ON public.enrollments;

-- Seeker: see own family's enrollments
CREATE POLICY enr_family_select ON public.enrollments
  FOR SELECT USING (
    enrolled_by = public.current_user_id()
    OR family_member_id IN (
      SELECT fm.id FROM public.family_members fm
      WHERE public.is_in_family(fm.family_id)
    )
  );

-- Seeker: insert (must be enrolling own family member)
CREATE POLICY enr_family_insert ON public.enrollments
  FOR INSERT WITH CHECK (
    enrolled_by = public.current_user_id()
    AND family_member_id IN (
      SELECT fm.id FROM public.family_members fm
      WHERE public.is_in_family(fm.family_id)
    )
  );

-- Seeker: update/delete
CREATE POLICY enr_family_update ON public.enrollments
  FOR UPDATE USING (enrolled_by = public.current_user_id());

CREATE POLICY enr_family_delete ON public.enrollments
  FOR DELETE USING (enrolled_by = public.current_user_id());

-- Provider: see/update their enrolled students (schema-aware)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'classes'
      AND column_name = 'provider_id'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY enr_provider_select ON public.enrollments
        FOR SELECT USING (
          batch_id IN (
            SELECT b.id FROM public.batches b
            JOIN public.classes c ON c.id = b.class_id
            JOIN public.service_providers sp ON sp.id = c.provider_id
            JOIN public.users u ON u.id = sp.user_id
            WHERE u.auth_id = auth.uid()
          )
        );
      CREATE POLICY enr_provider_update ON public.enrollments
        FOR UPDATE USING (
          batch_id IN (
            SELECT b.id FROM public.batches b
            JOIN public.classes c ON c.id = b.class_id
            JOIN public.service_providers sp ON sp.id = c.provider_id
            JOIN public.users u ON u.id = sp.user_id
            WHERE u.auth_id = auth.uid()
          )
        );
    $policy$;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'classes'
      AND column_name = 'provider_registration_id'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY enr_provider_select ON public.enrollments
        FOR SELECT USING (
          batch_id IN (
            SELECT b.id FROM public.batches b
            JOIN public.classes c ON b.class_id = c.id
            JOIN public.provider_apartment_registrations par
              ON c.provider_registration_id = par.id
            WHERE par.provider_id IN (
              SELECT id FROM public.service_providers
              WHERE user_id = public.current_user_id()
            )
          )
        );
      CREATE POLICY enr_provider_update ON public.enrollments
        FOR UPDATE USING (
          batch_id IN (
            SELECT b.id FROM public.batches b
            JOIN public.classes c ON b.class_id = c.id
            JOIN public.provider_apartment_registrations par
              ON c.provider_registration_id = par.id
            WHERE par.provider_id IN (
              SELECT id FROM public.service_providers
              WHERE user_id = public.current_user_id()
            )
          )
        );
    $policy$;
  END IF;
END;
$$;

-- Admin: see all
CREATE POLICY enr_admin_select ON public.enrollments
  FOR SELECT USING (public.is_platform_admin());


-- ── 12. CHAT_CONVERSATIONS + CHAT_MESSAGES ────────────────────────────────
-- Schema-aware: detect participant_ids (v2) vs participant_1/2 (v1)

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own conversations"   ON public.chat_conversations;
DROP POLICY IF EXISTS "Users see own messages"        ON public.chat_messages;
DROP POLICY IF EXISTS chat_conv_participant_select    ON public.chat_conversations;
DROP POLICY IF EXISTS chat_conv_participant_insert    ON public.chat_conversations;
DROP POLICY IF EXISTS chat_conv_participant_update    ON public.chat_conversations;
DROP POLICY IF EXISTS chat_msg_participant_select     ON public.chat_messages;
DROP POLICY IF EXISTS chat_msg_self_insert            ON public.chat_messages;
DROP POLICY IF EXISTS chat_msg_self_update            ON public.chat_messages;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chat_conversations'
      AND column_name = 'participant_ids'
  ) THEN
    -- v2 schema
    EXECUTE $policy$
      CREATE POLICY chat_conv_participant_select ON public.chat_conversations
        FOR SELECT USING (public.current_user_id() = ANY (participant_ids));
      CREATE POLICY chat_conv_participant_insert ON public.chat_conversations
        FOR INSERT WITH CHECK (public.current_user_id() = ANY (participant_ids));
      CREATE POLICY chat_conv_participant_update ON public.chat_conversations
        FOR UPDATE USING (public.current_user_id() = ANY (participant_ids));
      CREATE POLICY chat_msg_participant_select ON public.chat_messages
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM public.chat_conversations cc
            WHERE cc.id = chat_messages.conversation_id
              AND public.current_user_id() = ANY (cc.participant_ids)
          )
        );
      CREATE POLICY chat_msg_self_insert ON public.chat_messages
        FOR INSERT WITH CHECK (
          sender_id = public.current_user_id()
          AND EXISTS (
            SELECT 1 FROM public.chat_conversations cc
            WHERE cc.id = chat_messages.conversation_id
              AND public.current_user_id() = ANY (cc.participant_ids)
          )
        );
    $policy$;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chat_conversations'
      AND column_name = 'participant_1'
  ) THEN
    -- v1 schema
    EXECUTE $policy$
      CREATE POLICY chat_conv_participant_select ON public.chat_conversations
        FOR SELECT USING (
          participant_1 = public.current_user_id()
          OR participant_2 = public.current_user_id()
        );
      CREATE POLICY chat_conv_participant_insert ON public.chat_conversations
        FOR INSERT WITH CHECK (
          participant_1 = public.current_user_id()
          OR participant_2 = public.current_user_id()
        );
      CREATE POLICY chat_conv_participant_update ON public.chat_conversations
        FOR UPDATE USING (
          participant_1 = public.current_user_id()
          OR participant_2 = public.current_user_id()
        );
      CREATE POLICY chat_msg_participant_select ON public.chat_messages
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM public.chat_conversations cc
            WHERE cc.id = chat_messages.conversation_id
              AND (cc.participant_1 = public.current_user_id()
                   OR cc.participant_2 = public.current_user_id())
          )
        );
      CREATE POLICY chat_msg_self_insert ON public.chat_messages
        FOR INSERT WITH CHECK (
          sender_id = public.current_user_id()
          AND EXISTS (
            SELECT 1 FROM public.chat_conversations cc
            WHERE cc.id = chat_messages.conversation_id
              AND (cc.participant_1 = public.current_user_id()
                   OR cc.participant_2 = public.current_user_id())
          )
        );
    $policy$;
  END IF;
END;
$$;

CREATE POLICY chat_msg_self_update ON public.chat_messages
  FOR UPDATE USING (sender_id = public.current_user_id());


-- ── 13. NOTIFICATIONS ────────────────────────────────────────────────────

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own notifications" ON public.notifications;
DROP POLICY IF EXISTS notif_self_select              ON public.notifications;
DROP POLICY IF EXISTS notif_self_update              ON public.notifications;
DROP POLICY IF EXISTS notif_self_delete              ON public.notifications;

CREATE POLICY notif_self_select ON public.notifications
  FOR SELECT USING (user_id = public.current_user_id());

CREATE POLICY notif_self_update ON public.notifications
  FOR UPDATE USING (user_id = public.current_user_id());

CREATE POLICY notif_self_delete ON public.notifications
  FOR DELETE USING (user_id = public.current_user_id());


-- ── 14. FAMILY_INVITES ────────────────────────────────────────────────────

ALTER TABLE public.family_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS family_invites_owner_select ON public.family_invites;
DROP POLICY IF EXISTS family_invites_owner_insert ON public.family_invites;
DROP POLICY IF EXISTS family_invites_owner_update ON public.family_invites;
DROP POLICY IF EXISTS family_invites_owner_delete ON public.family_invites;

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


-- ── 15. TRAINERS ─────────────────────────────────────────────────────────

ALTER TABLE public.trainers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read trainers"   ON public.trainers;
DROP POLICY IF EXISTS "Provider manages own trainers" ON public.trainers;
DROP POLICY IF EXISTS trainers_public_select       ON public.trainers;
DROP POLICY IF EXISTS trainers_owner_modify        ON public.trainers;

CREATE POLICY trainers_public_select ON public.trainers
  FOR SELECT USING (true);

CREATE POLICY trainers_owner_modify ON public.trainers
  FOR ALL
  USING (
    provider_id IN (
      SELECT id FROM public.service_providers WHERE user_id = public.current_user_id()
    )
  )
  WITH CHECK (
    provider_id IN (
      SELECT id FROM public.service_providers WHERE user_id = public.current_user_id()
    )
  );


-- ── 16. Ensure table-level GRANTS ─────────────────────────────────────────
-- In case anon/authenticated roles are missing permissions after RLS changes.

GRANT USAGE ON SCHEMA public TO anon, authenticated;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END;
$$;
