-- ============================================================
-- FIX: Missing RLS policies for search and admin operations
--
-- The users table only had self-access policies (auth.uid() = auth_id).
-- Several other tables lacked platform admin access policies.
-- This blocked admin search, stats, category management, etc.
-- ============================================================

-- ========================
-- USERS TABLE POLICIES
-- ========================

-- Platform admins can read all user profiles (admin assignment, stats, analytics)
CREATE POLICY "Platform admin reads all users"
  ON public.users
  FOR SELECT
  USING (
    (SELECT COALESCE(is_platform_admin, false) FROM public.users WHERE auth_id = auth.uid())
  );

-- Platform admin can update any user (assigning admin roles)
CREATE POLICY "Platform admin updates users"
  ON public.users
  FOR UPDATE
  USING (
    (SELECT COALESCE(is_platform_admin, false) FROM public.users WHERE auth_id = auth.uid())
  );

-- Apartment admins can read users in their apartment (provider management, reports)
CREATE POLICY "Apartment admin reads apartment users"
  ON public.users
  FOR SELECT
  USING (
    id IN (
      SELECT f.primary_user_id FROM public.families f
      WHERE f.apartment_id IN (
        SELECT aa.apartment_id FROM public.apartment_admins aa
        WHERE aa.user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
        AND aa.is_active = true
      )
    )
  );

-- Users can read basic info of co-residents (family linking search, chat names)
CREATE POLICY "Users read apartment co-residents"
  ON public.users
  FOR SELECT
  USING (
    id IN (
      SELECT f2.primary_user_id FROM public.families f2
      WHERE f2.apartment_id IN (
        SELECT f1.apartment_id FROM public.families f1
        WHERE f1.primary_user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
      )
    )
  );

-- Anyone can read provider user profiles (class listings, provider pages, chat)
CREATE POLICY "Anyone reads provider user profiles"
  ON public.users
  FOR SELECT
  USING (is_provider = true);


-- ========================
-- CLASS_CATEGORIES POLICIES (platform admin management)
-- ========================

-- Platform admin can insert new categories
CREATE POLICY "Platform admin inserts categories"
  ON public.class_categories
  FOR INSERT
  WITH CHECK (
    (SELECT COALESCE(is_platform_admin, false) FROM public.users WHERE auth_id = auth.uid())
  );

-- Platform admin can update categories
CREATE POLICY "Platform admin updates categories"
  ON public.class_categories
  FOR UPDATE
  USING (
    (SELECT COALESCE(is_platform_admin, false) FROM public.users WHERE auth_id = auth.uid())
  );

-- Platform admin can delete categories
CREATE POLICY "Platform admin deletes categories"
  ON public.class_categories
  FOR DELETE
  USING (
    (SELECT COALESCE(is_platform_admin, false) FROM public.users WHERE auth_id = auth.uid())
  );


-- ========================
-- ENROLLMENTS — platform admin read access for stats
-- ========================

CREATE POLICY "Platform admin reads all enrollments"
  ON public.enrollments
  FOR SELECT
  USING (
    (SELECT COALESCE(is_platform_admin, false) FROM public.users WHERE auth_id = auth.uid())
  );


-- ========================
-- SERVICE_PROVIDERS — platform admin read access for stats
-- ========================

CREATE POLICY "Platform admin reads all providers"
  ON public.service_providers
  FOR SELECT
  USING (
    (SELECT COALESCE(is_platform_admin, false) FROM public.users WHERE auth_id = auth.uid())
  );


-- ========================
-- FAMILIES — platform admin + apartment admin read access
-- ========================

CREATE POLICY "Platform admin reads all families"
  ON public.families
  FOR SELECT
  USING (
    (SELECT COALESCE(is_platform_admin, false) FROM public.users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Apartment admin reads apartment families"
  ON public.families
  FOR SELECT
  USING (
    apartment_id IN (
      SELECT aa.apartment_id FROM public.apartment_admins aa
      WHERE aa.user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
      AND aa.is_active = true
    )
  );


-- ========================
-- PROVIDER_APARTMENT_REGISTRATIONS — platform admin read
-- ========================

CREATE POLICY "Platform admin reads all registrations"
  ON public.provider_apartment_registrations
  FOR SELECT
  USING (
    (SELECT COALESCE(is_platform_admin, false) FROM public.users WHERE auth_id = auth.uid())
  );
