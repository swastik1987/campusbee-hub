-- ============================================================
-- FIX: Allow apartment admins to read family_members, enrollments,
-- and batches for families in their apartment.
--
-- Without these policies, the admin dashboard shows 0 enrollments,
-- the residents page shows 0 family members, enrollment details
-- are empty, and the provider filter dropdown is empty.
--
-- Uses SECURITY DEFINER helpers to avoid RLS recursion.
-- ============================================================

-- ── Helper: get family member IDs in admin's apartment ──
CREATE OR REPLACE FUNCTION get_admin_apartment_family_member_ids()
RETURNS SETOF UUID AS $$
  SELECT fm.id
  FROM family_members fm
  JOIN families f ON fm.family_id = f.id
  WHERE f.apartment_id IN (
    SELECT aa.apartment_id FROM apartment_admins aa
    WHERE aa.user_id = get_user_id() AND aa.is_active = true
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Helper: get batch IDs for classes in admin's apartment ──
CREATE OR REPLACE FUNCTION get_admin_apartment_batch_ids()
RETURNS SETOF UUID AS $$
  SELECT b.id
  FROM batches b
  JOIN classes c ON b.class_id = c.id
  JOIN provider_apartment_registrations par ON c.provider_registration_id = par.id
  WHERE par.apartment_id IN (
    SELECT aa.apartment_id FROM apartment_admins aa
    WHERE aa.user_id = get_user_id() AND aa.is_active = true
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ══════════════════════════════════════════════════════════════
-- FAMILY MEMBERS — admin can read members of apartment families
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Admin reads apartment family members" ON family_members;

CREATE POLICY "Admin reads apartment family members" ON family_members
  FOR SELECT USING (
    id IN (SELECT get_admin_apartment_family_member_ids())
  );

-- ══════════════════════════════════════════════════════════════
-- ENROLLMENTS — admin can read enrollments in their apartment
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Admin reads apartment enrollments" ON enrollments;

CREATE POLICY "Admin reads apartment enrollments" ON enrollments
  FOR SELECT USING (
    batch_id IN (SELECT get_admin_apartment_batch_ids())
  );

-- ══════════════════════════════════════════════════════════════
-- BATCHES — admin can read batches for classes in their apartment
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Admin reads apartment batches" ON batches;

CREATE POLICY "Admin reads apartment batches" ON batches
  FOR SELECT USING (
    id IN (SELECT get_admin_apartment_batch_ids())
  );
