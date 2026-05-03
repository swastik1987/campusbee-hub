-- ============================================================
-- Allow providers to read family_members and families
-- for students enrolled in their batches
-- ============================================================

-- Provider can read family_members who are enrolled in their batches
CREATE POLICY "Provider reads enrolled family members" ON family_members FOR SELECT
  USING (
    id IN (
      SELECT e.family_member_id FROM enrollments e
      JOIN batches b ON e.batch_id = b.id
      JOIN classes c ON b.class_id = c.id
      JOIN provider_apartment_registrations par ON c.provider_registration_id = par.id
      WHERE par.provider_id IN (SELECT id FROM service_providers WHERE user_id = get_user_id())
    )
  );

-- Provider can read families of enrolled students (for flat_number, block_tower)
CREATE POLICY "Provider reads enrolled student families" ON families FOR SELECT
  USING (
    id IN (
      SELECT fm.family_id FROM family_members fm
      JOIN enrollments e ON e.family_member_id = fm.id
      JOIN batches b ON e.batch_id = b.id
      JOIN classes c ON b.class_id = c.id
      JOIN provider_apartment_registrations par ON c.provider_registration_id = par.id
      WHERE par.provider_id IN (SELECT id FROM service_providers WHERE user_id = get_user_id())
    )
  );
