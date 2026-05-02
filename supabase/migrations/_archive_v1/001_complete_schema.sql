-- ============================================================
-- CAMPUSBEE COMPLETE DATABASE SCHEMA
-- Run this AFTER the Lovable bootstrap tables are in place
-- ============================================================

-- ============================================================
-- APARTMENT ADMINS
-- ============================================================
CREATE TABLE apartment_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  apartment_id UUID REFERENCES apartment_complexes(id) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  fee_type VARCHAR(20) DEFAULT 'flat' CHECK (fee_type IN ('flat', 'percentage')),
  fee_amount DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(apartment_id)
);

-- ============================================================
-- FAMILIES & MEMBERS
-- ============================================================
CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_user_id UUID REFERENCES users(id) NOT NULL,
  apartment_id UUID REFERENCES apartment_complexes(id) NOT NULL,
  flat_number VARCHAR(20),
  block_tower VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(primary_user_id, apartment_id)
);

CREATE TABLE family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) NOT NULL,
  name VARCHAR(100) NOT NULL,
  date_of_birth DATE,
  age_group VARCHAR(20) CHECK (age_group IN ('toddler', 'child', 'teen', 'adult', 'senior')),
  gender VARCHAR(10),
  relationship VARCHAR(30),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SERVICE PROVIDERS & TRAINERS
-- ============================================================
CREATE TABLE service_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL UNIQUE,
  provider_type VARCHAR(20) DEFAULT 'individual' CHECK (provider_type IN ('individual', 'academy')),
  business_name VARCHAR(200),
  bio TEXT,
  experience_years INTEGER,
  qualifications TEXT,
  specializations TEXT[] DEFAULT '{}',
  profile_photos TEXT[] DEFAULT '{}',
  intro_video_url TEXT,
  whatsapp_number VARCHAR(15),
  upi_id VARCHAR(100),
  upi_qr_image_url TEXT,
  website_url VARCHAR(500),
  instagram_handle VARCHAR(100),
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE trainers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES service_providers(id) NOT NULL,
  name VARCHAR(100) NOT NULL,
  bio TEXT,
  qualifications TEXT,
  experience_years INTEGER,
  specializations TEXT[] DEFAULT '{}',
  photo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PROVIDER <-> APARTMENT LINK
-- ============================================================
CREATE TABLE provider_apartment_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES service_providers(id) NOT NULL,
  apartment_id UUID REFERENCES apartment_complexes(id) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  admin_fee_type VARCHAR(20) CHECK (admin_fee_type IN ('flat', 'percentage', 'custom')),
  admin_fee_amount DECIMAL(10, 2),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  suspension_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(provider_id, apartment_id)
);

-- ============================================================
-- CLASS CATEGORIES (Platform-managed)
-- ============================================================
CREATE TABLE class_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  icon_name VARCHAR(50),
  parent_category_id UUID REFERENCES class_categories(id),
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- Seed categories
INSERT INTO class_categories (name, slug, icon_name, display_order) VALUES
  ('Sports', 'sports', 'Trophy', 1),
  ('Martial Arts', 'martial-arts', 'Swords', 2),
  ('Dance', 'dance', 'Music', 3),
  ('Arts & Craft', 'arts-craft', 'Palette', 4),
  ('Academics', 'academics', 'GraduationCap', 5),
  ('Music', 'music', 'Guitar', 6),
  ('Fitness & Yoga', 'fitness-yoga', 'Heart', 7),
  ('Languages', 'languages', 'Globe', 8);

-- Seed sub-categories
INSERT INTO class_categories (name, slug, icon_name, parent_category_id, display_order)
SELECT sub.name, sub.slug, sub.icon, p.id, sub.ord
FROM (VALUES
  ('Badminton', 'badminton', 'Racquet', 'sports', 1),
  ('Tennis', 'tennis', 'Circle', 'sports', 2),
  ('Basketball', 'basketball', 'Circle', 'sports', 3),
  ('Swimming', 'swimming', 'Waves', 'sports', 4),
  ('Skating', 'skating', 'Footprints', 'sports', 5),
  ('Cricket', 'cricket', 'Circle', 'sports', 6),
  ('Football', 'football', 'Circle', 'sports', 7),
  ('Karate', 'karate', 'Swords', 'martial-arts', 1),
  ('Taekwondo', 'taekwondo', 'Swords', 'martial-arts', 2),
  ('Classical', 'classical-dance', 'Music', 'dance', 1),
  ('Western', 'western-dance', 'Music', 'dance', 2),
  ('Bollywood', 'bollywood-dance', 'Music', 'dance', 3),
  ('Drawing & Painting', 'drawing-painting', 'Palette', 'arts-craft', 1),
  ('Craft', 'craft', 'Scissors', 'arts-craft', 2),
  ('Mathematics', 'mathematics', 'Calculator', 'academics', 1),
  ('Science', 'science', 'FlaskConical', 'academics', 2),
  ('Hindi', 'hindi', 'BookOpen', 'academics', 3),
  ('Kannada', 'kannada', 'BookOpen', 'academics', 4),
  ('English', 'english', 'BookOpen', 'academics', 5),
  ('Vocal', 'vocal-music', 'Mic', 'music', 1),
  ('Guitar', 'guitar', 'Guitar', 'music', 2),
  ('Piano / Keyboard', 'piano-keyboard', 'Piano', 'music', 3),
  ('Drums', 'drums', 'Drum', 'music', 4)
) AS sub(name, slug, icon, parent_slug, ord)
JOIN class_categories p ON p.slug = sub.parent_slug;

-- ============================================================
-- CLASSES
-- ============================================================
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_registration_id UUID REFERENCES provider_apartment_registrations(id) NOT NULL,
  category_id UUID REFERENCES class_categories(id) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  short_description VARCHAR(300),
  cover_image_url TEXT,
  gallery_urls TEXT[] DEFAULT '{}',
  promo_video_url TEXT,
  class_type VARCHAR(20) DEFAULT 'recurring' CHECK (class_type IN ('recurring', 'fixed_duration', 'one_time')),
  skill_level VARCHAR(20)[] DEFAULT '{}',
  age_group_min INTEGER,
  age_group_max INTEGER,
  venue_details TEXT,
  what_to_bring TEXT,
  trial_available BOOLEAN DEFAULT false,
  trial_fee DECIMAL(10, 2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'paused', 'archived')),
  is_featured BOOLEAN DEFAULT false,
  total_rating DECIMAL(3, 2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- BATCHES & SCHEDULES
-- ============================================================
CREATE TABLE batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id) NOT NULL,
  trainer_id UUID REFERENCES trainers(id),
  batch_name VARCHAR(100) NOT NULL,
  batch_type VARCHAR(20) DEFAULT 'level' CHECK (batch_type IN ('level', 'age_group', 'time_slot', 'custom')),
  skill_level VARCHAR(20) CHECK (skill_level IN ('beginner', 'intermediate', 'advanced', 'all_levels')),
  age_group_min INTEGER,
  age_group_max INTEGER,
  max_batch_size INTEGER NOT NULL,
  current_enrollment_count INTEGER DEFAULT 0,
  fee_amount DECIMAL(10, 2) NOT NULL,
  fee_frequency VARCHAR(20) NOT NULL CHECK (fee_frequency IN ('per_session', 'monthly', 'quarterly', 'for_duration', 'one_time')),
  start_date DATE,
  end_date DATE,
  total_sessions INTEGER,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'full', 'paused', 'completed', 'cancelled')),
  registration_mode VARCHAR(20) DEFAULT 'auto' CHECK (registration_mode IN ('auto', 'manual')),
  auto_waitlist BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE batch_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES batches(id) NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true
);

-- ============================================================
-- CLASS ADDONS
-- ============================================================
CREATE TABLE class_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  fee_amount DECIMAL(10, 2) NOT NULL,
  fee_type VARCHAR(20) DEFAULT 'one_time' CHECK (fee_type IN ('one_time', 'monthly', 'per_event')),
  is_mandatory BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- DEMO / TRIAL SESSIONS
-- ============================================================
CREATE TABLE demo_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id) NOT NULL,
  session_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_participants INTEGER DEFAULT 10,
  current_count INTEGER DEFAULT 0,
  fee DECIMAL(10, 2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE demo_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_session_id UUID REFERENCES demo_sessions(id) NOT NULL,
  family_member_id UUID REFERENCES family_members(id) NOT NULL,
  registered_by UUID REFERENCES users(id) NOT NULL,
  status VARCHAR(20) DEFAULT 'registered' CHECK (status IN ('registered', 'attended', 'no_show', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(demo_session_id, family_member_id)
);

-- ============================================================
-- ENROLLMENTS & WAITLIST
-- ============================================================
CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES batches(id) NOT NULL,
  family_member_id UUID REFERENCES family_members(id) NOT NULL,
  enrolled_by UUID REFERENCES users(id) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'completed', 'dropped', 'rejected')),
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  approved_at TIMESTAMPTZ,
  dropped_at TIMESTAMPTZ,
  drop_reason TEXT,
  selected_addon_ids UUID[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(batch_id, family_member_id)
);

CREATE TABLE waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES batches(id) NOT NULL,
  family_member_id UUID REFERENCES family_members(id) NOT NULL,
  requested_by UUID REFERENCES users(id) NOT NULL,
  position INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'offered', 'enrolled', 'expired', 'cancelled')),
  offered_at TIMESTAMPTZ,
  offer_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(batch_id, family_member_id)
);

-- ============================================================
-- ATTENDANCE
-- ============================================================
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID REFERENCES enrollments(id) NOT NULL,
  batch_id UUID REFERENCES batches(id) NOT NULL,
  session_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'excused')),
  marked_by UUID REFERENCES users(id) NOT NULL,
  marked_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  UNIQUE(enrollment_id, session_date)
);

-- ============================================================
-- PAYMENTS (Track-only, P2P via UPI)
-- ============================================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID REFERENCES enrollments(id),
  payer_user_id UUID REFERENCES users(id) NOT NULL,
  provider_id UUID REFERENCES service_providers(id) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('class_fee', 'addon_fee', 'demo_fee', 'admin_fee')),
  payment_method VARCHAR(20) DEFAULT 'upi' CHECK (payment_method IN ('upi', 'cash', 'bank_transfer', 'other')),
  upi_transaction_id VARCHAR(100),
  payment_period_start DATE,
  payment_period_end DATE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'recorded', 'confirmed', 'disputed', 'refunded')),
  due_date DATE,
  paid_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES users(id),
  confirmed_at TIMESTAMPTZ,
  notes TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ADMIN FEE / COMMISSION INVOICES
-- ============================================================
CREATE TABLE admin_fee_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_registration_id UUID REFERENCES provider_apartment_registrations(id) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  total_provider_revenue DECIMAL(10, 2),
  total_enrollments INTEGER,
  commission_type VARCHAR(20),
  commission_rate DECIMAL(10, 2),
  calculated_from_revenue DECIMAL(10, 2),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'confirmed', 'waived', 'disputed')),
  payment_method VARCHAR(20),
  upi_transaction_id VARCHAR(100),
  invoice_url TEXT,
  paid_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PLATFORM FEE CONFIG (Future)
-- ============================================================
CREATE TABLE platform_fee_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_type VARCHAR(20) CHECK (fee_type IN ('flat_per_transaction', 'percentage', 'monthly_subscription')),
  fee_value DECIMAL(10, 2),
  applies_to VARCHAR(20) CHECK (applies_to IN ('provider', 'apartment_admin', 'both')),
  is_active BOOLEAN DEFAULT false,
  effective_from DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id) NOT NULL,
  reviewer_user_id UUID REFERENCES users(id) NOT NULL,
  enrollment_id UUID REFERENCES enrollments(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  is_verified BOOLEAN DEFAULT false,
  provider_reply TEXT,
  provider_replied_at TIMESTAMPTZ,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(class_id, reviewer_user_id)
);

-- ============================================================
-- ANNOUNCEMENTS
-- ============================================================
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES users(id) NOT NULL,
  apartment_id UUID REFERENCES apartment_complexes(id),
  class_id UUID REFERENCES classes(id),
  batch_id UUID REFERENCES batches(id),
  target_audience VARCHAR(20) NOT NULL CHECK (target_audience IN ('all_apartment', 'class_students', 'batch_students')),
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  announcement_type VARCHAR(20) DEFAULT 'general' CHECK (announcement_type IN ('general', 'schedule_change', 'cancellation', 'new_batch', 'event', 'urgent')),
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- CHAT
-- ============================================================
CREATE TABLE chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 UUID REFERENCES users(id) NOT NULL,
  participant_2 UUID REFERENCES users(id) NOT NULL,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES chat_conversations(id) NOT NULL,
  sender_id UUID REFERENCES users(id) NOT NULL,
  message_text TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'system')),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  notification_type VARCHAR(30) NOT NULL,
  reference_type VARCHAR(30),
  reference_id UUID,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- CLASS MATERIALS
-- ============================================================
CREATE TABLE class_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id) NOT NULL,
  batch_id UUID REFERENCES batches(id),
  uploaded_by UUID REFERENCES users(id) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  material_type VARCHAR(20) NOT NULL CHECK (material_type IN ('document', 'video', 'link', 'image', 'note')),
  file_url TEXT,
  external_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- REFERRALS (Future)
-- ============================================================
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID REFERENCES users(id) NOT NULL,
  referred_user_id UUID REFERENCES users(id),
  apartment_id UUID REFERENCES apartment_complexes(id) NOT NULL,
  referral_code VARCHAR(20) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'signed_up', 'enrolled', 'rewarded')),
  reward_type VARCHAR(20),
  reward_value DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT now(),
  converted_at TIMESTAMPTZ
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_classes_category ON classes(category_id);
CREATE INDEX idx_classes_provider_reg ON classes(provider_registration_id);
CREATE INDEX idx_classes_status ON classes(status);
CREATE INDEX idx_batches_class ON batches(class_id);
CREATE INDEX idx_batches_trainer ON batches(trainer_id);
CREATE INDEX idx_enrollments_batch ON enrollments(batch_id);
CREATE INDEX idx_enrollments_member ON enrollments(family_member_id);
CREATE INDEX idx_payments_enrollment ON payments(enrollment_id);
CREATE INDEX idx_payments_payer ON payments(payer_user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_attendance_enrollment ON attendance_records(enrollment_id);
CREATE INDEX idx_attendance_date ON attendance_records(session_date);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_provider_apt_reg ON provider_apartment_registrations(apartment_id, status);
CREATE INDEX idx_families_apartment ON families(apartment_id);
CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id, created_at);
CREATE INDEX idx_trainers_provider ON trainers(provider_id);
CREATE INDEX idx_class_materials_class ON class_materials(class_id);
CREATE INDEX idx_referrals_code ON referrals(referral_code);
CREATE INDEX idx_reviews_class ON reviews(class_id);
CREATE INDEX idx_announcements_apartment ON announcements(apartment_id);
CREATE INDEX idx_waitlist_batch ON waitlist_entries(batch_id);

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE apartment_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_apartment_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_fee_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
