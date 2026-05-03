-- ============================================================
-- FIX: Infinite recursion in family_members / families / enrollments
--
-- Root cause: "Provider reads enrolled student families" on families
-- queries family_members, which triggers family_members RLS, which
-- queries enrollments, which triggers enrollments RLS, which queries
-- family_members again → infinite loop.
--
-- Solution: Use SECURITY DEFINER helper functions that bypass RLS
-- for the provider-side lookups, breaking the recursion chain.
-- ============================================================

-- ── Helper: get family_member IDs enrolled in the current provider's batches ──
CREATE OR REPLACE FUNCTION get_provider_enrolled_member_ids()
RETURNS SETOF UUID AS $$
  SELECT DISTINCT e.family_member_id
  FROM enrollments e
  JOIN batches b ON e.batch_id = b.id
  JOIN classes c ON b.class_id = c.id
  JOIN provider_apartment_registrations par ON c.provider_registration_id = par.id
  WHERE par.provider_id IN (
    SELECT id FROM service_providers WHERE user_id = get_user_id()
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Helper: get family IDs of enrolled students for the current provider ──
CREATE OR REPLACE FUNCTION get_provider_enrolled_family_ids()
RETURNS SETOF UUID AS $$
  SELECT DISTINCT fm.family_id
  FROM family_members fm
  WHERE fm.id IN (
    SELECT e.family_member_id
    FROM enrollments e
    JOIN batches b ON e.batch_id = b.id
    JOIN classes c ON b.class_id = c.id
    JOIN provider_apartment_registrations par ON c.provider_registration_id = par.id
    WHERE par.provider_id IN (
      SELECT id FROM service_providers WHERE user_id = get_user_id()
    )
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ══════════════════════════════════════════════════════════════
-- FAMILIES — drop and recreate provider policy using helper
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Provider reads enrolled student families" ON families;

CREATE POLICY "Provider reads enrolled student families" ON families
  FOR SELECT USING (
    id IN (SELECT get_provider_enrolled_family_ids())
  );

-- ══════════════════════════════════════════════════════════════
-- FAMILY MEMBERS — drop and recreate provider policy using helper
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Provider reads enrolled family members" ON family_members;

CREATE POLICY "Provider reads enrolled family members" ON family_members
  FOR SELECT USING (
    id IN (SELECT get_provider_enrolled_member_ids())
  );
