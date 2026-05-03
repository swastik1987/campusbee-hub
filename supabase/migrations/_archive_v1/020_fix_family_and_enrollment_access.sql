-- ============================================================
-- REPAIR: Restore all family, enrollment, and class RLS policies
-- Safe to run: DROP IF EXISTS + CREATE ensures correct state
-- Uses family_links-based policies (as per migration 010+018)
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- FAMILIES — per-operation policies via family_links
-- ══════════════════════════════════════════════════════════════

-- Remove any stale/incorrect policies
DROP POLICY IF EXISTS "Users manage own family" ON families;
DROP POLICY IF EXISTS "Linked users manage family" ON families;
DROP POLICY IF EXISTS "Linked users view family" ON families;
DROP POLICY IF EXISTS "Linked users update family" ON families;
DROP POLICY IF EXISTS "Linked users delete family" ON families;
DROP POLICY IF EXISTS "Users can create own family" ON families;
DROP POLICY IF EXISTS "Provider reads enrolled student families" ON families;
DROP POLICY IF EXISTS "Platform admin reads all families" ON families;
DROP POLICY IF EXISTS "Apartment admin reads apartment families" ON families;

-- SELECT: linked users can view their family
CREATE POLICY "Linked users view family" ON families
  FOR SELECT USING (
    id IN (SELECT family_id FROM family_links WHERE user_id = get_user_id() AND status = 'active')
  );

-- UPDATE: linked users can update their family
CREATE POLICY "Linked users update family" ON families
  FOR UPDATE USING (
    id IN (SELECT family_id FROM family_links WHERE user_id = get_user_id() AND status = 'active')
  );

-- DELETE: linked users can delete their family
CREATE POLICY "Linked users delete family" ON families
  FOR DELETE USING (
    id IN (SELECT family_id FROM family_links WHERE user_id = get_user_id() AND status = 'active')
  );

-- INSERT: user can create a family where they are the primary user
CREATE POLICY "Users can create own family" ON families
  FOR INSERT WITH CHECK (primary_user_id = get_user_id());

-- Provider can read families of enrolled students (for flat_number, block_tower)
CREATE POLICY "Provider reads enrolled student families" ON families
  FOR SELECT USING (
    id IN (
      SELECT fm.family_id FROM family_members fm
      JOIN enrollments e ON e.family_member_id = fm.id
      JOIN batches b ON e.batch_id = b.id
      JOIN classes c ON b.class_id = c.id
      JOIN provider_apartment_registrations par ON c.provider_registration_id = par.id
      WHERE par.provider_id IN (SELECT id FROM service_providers WHERE user_id = get_user_id())
    )
  );

-- Platform admin reads all families
CREATE POLICY "Platform admin reads all families" ON families
  FOR SELECT USING (is_platform_admin());

-- Apartment admin reads apartment families
CREATE POLICY "Apartment admin reads apartment families" ON families
  FOR SELECT USING (
    apartment_id IN (
      SELECT aa.apartment_id FROM apartment_admins aa
      WHERE aa.user_id = get_user_id() AND aa.is_active = true
    )
  );

-- ══════════════════════════════════════════════════════════════
-- FAMILY MEMBERS — via family_links
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Users manage own family members" ON family_members;
DROP POLICY IF EXISTS "Linked users manage family members" ON family_members;
DROP POLICY IF EXISTS "Provider reads enrolled family members" ON family_members;

-- Linked users can manage (SELECT/INSERT/UPDATE/DELETE) family members
CREATE POLICY "Linked users manage family members" ON family_members
  FOR ALL USING (
    family_id IN (SELECT family_id FROM family_links WHERE user_id = get_user_id() AND status = 'active')
  );

-- Provider can read family members enrolled in their batches
CREATE POLICY "Provider reads enrolled family members" ON family_members
  FOR SELECT USING (
    id IN (
      SELECT e.family_member_id FROM enrollments e
      JOIN batches b ON e.batch_id = b.id
      JOIN classes c ON b.class_id = c.id
      JOIN provider_apartment_registrations par ON c.provider_registration_id = par.id
      WHERE par.provider_id IN (SELECT id FROM service_providers WHERE user_id = get_user_id())
    )
  );

-- ══════════════════════════════════════════════════════════════
-- ENROLLMENTS — via family_links
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Users manage own enrollments" ON enrollments;
DROP POLICY IF EXISTS "Linked users manage family enrollments" ON enrollments;
DROP POLICY IF EXISTS "Provider sees batch enrollments" ON enrollments;
DROP POLICY IF EXISTS "Provider updates enrollment status" ON enrollments;

-- Linked users can manage enrollments for their family members
CREATE POLICY "Linked users manage family enrollments" ON enrollments
  FOR ALL USING (
    enrolled_by = get_user_id()
    OR family_member_id IN (
      SELECT fm.id FROM family_members fm
      JOIN family_links fl ON fm.family_id = fl.family_id
      WHERE fl.user_id = get_user_id() AND fl.status = 'active'
    )
  );

-- Provider sees enrollments in their batches
CREATE POLICY "Provider sees batch enrollments" ON enrollments
  FOR SELECT USING (
    batch_id IN (
      SELECT b.id FROM batches b
      JOIN classes c ON b.class_id = c.id
      JOIN provider_apartment_registrations par ON c.provider_registration_id = par.id
      WHERE par.provider_id IN (SELECT id FROM service_providers WHERE user_id = get_user_id())
    )
  );

-- Provider can update enrollment status (approve/reject)
CREATE POLICY "Provider updates enrollment status" ON enrollments
  FOR UPDATE USING (
    batch_id IN (
      SELECT b.id FROM batches b
      JOIN classes c ON b.class_id = c.id
      JOIN provider_apartment_registrations par ON c.provider_registration_id = par.id
      WHERE par.provider_id IN (SELECT id FROM service_providers WHERE user_id = get_user_id())
    )
  );

-- ══════════════════════════════════════════════════════════════
-- PAYMENTS — via family_links
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Payer manages own payments" ON payments;
DROP POLICY IF EXISTS "Linked users see family payments" ON payments;
DROP POLICY IF EXISTS "Linked users can record payments" ON payments;
DROP POLICY IF EXISTS "Provider sees own payments" ON payments;
DROP POLICY IF EXISTS "Provider confirms payments" ON payments;

-- Linked users can see family payments
CREATE POLICY "Linked users see family payments" ON payments
  FOR SELECT USING (
    payer_user_id = get_user_id()
    OR enrollment_id IN (
      SELECT e.id FROM enrollments e
      JOIN family_members fm ON e.family_member_id = fm.id
      JOIN family_links fl ON fm.family_id = fl.family_id
      WHERE fl.user_id = get_user_id() AND fl.status = 'active'
    )
  );

-- Linked users can record payments
CREATE POLICY "Linked users can record payments" ON payments
  FOR INSERT WITH CHECK (payer_user_id = get_user_id());

-- Provider sees payments for their classes
CREATE POLICY "Provider sees own payments" ON payments
  FOR SELECT USING (
    provider_id IN (SELECT id FROM service_providers WHERE user_id = get_user_id())
  );

-- Provider confirms payments
CREATE POLICY "Provider confirms payments" ON payments
  FOR UPDATE USING (
    provider_id IN (SELECT id FROM service_providers WHERE user_id = get_user_id())
  );

-- ══════════════════════════════════════════════════════════════
-- CLASSES & BATCHES (ensure these are intact)
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Seekers see published classes" ON classes;
CREATE POLICY "Seekers see published classes" ON classes
  FOR SELECT USING (
    status = 'published' AND provider_registration_id IN (
      SELECT id FROM provider_apartment_registrations WHERE status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Provider manages own classes" ON classes;
CREATE POLICY "Provider manages own classes" ON classes
  FOR ALL USING (
    provider_registration_id IN (
      SELECT id FROM provider_apartment_registrations
      WHERE provider_id IN (SELECT id FROM service_providers WHERE user_id = get_user_id())
    )
  );

DROP POLICY IF EXISTS "Admin sees all classes in apartment" ON classes;
CREATE POLICY "Admin sees all classes in apartment" ON classes
  FOR SELECT USING (
    provider_registration_id IN (
      SELECT id FROM provider_apartment_registrations
      WHERE apartment_id IN (SELECT apartment_id FROM apartment_admins WHERE user_id = get_user_id())
    )
  );

DROP POLICY IF EXISTS "Seekers see active batches" ON batches;
CREATE POLICY "Seekers see active batches" ON batches
  FOR SELECT USING (
    status IN ('active', 'full') AND class_id IN (
      SELECT id FROM classes WHERE status = 'published'
    )
  );

DROP POLICY IF EXISTS "Provider manages own batches" ON batches;
CREATE POLICY "Provider manages own batches" ON batches
  FOR ALL USING (
    class_id IN (
      SELECT c.id FROM classes c
      JOIN provider_apartment_registrations par ON c.provider_registration_id = par.id
      WHERE par.provider_id IN (SELECT id FROM service_providers WHERE user_id = get_user_id())
    )
  );
