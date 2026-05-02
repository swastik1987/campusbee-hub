-- ============================================================
-- FAMILY LINKS — Junction table for multi-user family access
-- ============================================================
CREATE TABLE IF NOT EXISTS family_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) NOT NULL,
  user_id UUID REFERENCES users(id) NOT NULL,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('primary', 'member')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'unlinked')),
  linked_at TIMESTAMPTZ DEFAULT now(),
  linked_via VARCHAR(20) DEFAULT 'invite' CHECK (linked_via IN ('creation', 'invite', 'claim')),
  unlinked_at TIMESTAMPTZ,
  unlinked_by UUID REFERENCES users(id),
  unlink_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(family_id, user_id)
);

-- ============================================================
-- FAMILY INVITES — Invite flow tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS family_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) NOT NULL,
  invited_by UUID REFERENCES users(id) NOT NULL,
  invited_user_id UUID REFERENCES users(id),
  invited_phone VARCHAR(15),
  invited_email VARCHAR(255),
  invite_code VARCHAR(20) UNIQUE NOT NULL,
  invite_type VARCHAR(20) DEFAULT 'join_family' CHECK (invite_type IN ('join_family', 'claim_member')),
  claimed_member_id UUID REFERENCES family_members(id),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),
  accepted_by UUID REFERENCES users(id),
  message TEXT,
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_family_links_user ON family_links(user_id, status);
CREATE INDEX idx_family_links_family ON family_links(family_id, status);
CREATE INDEX idx_family_invites_code ON family_invites(invite_code);
CREATE INDEX idx_family_invites_phone ON family_invites(invited_phone);
CREATE INDEX idx_family_invites_email ON family_invites(invited_email);
CREATE INDEX idx_family_invites_user ON family_invites(invited_user_id);

-- ============================================================
-- ENABLE RLS
-- ============================================================
ALTER TABLE family_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_invites ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- BACKFILL: create family_links for all existing families
-- ============================================================
INSERT INTO family_links (family_id, user_id, role, status, linked_via)
SELECT id, primary_user_id, 'primary', 'active', 'creation'
FROM families
ON CONFLICT (family_id, user_id) DO NOTHING;

-- ============================================================
-- RLS POLICIES FOR NEW TABLES
-- ============================================================

-- FAMILY LINKS
CREATE POLICY "Users see own family links" ON family_links
  FOR SELECT USING (user_id = get_user_id());

CREATE POLICY "Linked users see co-member links" ON family_links
  FOR SELECT USING (
    family_id IN (SELECT family_id FROM family_links WHERE user_id = get_user_id() AND status = 'active')
  );

CREATE POLICY "Linked users can unlink themselves" ON family_links
  FOR UPDATE USING (user_id = get_user_id());

CREATE POLICY "Primary can unlink members" ON family_links
  FOR UPDATE USING (
    family_id IN (
      SELECT family_id FROM family_links
      WHERE user_id = get_user_id() AND role = 'primary' AND status = 'active'
    )
  );

-- Allow inserting family_links (for invite accept flow)
CREATE POLICY "Users can create own family links" ON family_links
  FOR INSERT WITH CHECK (user_id = get_user_id());

-- FAMILY INVITES
CREATE POLICY "Inviter manages own invites" ON family_invites
  FOR ALL USING (invited_by = get_user_id());

CREATE POLICY "Invitee can see and accept invites" ON family_invites
  FOR SELECT USING (
    invited_user_id = get_user_id()
    OR invited_phone = (SELECT mobile_number FROM users WHERE id = get_user_id())
    OR invited_email = (SELECT email FROM users WHERE id = get_user_id())
  );

CREATE POLICY "Invitee can update invite status" ON family_invites
  FOR UPDATE USING (
    invited_user_id = get_user_id()
    OR invited_phone = (SELECT mobile_number FROM users WHERE id = get_user_id())
    OR invited_email = (SELECT email FROM users WHERE id = get_user_id())
  );

-- ============================================================
-- UPDATE EXISTING RLS POLICIES TO USE family_links
-- ============================================================

-- FAMILIES: any linked active user can view/manage
DROP POLICY IF EXISTS "Users manage own family" ON families;

CREATE POLICY "Linked users manage family" ON families
  FOR ALL USING (
    id IN (SELECT family_id FROM family_links WHERE user_id = get_user_id() AND status = 'active')
  );

-- FAMILY MEMBERS: any linked active user can view/manage
DROP POLICY IF EXISTS "Users manage own family members" ON family_members;

CREATE POLICY "Linked users manage family members" ON family_members
  FOR ALL USING (
    family_id IN (SELECT family_id FROM family_links WHERE user_id = get_user_id() AND status = 'active')
  );

-- ENROLLMENTS: update seeker-side policy
DROP POLICY IF EXISTS "Users manage own enrollments" ON enrollments;

CREATE POLICY "Linked users manage family enrollments" ON enrollments
  FOR ALL USING (
    enrolled_by = get_user_id()
    OR family_member_id IN (
      SELECT fm.id FROM family_members fm
      JOIN family_links fl ON fm.family_id = fl.family_id
      WHERE fl.user_id = get_user_id() AND fl.status = 'active'
    )
  );

-- PAYMENTS: update payer-side policy
DROP POLICY IF EXISTS "Payer manages own payments" ON payments;

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

CREATE POLICY "Linked users can record payments" ON payments
  FOR INSERT WITH CHECK (
    payer_user_id = get_user_id()
  );

-- ATTENDANCE: update seeker-side policy
DROP POLICY IF EXISTS "Users see own attendance" ON attendance_records;

CREATE POLICY "Linked users see family attendance" ON attendance_records
  FOR SELECT USING (
    enrollment_id IN (
      SELECT e.id FROM enrollments e
      JOIN family_members fm ON e.family_member_id = fm.id
      JOIN family_links fl ON fm.family_id = fl.family_id
      WHERE fl.user_id = get_user_id() AND fl.status = 'active'
    )
  );

-- WAITLIST: update seeker-side policy
DROP POLICY IF EXISTS "Users manage own waitlist" ON waitlist_entries;

CREATE POLICY "Linked users manage family waitlist" ON waitlist_entries
  FOR ALL USING (
    requested_by = get_user_id()
    OR family_member_id IN (
      SELECT fm.id FROM family_members fm
      JOIN family_links fl ON fm.family_id = fl.family_id
      WHERE fl.user_id = get_user_id() AND fl.status = 'active'
    )
  );

-- DEMO REGISTRATIONS: update seeker-side policy
DROP POLICY IF EXISTS "Users manage own demo registrations" ON demo_registrations;

CREATE POLICY "Linked users manage family demo registrations" ON demo_registrations
  FOR ALL USING (
    registered_by = get_user_id()
    OR family_member_id IN (
      SELECT fm.id FROM family_members fm
      JOIN family_links fl ON fm.family_id = fl.family_id
      WHERE fl.user_id = get_user_id() AND fl.status = 'active'
    )
  );

-- CLASS MATERIALS: update seeker-side policy
DROP POLICY IF EXISTS "Enrolled users see class materials" ON class_materials;

CREATE POLICY "Linked users see family class materials" ON class_materials
  FOR SELECT USING (
    class_id IN (
      SELECT b.class_id FROM batches b
      JOIN enrollments e ON e.batch_id = b.id
      JOIN family_members fm ON e.family_member_id = fm.id
      JOIN family_links fl ON fm.family_id = fl.family_id
      WHERE fl.user_id = get_user_id() AND fl.status = 'active' AND e.status = 'active'
    )
  );

-- ANNOUNCEMENTS: update seeker-side policy
DROP POLICY IF EXISTS "Users see apartment announcements" ON announcements;

CREATE POLICY "Linked users see relevant announcements" ON announcements
  FOR SELECT USING (
    apartment_id IN (
      SELECT f.apartment_id FROM families f
      JOIN family_links fl ON f.id = fl.family_id
      WHERE fl.user_id = get_user_id() AND fl.status = 'active'
    )
    OR batch_id IN (
      SELECT e.batch_id FROM enrollments e
      JOIN family_members fm ON e.family_member_id = fm.id
      JOIN family_links fl ON fm.family_id = fl.family_id
      WHERE fl.user_id = get_user_id() AND fl.status = 'active'
    )
    OR class_id IN (
      SELECT b.class_id FROM batches b
      JOIN enrollments e ON e.batch_id = b.id
      JOIN family_members fm ON e.family_member_id = fm.id
      JOIN family_links fl ON fm.family_id = fl.family_id
      WHERE fl.user_id = get_user_id() AND fl.status = 'active'
    )
  );
