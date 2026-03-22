-- ============================================================
-- RLS POLICIES
-- Helper: get current user's internal ID from auth.uid()
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_id()
RETURNS UUID AS $$
  SELECT id FROM users WHERE auth_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_platform_admin FROM users WHERE auth_id = auth.uid()),
    false
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- CATEGORIES: everyone can read
CREATE POLICY "Anyone can read categories" ON class_categories FOR SELECT USING (true);

-- FAMILIES: owner only
CREATE POLICY "Users manage own family" ON families FOR ALL USING (primary_user_id = get_user_id());

-- FAMILY MEMBERS: family owner only
CREATE POLICY "Users manage own family members" ON family_members FOR ALL
  USING (family_id IN (SELECT id FROM families WHERE primary_user_id = get_user_id()));

-- SERVICE PROVIDERS: owner can manage, everyone can read approved
CREATE POLICY "Provider manages own profile" ON service_providers FOR ALL USING (user_id = get_user_id());
CREATE POLICY "Anyone can read provider profiles" ON service_providers FOR SELECT USING (true);

-- TRAINERS: provider owner can manage, everyone can read
CREATE POLICY "Provider manages own trainers" ON trainers FOR ALL
  USING (provider_id IN (SELECT id FROM service_providers WHERE user_id = get_user_id()));
CREATE POLICY "Anyone can read trainers" ON trainers FOR SELECT USING (true);

-- PROVIDER APARTMENT REGISTRATIONS
CREATE POLICY "Provider manages own registrations" ON provider_apartment_registrations FOR ALL
  USING (provider_id IN (SELECT id FROM service_providers WHERE user_id = get_user_id()));
CREATE POLICY "Admin manages apartment registrations" ON provider_apartment_registrations FOR ALL
  USING (apartment_id IN (SELECT apartment_id FROM apartment_admins WHERE user_id = get_user_id()));
CREATE POLICY "Seekers see approved registrations" ON provider_apartment_registrations FOR SELECT
  USING (status = 'approved');

-- CLASSES: provider manages own, seekers see published in their apartment
CREATE POLICY "Provider manages own classes" ON classes FOR ALL
  USING (provider_registration_id IN (
    SELECT id FROM provider_apartment_registrations
    WHERE provider_id IN (SELECT id FROM service_providers WHERE user_id = get_user_id())
  ));
CREATE POLICY "Seekers see published classes" ON classes FOR SELECT
  USING (status = 'published' AND provider_registration_id IN (
    SELECT id FROM provider_apartment_registrations WHERE status = 'approved'
  ));
CREATE POLICY "Admin sees all classes in apartment" ON classes FOR SELECT
  USING (provider_registration_id IN (
    SELECT id FROM provider_apartment_registrations
    WHERE apartment_id IN (SELECT apartment_id FROM apartment_admins WHERE user_id = get_user_id())
  ));

-- BATCHES: follow class access + provider manages own
CREATE POLICY "Provider manages own batches" ON batches FOR ALL
  USING (class_id IN (
    SELECT c.id FROM classes c
    JOIN provider_apartment_registrations par ON c.provider_registration_id = par.id
    WHERE par.provider_id IN (SELECT id FROM service_providers WHERE user_id = get_user_id())
  ));
CREATE POLICY "Seekers see active batches" ON batches FOR SELECT
  USING (status IN ('active', 'full') AND class_id IN (
    SELECT id FROM classes WHERE status = 'published'
  ));

-- BATCH SCHEDULES: follow batch access
CREATE POLICY "Anyone can read batch schedules" ON batch_schedules FOR SELECT USING (true);
CREATE POLICY "Provider manages batch schedules" ON batch_schedules FOR ALL
  USING (batch_id IN (
    SELECT b.id FROM batches b
    JOIN classes c ON b.class_id = c.id
    JOIN provider_apartment_registrations par ON c.provider_registration_id = par.id
    WHERE par.provider_id IN (SELECT id FROM service_providers WHERE user_id = get_user_id())
  ));

-- CLASS ADDONS: follow class access
CREATE POLICY "Anyone can read class addons" ON class_addons FOR SELECT USING (true);
CREATE POLICY "Provider manages class addons" ON class_addons FOR ALL
  USING (class_id IN (
    SELECT c.id FROM classes c
    JOIN provider_apartment_registrations par ON c.provider_registration_id = par.id
    WHERE par.provider_id IN (SELECT id FROM service_providers WHERE user_id = get_user_id())
  ));

-- DEMO SESSIONS: public read for published classes, provider manages
CREATE POLICY "Anyone can read demo sessions" ON demo_sessions FOR SELECT USING (true);
CREATE POLICY "Provider manages demo sessions" ON demo_sessions FOR ALL
  USING (class_id IN (
    SELECT c.id FROM classes c
    JOIN provider_apartment_registrations par ON c.provider_registration_id = par.id
    WHERE par.provider_id IN (SELECT id FROM service_providers WHERE user_id = get_user_id())
  ));

-- DEMO REGISTRATIONS
CREATE POLICY "Users manage own demo registrations" ON demo_registrations FOR ALL
  USING (registered_by = get_user_id());
CREATE POLICY "Provider sees demo registrations" ON demo_registrations FOR SELECT
  USING (demo_session_id IN (
    SELECT ds.id FROM demo_sessions ds
    JOIN classes c ON ds.class_id = c.id
    JOIN provider_apartment_registrations par ON c.provider_registration_id = par.id
    WHERE par.provider_id IN (SELECT id FROM service_providers WHERE user_id = get_user_id())
  ));

-- ENROLLMENTS
CREATE POLICY "Users manage own enrollments" ON enrollments FOR ALL USING (enrolled_by = get_user_id());
CREATE POLICY "Provider sees batch enrollments" ON enrollments FOR SELECT
  USING (batch_id IN (
    SELECT b.id FROM batches b
    JOIN classes c ON b.class_id = c.id
    JOIN provider_apartment_registrations par ON c.provider_registration_id = par.id
    WHERE par.provider_id IN (SELECT id FROM service_providers WHERE user_id = get_user_id())
  ));
CREATE POLICY "Provider updates enrollment status" ON enrollments FOR UPDATE
  USING (batch_id IN (
    SELECT b.id FROM batches b
    JOIN classes c ON b.class_id = c.id
    JOIN provider_apartment_registrations par ON c.provider_registration_id = par.id
    WHERE par.provider_id IN (SELECT id FROM service_providers WHERE user_id = get_user_id())
  ));

-- WAITLIST
CREATE POLICY "Users manage own waitlist" ON waitlist_entries FOR ALL USING (requested_by = get_user_id());
CREATE POLICY "Provider sees batch waitlist" ON waitlist_entries FOR SELECT
  USING (batch_id IN (
    SELECT b.id FROM batches b
    JOIN classes c ON b.class_id = c.id
    JOIN provider_apartment_registrations par ON c.provider_registration_id = par.id
    WHERE par.provider_id IN (SELECT id FROM service_providers WHERE user_id = get_user_id())
  ));

-- ATTENDANCE
CREATE POLICY "Provider manages attendance" ON attendance_records FOR ALL
  USING (marked_by = get_user_id());
CREATE POLICY "Users see own attendance" ON attendance_records FOR SELECT
  USING (enrollment_id IN (SELECT id FROM enrollments WHERE enrolled_by = get_user_id()));

-- PAYMENTS
CREATE POLICY "Payer manages own payments" ON payments FOR ALL USING (payer_user_id = get_user_id());
CREATE POLICY "Provider sees own payments" ON payments FOR SELECT
  USING (provider_id IN (SELECT id FROM service_providers WHERE user_id = get_user_id()));
CREATE POLICY "Provider confirms payments" ON payments FOR UPDATE
  USING (provider_id IN (SELECT id FROM service_providers WHERE user_id = get_user_id()));

-- ADMIN FEE PAYMENTS
CREATE POLICY "Admin manages fee payments" ON admin_fee_payments FOR ALL
  USING (provider_registration_id IN (
    SELECT id FROM provider_apartment_registrations
    WHERE apartment_id IN (SELECT apartment_id FROM apartment_admins WHERE user_id = get_user_id())
  ));
CREATE POLICY "Provider sees own fee invoices" ON admin_fee_payments FOR SELECT
  USING (provider_registration_id IN (
    SELECT id FROM provider_apartment_registrations
    WHERE provider_id IN (SELECT id FROM service_providers WHERE user_id = get_user_id())
  ));

-- REVIEWS
CREATE POLICY "Anyone can read visible reviews" ON reviews FOR SELECT USING (is_visible = true);
CREATE POLICY "Users manage own reviews" ON reviews FOR ALL USING (reviewer_user_id = get_user_id());
CREATE POLICY "Provider replies to reviews" ON reviews FOR UPDATE
  USING (class_id IN (
    SELECT c.id FROM classes c
    JOIN provider_apartment_registrations par ON c.provider_registration_id = par.id
    WHERE par.provider_id IN (SELECT id FROM service_providers WHERE user_id = get_user_id())
  ));

-- ANNOUNCEMENTS
CREATE POLICY "Provider manages own announcements" ON announcements FOR ALL USING (author_id = get_user_id());
CREATE POLICY "Users see apartment announcements" ON announcements FOR SELECT
  USING (
    apartment_id IN (SELECT apartment_id FROM families WHERE primary_user_id = get_user_id())
    OR batch_id IN (SELECT batch_id FROM enrollments WHERE enrolled_by = get_user_id())
    OR class_id IN (
      SELECT b.class_id FROM batches b
      JOIN enrollments e ON e.batch_id = b.id
      WHERE e.enrolled_by = get_user_id()
    )
  );

-- CHAT
CREATE POLICY "Users see own conversations" ON chat_conversations FOR ALL
  USING (participant_1 = get_user_id() OR participant_2 = get_user_id());
CREATE POLICY "Users see own messages" ON chat_messages FOR ALL
  USING (conversation_id IN (
    SELECT id FROM chat_conversations
    WHERE participant_1 = get_user_id() OR participant_2 = get_user_id()
  ));

-- NOTIFICATIONS
CREATE POLICY "Users see own notifications" ON notifications FOR ALL USING (user_id = get_user_id());

-- CLASS MATERIALS
CREATE POLICY "Provider manages own materials" ON class_materials FOR ALL USING (uploaded_by = get_user_id());
CREATE POLICY "Enrolled users see class materials" ON class_materials FOR SELECT
  USING (class_id IN (
    SELECT b.class_id FROM batches b
    JOIN enrollments e ON e.batch_id = b.id
    WHERE e.enrolled_by = get_user_id() AND e.status = 'active'
  ));

-- APARTMENT ADMINS
CREATE POLICY "Admin sees own record" ON apartment_admins FOR SELECT USING (user_id = get_user_id());
CREATE POLICY "Platform admin manages admins" ON apartment_admins FOR ALL USING (is_platform_admin());

-- PLATFORM FEE CONFIG
CREATE POLICY "Platform admin manages fees" ON platform_fee_config FOR ALL USING (is_platform_admin());
CREATE POLICY "Anyone can read active fees" ON platform_fee_config FOR SELECT USING (is_active = true);

-- REFERRALS
CREATE POLICY "Users manage own referrals" ON referrals FOR ALL USING (referrer_user_id = get_user_id());
