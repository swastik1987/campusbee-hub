# CampusBee — Claude Code Master Build Plan

> **This document is the complete build instruction set for Claude Code.**
> Place this file as `CLAUDE.md` in the project root after cloning from GitHub.
> Claude Code reads CLAUDE.md automatically for project context.
> Work through the phases sequentially. Each phase builds on the previous one.

---

## PROJECT CONTEXT

**CampusBee** is a hyperlocal classes marketplace for apartment communities in Indian cities. Residents discover and enroll in classes (sports, dance, arts, academics, music) offered within their apartment complex. Providers list classes, manage batches, take attendance, and track payments. Apartment admins approve providers and collect commissions.

### Tech Stack
- **Frontend:** React 18+ with TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, React Router v6, Lucide React icons, Recharts
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions + Realtime)
- **Auth:** Email magic links (MVP), phone OTP (future)
- **Payments:** Track-only (P2P via external UPI apps, recorded in-app)

### Architecture Principles
- **Unified User Model:** Every user is a seeker by default. Provider/Admin personas are unlocked additively. Users can hold multiple personas simultaneously and switch between them. No single rigid "role" field.
- **Apartment-scoped multi-tenancy:** All data is scoped to an apartment complex. RLS ensures data isolation.
- **Mobile-first:** Design for 375px width. Bottom navigation. Large touch targets (44px min). Sheet modals (bottom drawers).
- **Draft → Published lifecycle:** Classes and batches start as drafts, providers publish when ready.

### Design Language
- **Primary:** Amber/Orange gradient (#F59E0B to #EA580C)
- **Text:** Dark navy (#1E293B)
- **Background:** Soft grey (#F8FAFC)
- **Cards:** White, 12px radius, subtle shadow
- **Provider accent:** Indigo (#6366F1)
- **Admin accent:** Emerald (#059669)
- **Font:** Inter
- **Icons:** Lucide React
- **Persona indicator:** Subtle accent color shift in header when switching personas

### File Structure Convention
```
src/
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── layout/          # BottomNav, Header, AuthGuard, PersonaSwitcher
│   ├── seeker/          # Seeker-specific components
│   ├── provider/        # Provider-specific components
│   ├── admin/           # Admin-specific components
│   └── shared/          # Shared components (ClassCard, BatchCard, etc.)
├── pages/
│   ├── auth/
│   ├── onboarding/
│   ├── seeker/
│   ├── provider/
│   └── admin/
├── hooks/               # Custom React hooks
├── contexts/            # React contexts (UserContext, etc.)
├── integrations/
│   └── supabase/        # Supabase client, types, helpers
├── lib/                 # Utility functions
├── types/               # TypeScript type definitions
└── constants/           # App constants, category lists, etc.
```

### Key Rules for Claude Code
1. Always use TypeScript with strict types. Define interfaces for all data shapes in `src/types/`.
2. Use TanStack Query for ALL Supabase data fetching. Custom hooks in `src/hooks/` (e.g., `useClasses`, `useBatches`, `useEnrollments`).
3. Use shadcn/ui components as the base — don't reinvent buttons, dialogs, inputs, etc.
4. Every list screen must have: loading skeleton, empty state with illustration, error state with retry, pull-to-refresh.
5. All forms must have: validation (use zod + react-hook-form), loading state on submit, error display, success feedback (toast).
6. Supabase queries must use `.select()` with explicit columns (never `select('*')` in production code).
7. RLS policies must be created for every new table.
8. After each phase, run `npm run build` to verify no TypeScript errors.

---

## PHASE 1: DATABASE SCHEMA & AUTH (Foundation)

### Step 1.1 — Complete Database Schema

Run the following SQL in Supabase SQL Editor (or create as a migration file at `supabase/migrations/001_complete_schema.sql`).

The Lovable bootstrap already created `users` and `apartment_complexes` tables. This step creates ALL remaining tables.

```sql
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
```

### Step 1.2 — RLS Policies

Create a second migration `supabase/migrations/002_rls_policies.sql`:

```sql
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
```

### Step 1.3 — TypeScript Types

Create `src/types/database.ts` with TypeScript interfaces matching every table. Generate these from the Supabase schema using the Supabase CLI: `npx supabase gen types typescript --project-id <project-id> > src/types/supabase.ts`. Then create clean application-level interfaces in `src/types/database.ts` that wrap the generated types.

### Step 1.4 — Supabase Storage Buckets

Create these storage buckets in Supabase:
- `avatars` — user profile pictures (public read)
- `class-images` — class cover images and gallery (public read)
- `provider-media` — provider photos, intro videos, UPI QR images (public read)
- `payment-screenshots` — payment proof screenshots (private, only payer and provider can access)
- `class-materials` — documents, notes uploaded by providers (private, only enrolled students)
- `invoices` — generated commission invoice PDFs (private)

---

## PHASE 2: ONBOARDING & USER SETUP

### Step 2.1 — Onboarding Flow (Multi-step)

Build `/onboarding` as a multi-step form with a progress indicator at the top.

**Step 1 of 3: "Tell us about yourself"**
- Full name input (pre-filled from auth if available)
- Avatar upload (optional, with camera/gallery picker)
- Creates/updates the row in `users` table

**Step 2 of 3: "Select your apartment"**
- Searchable dropdown (use shadcn/ui Combobox pattern) of apartment complexes where `status = 'approved'`
- Show apartment name + locality + city
- If apartment not found: "Don't see your apartment? Request to add it" → small form (apartment name, city, locality) that creates a row with `status = 'pending'`
- Flat number input
- Block/Tower input
- Creates a row in `families` table

**Step 3 of 3: "Add your family"**
- "Who will be taking classes?" prompt
- Add member cards: Name, Relationship (dropdown: Self, Son, Daughter, Spouse, Parent, Other), Date of Birth (date picker, auto-calculates age group)
- Must add at least one member (can be "Self")
- Each member creates a row in `family_members`

**After completion:** Navigate to `/home` (seeker home).

### Step 2.2 — User Context Enhancement

Update the existing `UserContext` to include:
- `user`: full user row from `users` table
- `family`: family row for current apartment
- `familyMembers`: array of family members
- `currentApartment`: apartment details
- `isProvider`: boolean (from user.is_provider)
- `isAdmin`: boolean (from user.is_apartment_admin)
- `activatePersona(persona)`: function to switch persona and update `last_active_persona`
- `providerProfile`: service_providers row (if isProvider)
- Load all of this on app startup via TanStack Query

### Step 2.3 — Persona Switcher Component

Build a `PersonaSwitcher` component:
- Small pill in the top-right of the header
- Shows current persona icon + label (e.g., 🏠 Seeker / 🎓 Provider / ⚙️ Admin)
- Tap to open a Sheet (bottom drawer) listing available personas
- Each persona option shows: icon, label, description
- "Seeker" always available
- "Provider" shows if `is_provider = true`, otherwise shows "Start Teaching →" CTA that navigates to provider onboarding
- "Admin" shows if `is_apartment_admin = true`
- Selecting a persona: updates `last_active_persona` in DB, navigates to that persona's home, bottom nav switches

---

## PHASE 3: PROVIDER FEATURES

### Step 3.1 — Become a Provider Flow

Build a flow accessible from Profile → "Start Teaching on CampusBee":

**Step 1: Provider Type**
- Two large cards: "Individual Instructor" vs "Academy / Institute"
- Individual: "I teach classes myself"
- Academy: "I run an organization with multiple trainers"

**Step 2: Profile Details**
- Business/display name
- Bio (textarea, 500 char limit)
- Experience (years dropdown)
- Qualifications (textarea)
- Specializations (multi-select tags)
- Profile photo upload
- Intro video URL (optional, YouTube/Instagram link)

**Step 3: Payment Details**
- UPI ID input with validation (format: name@upi or number@upi)
- UPI QR code image upload (with camera/gallery)
- WhatsApp number (pre-filled from user mobile, editable)

**Step 4: Select Apartments**
- Show apartments where the user has a family (they live there)
- Also allow searching other apartments
- Multi-select checkboxes
- Each selection creates a `provider_apartment_registrations` row with `status = 'pending'`

**On completion:** Set `users.is_provider = true`, create `service_providers` row, show "Application submitted! The apartment admin will review your request." Navigate to provider dashboard (which shows a pending state).

### Step 3.2 — Provider Dashboard

Build `/provider/dashboard`:
- **Header:** "Provider Dashboard" with apartment selector dropdown (if provider serves multiple apartments)
- **Pending state:** If no apartments have approved the provider yet, show a friendly illustration with "Your applications are being reviewed by apartment admins" and list the pending apartments with status badges
- **Active state (once at least one apartment approved):**
  - **Quick Stats Row (horizontal scroll):** 4 cards — Active Students (count), Active Classes (count), Revenue This Month (₹ amount), Pending Payments (count with red badge)
  - **Today's Schedule:** Timeline view showing today's batches with time, class name, batch name. "Take Attendance" quick action button on each.
  - **Action Required Section:** List of items needing attention — pending enrollment requests, unconfirmed payments. Each item is tappable.
  - **Quick Actions FAB:** Floating action button with options: "Add New Class", "Post Announcement", "Take Attendance"

### Step 3.3 — Create Class Flow

Build a multi-step form accessible from provider dashboard → "Add New Class":

**Step 1: Apartment & Category**
- Select apartment (from approved apartments only)
- Select category (show parent categories as cards with icons, then sub-categories)

**Step 2: Class Details**
- Title (text input)
- Short description (text input, 300 chars)
- Full description (textarea with markdown support or rich text)
- Class type selector: Recurring / Fixed Duration / One-Time
- Skill levels: multi-select chips (Beginner, Intermediate, Advanced, All Levels)
- Age range: min age and max age number inputs
- Venue details (text input — e.g., "Community Hall, Block A")
- What to bring (text input — e.g., "Racquet, sportswear")

**Step 3: Media**
- Cover image upload (required, with crop)
- Gallery images upload (up to 5)
- Promo video URL (optional)

**Step 4: Trial Class**
- Toggle: "Offer trial/demo classes?"
- If yes: Trial fee input (₹, can be 0 for free trial)

**Step 5: Review & Save**
- Summary of all entered details
- Two CTAs: "Save as Draft" and "Publish"
- Save creates the `classes` row with appropriate status
- Creates `provider_registration_id` link automatically

### Step 3.4 — Create/Manage Batches

Accessible from a class detail page → "Add Batch":

**Batch form:**
- Batch name (e.g., "Morning Beginners", "Weekend Advanced")
- Batch type: Level / Age Group / Time Slot / Custom
- Skill level: single select (if type is Level)
- Age range: min/max (if type is Age Group)
- Assign trainer: dropdown of provider's trainers (only for academy providers, skip for individual)
- Schedule builder:
  - Day selector (checkboxes for Mon–Sun)
  - Start time and End time pickers per selected day
  - Each selected day+time creates a `batch_schedules` row
- Capacity: number input (max batch size)
- Pricing: Fee amount (₹) + Fee frequency dropdown (Monthly, Per Session, Quarterly, For Duration, One-time)
- Duration (if class is fixed_duration): Start date, End date, Total sessions
- Registration mode: Auto-accept / Manual approval (radio)
- Auto-waitlist toggle (default on)
- Notes (optional textarea)
- Status: Save as Draft / Activate

**Batch list view (on class detail):**
- Cards showing: batch name, schedule summary (e.g., "Mon, Wed, Fri • 6:00–7:00 AM"), enrolled/capacity (e.g., "8/15"), status badge
- Edit, Pause, Complete actions per batch

### Step 3.5 — Class Addons

On class detail page → "Manage Add-ons" section:
- List existing addons
- Add new: Name, Description, Fee (₹), Type (One-time / Monthly / Per Event), Mandatory toggle
- Edit/delete existing addons

### Step 3.6 — Provider's My Classes List

Build `/provider/classes`:
- Filter bar: apartment dropdown + status filter chips (All, Draft, Published, Paused)
- Class cards showing: cover image thumbnail, title, category badge, apartment name, batches count, total students, status badge, rating
- Tap → class detail management page
- "Add New Class" FAB

### Step 3.7 — Trainer Management (Academy only)

Accessible from Provider Profile → "Manage Team":
- List of trainers with photo, name, specializations, assigned batches count
- Add trainer form: Name, Bio, Qualifications, Experience, Specializations (tags), Photo upload
- Edit/delete trainers
- Show which batches each trainer is assigned to

---

## PHASE 4: SEEKER FEATURES

### Step 4.1 — Seeker Home Screen

Build `/home`:
- **Header:** CampusBee logo + apartment name + notification bell (with unread count badge)
- **Search bar:** Prominent search input at top, tapping navigates to `/explore` with keyboard open
- **Category Grid:** 2-column grid of parent categories (Sports, Dance, Arts, Academics, Music, Martial Arts, Fitness, Languages). Each is a card with Lucide icon + name. Tap → `/explore?category={slug}`
- **Featured Classes:** Horizontal scroll of class cards marked as `is_featured = true`. Each card: cover image, title, provider name, rating stars, price badge. Tap → class detail.
- **New This Month:** Vertical list of classes created in the last 30 days, sorted by newest. Same card style.
- **Popular in [Apartment Name]:** Classes sorted by enrollment count (descending). Limit 5, "See All" link → `/explore?sort=popular`

### Step 4.2 — Explore & Search Screen

Build `/explore`:
- **Search input** at top (full-text search on class title + short_description). Use Supabase `.textSearch()` or `.ilike()`.
- **Filter chips (horizontal scroll):** Category, Age Group, Skill Level, Day of Week, Time Slot, Price Range. Tapping a chip opens a Sheet (bottom drawer) with filter options.
- **Sort dropdown:** Rating (High→Low), Price (Low→High), Newest, Most Popular
- **Results:** Vertical list of class cards. Each card shows: cover image (left thumbnail), title, provider name + type badge (Individual/Academy), category badge, rating + review count, price (lowest batch fee), schedule summary (e.g., "Mon/Wed/Fri"), available slots indicator. Tap → class detail page.
- **Empty state:** "No classes found matching your filters" with suggestion to adjust filters
- **Pagination:** Infinite scroll with loading spinner at bottom

### Step 4.3 — Class Detail Page

Build `/class/:classId`:
- **Cover image** full-width at top (or gallery carousel if multiple images)
- **Promo video** play button overlay (if video URL exists)
- **Class info section:**
  - Title (large)
  - Category badge + class type badge (Recurring / Fixed Duration / One-time)
  - Rating: star rating display + "(X reviews)" link that scrolls to reviews
  - Short description
- **Provider card:**
  - Photo + name + type badge (Individual / Academy)
  - Experience: "X years"
  - Verified badge (if verified)
  - "View Profile" link
  - "Chat" button (navigates to chat with provider)
  - "Call/WhatsApp" button (opens WhatsApp with pre-filled message)
- **For academy providers: "Meet the Trainers"** section showing trainer cards with photo, name, specialization
- **Full description** (expandable/collapsible)
- **"What to bring"** section (if filled)
- **"Venue"** section with location within apartment
- **Available Batches section:**
  - Each batch as a card:
    - Batch name + skill level badge
    - Schedule: "Mon, Wed, Fri • 6:00–7:00 AM"
    - Age range (if set)
    - Trainer name + photo (if academy)
    - Price: "₹X/month" (or per session, etc.)
    - Slots: "5 spots left" (green) or "Full — Join Waitlist" (amber)
    - CTA button: "Enroll Now" or "Join Waitlist"
- **Add-ons section** (if any): list with name, price, mandatory badge
- **"Book a Trial"** CTA (if trial_available = true): shows trial fee, date picker
- **Reviews section:**
  - Average rating display (large number + stars + count)
  - Filter: All / 5-star / 4-star / etc.
  - Review cards: reviewer name, rating stars, review text, date, "Verified Enrollment" badge
  - Provider reply (if exists)
  - "Write a Review" button (only if user has/had an enrollment)
- **Share button** (bottom sticky): "Share via WhatsApp" — opens WhatsApp with pre-filled message: "Check out [Title] at [Apartment] on CampusBee! [link]"
- **Bottom sticky CTA bar:** "Enroll Now — Starting ₹X/month" (shows lowest batch price)

### Step 4.4 — Provider Profile Page

Build `/provider-profile/:providerId`:
- Provider photo (large) + name + type badge
- Bio section
- Experience + Qualifications
- Specializations as tags
- Rating: aggregated across all their classes
- All classes by this provider in this apartment (card list)
- For academies: "Our Team" section showing trainers
- Contact section: WhatsApp button, Chat button

### Step 4.5 — Enrollment Flow

Triggered from "Enroll Now" on a batch card:

**Step 1: Select Family Member**
- List of user's family members with name, age, relationship
- Radio select — who is enrolling?

**Step 2: Review Batch**
- Batch name, schedule, price, trainer (if any)
- Addon selection: show available addons with checkboxes. Mandatory addons pre-checked and disabled.
- Total cost breakdown: Base fee + selected addon fees = Total

**Step 3: Confirm & Pay**
- Summary card: Member name, Class, Batch, Schedule, Total amount
- Provider's UPI QR code image (large, scannable)
- Provider's UPI ID with "Copy" button
- Amount to pay (bold, large)
- "I've made the payment" button

**Step 4: Record Payment**
- UPI Transaction Reference Number input (12-digit)
- Payment screenshot upload (optional)
- "Submit" button
- Creates `enrollments` row (status: 'pending' if manual approval, 'active' if auto-accept)
- Creates `payments` row (status: 'recorded')
- Shows success: "Enrolled! Your provider will confirm the payment."
- If batch is full and `auto_waitlist = true`: instead of enrollment, creates `waitlist_entries` row and shows "You're #X on the waitlist. We'll notify you when a spot opens."

### Step 4.6 — My Classes Screen

Build `/my-classes`:
- **Tabs:** Active | Upcoming | Completed
- **Active tab:** Classes where enrollment status = 'active' and batch is ongoing
  - Card per enrollment: Class cover thumbnail, class title, batch name, schedule summary, next session date/time, attendance summary (e.g., "85% — 17/20 sessions")
  - Tap → enrollment detail
- **Upcoming tab:** Enrollments where batch start_date is in the future
- **Completed tab:** Enrollments where status = 'completed'
- **Empty state per tab** with appropriate illustration and message

### Step 4.7 — Enrollment Detail Page

Build `/enrollment/:enrollmentId`:
- **Header:** Class title + batch name
- **Next Session card:** Date, time, venue. Countdown if within 24 hours.
- **Schedule tab:** Calendar month view with dots on scheduled days. Color-coded: green = attended, red = absent, grey = upcoming, yellow = late. Tap on a date to see details.
- **Attendance tab:** Summary stats (total sessions, present, absent, late, percentage). List view of all sessions with date and status.
- **Payments tab:** Payment history cards (date, amount, status badge: confirmed/pending/overdue). "Pay Now" button for upcoming dues.
- **Materials tab:** Documents, videos, notes shared by provider. Tappable to view/download.
- **Announcements tab:** Recent announcements from provider for this class/batch.

### Step 4.8 — Trial/Demo Booking

Accessible from class detail → "Book a Trial":
- Select from available demo sessions (date, time)
- Select family member
- If fee > 0: UPI payment flow (same as enrollment payment)
- If free: direct registration
- Confirmation with "Add to Calendar" option (generate .ics file)

---

## PHASE 5: APARTMENT ADMIN FEATURES

### Step 5.1 — Admin Dashboard

Build `/admin/dashboard`:
- **Header:** "Admin Dashboard" + apartment name
- **Stats Row:** 4 cards — Registered Families, Active Providers, Active Classes, Total Enrollments This Month
- **Provider Approval Queue:** Card list of pending provider applications with: provider name, type (individual/academy), specializations, "View Details" → opens Sheet with full profile, Approve/Reject buttons
- **Popular Classes Chart:** Bar chart (Recharts) showing top 5 classes by enrollment count
- **Category Distribution:** Pie chart showing enrollment distribution across categories
- **Recent Activity Feed:** Timeline of recent events (new provider applied, enrollment milestone, etc.)

### Step 5.2 — Provider Management

Build `/admin/providers`:
- **Tabs:** Active | Pending | Suspended
- **Active tab:** Provider cards with: name, type badge, classes count, total students, revenue this month (from confirmed payments), rating. Tap → provider detail.
- **Provider detail:** Full profile, all classes listed, fee agreement details, "Suspend Provider" button (with reason input).
- **Pending tab:** Applications awaiting approval. Each shows full profile details. Approve button with commission negotiation: set fee type (Flat/Percentage) and amount before approving.
- **Suspended tab:** Suspended providers with reason shown. "Reinstate" button.

### Step 5.3 — Admin Fee Management & Reports

Build `/admin/reports`:
- **Monthly Revenue Overview:** Table showing: Provider name, Total revenue, Fee type, Fee rate, Commission due, Status (Paid/Pending)
- **Filter by month** (month-year picker)
- **Per-provider breakdown:** Tap to see all confirmed payments for that provider that month
- **Mark as Paid:** Button to record that provider has paid their commission
- **Export as CSV** button

---

## PHASE 6: ENGAGEMENT FEATURES

### Step 6.1 — Attendance System (Provider Side)

Build attendance taking flow:
- Accessible from: Provider Dashboard → Today's Schedule → "Take Attendance" on a batch, OR Provider → My Classes → Batch → Attendance tab
- **Attendance screen:**
  - Header: Batch name + Date (defaults to today, can be changed)
  - List of enrolled students (from `enrollments` where status = 'active')
  - Each row: Student name + family member relationship (e.g., "Arjun — Son of Priya")
  - Status toggle per student: Present (green) / Absent (red) / Late (yellow)
  - Default all to "Present" (most common case — provider only needs to mark absences)
  - "Mark All Present" quick action
  - "Submit Attendance" button → creates `attendance_records` rows
  - Confirmation toast: "Attendance marked for X students"

### Step 6.2 — Attendance System (Seeker Side)

On Enrollment Detail → Attendance tab:
- **Monthly calendar view** with color-coded dots per date
- **Stats cards:** Attendance %, Total sessions, Present count, Absent count
- **List view toggle:** Date-wise list with status badges

### Step 6.3 — Payment Recording & Confirmation

**Seeker side (recording a payment):**
- Accessible from: My Classes → Enrollment Detail → Payments → "Pay Now"
- OR from a payment reminder notification
- Shows: Amount due, Payment period, Due date
- Provider's UPI QR image + UPI ID with Copy button
- After paying externally: Enter UPI Transaction Ref, upload screenshot (optional)
- Creates `payments` row with status 'recorded'

**Provider side (confirming payments):**
- Dashboard → "Pending Payments" section
- Or: Provider → Payments tab → Pending tab
- Each pending payment card: Student name, Amount, Date recorded, UPI Ref, Screenshot thumbnail (if uploaded)
- Actions: "Confirm Payment" (marks status = 'confirmed') / "Reject" (marks status = 'disputed', enters reason)
- Provider can also see the UPI ref to cross-check in their bank app

### Step 6.4 — Ratings & Reviews

**Seeker writes a review:**
- Accessible from: Class Detail → Reviews → "Write a Review" (only if user has an enrollment)
- Star rating (1–5, tap to select)
- Review text (textarea, optional)
- "Submit Review" → creates `reviews` row with `is_verified = true` (if enrollment exists)
- Updates class `total_rating` and `rating_count`

**Provider replies:**
- Provider → My Classes → Class Detail → Reviews section
- "Reply" button per review
- Reply text input → updates `reviews.provider_reply` and `provider_replied_at`

### Step 6.5 — In-App Chat

Build chat system using Supabase Realtime:

**Chat list (`/chat`):**
- List of conversations sorted by `last_message_at` (newest first)
- Each row: Other person's avatar + name, last message preview, time, unread indicator (blue dot)
- Search bar to filter conversations

**Chat detail (`/chat/:conversationId`):**
- Message bubbles (sent = right/primary color, received = left/grey)
- Text input at bottom with Send button
- Real-time updates via Supabase Realtime subscription on `chat_messages` where `conversation_id = X`
- On send: insert into `chat_messages`, update `chat_conversations.last_message_at` and `last_message_preview`
- "Call/WhatsApp" button in header (opens external WhatsApp)

**Initiating a new chat:**
- From Class Detail → "Chat with Provider" or Provider Profile → "Chat"
- Check if conversation already exists between these two users
- If yes: navigate to it. If no: create new `chat_conversations` row, then navigate.

### Step 6.6 — Announcements

**Provider creates announcement:**
- From Provider Dashboard → "Post Announcement" or from Class/Batch detail → "Announce"
- Scope selector: All students in this apartment / Students of a specific class / Students of a specific batch
- Type selector: General, Schedule Change, Cancellation, New Batch, Event, Urgent
- Title + Body (rich text or plain text)
- Pin toggle (keep at top)
- Creates `announcements` row

**Seeker views announcements:**
- On Enrollment Detail → Announcements tab
- On Seeker Home → Announcements section (apartment-wide announcements)
- Bell icon on home shows unread announcements count
- Announcement card: type icon, title, body, provider name, date. Urgent announcements have red accent.

---

## PHASE 7: ANALYTICS, NOTIFICATIONS & POLISH

### Step 7.1 — Provider Analytics

Build `/provider/payments` (rename to include analytics):
- **Revenue tab:**
  - Monthly revenue chart (Recharts BarChart, last 6 months)
  - Total revenue, Average per month
  - Revenue by class (breakdown)
  - Filter by apartment
- **Students tab:**
  - Total students (active enrollments)
  - Enrollment trend chart (line chart, last 6 months)
  - Students by class
  - New enrollments this month
- **Attendance tab:**
  - Average attendance rate across all batches
  - Attendance by batch (bar chart)
  - Low attendance alerts (students below 50%)
- **Payments tab:**
  - Collection rate (confirmed / total due)
  - Pending payments list
  - Overdue payments (with "Send Reminder" button per student)
  - Export CSV

### Step 7.2 — Notification System (In-App)

Build `/notifications` (accessible from bell icon):
- **Grouped by date:** "Today", "Yesterday", "This Week", "Earlier"
- **Each notification:** Icon (type-specific), Title, Body, Timestamp, Unread indicator (blue dot)
- Tap → navigates to the relevant entity (enrollment, payment, class, etc.) based on `reference_type` and `reference_id`
- "Mark all as read" button in header

**Create notifications via Supabase triggers or Edge Functions for:**
- Enrollment approved/rejected
- Payment confirmed/disputed
- New announcement
- New chat message
- Class tomorrow reminder
- Payment due in 3 days
- Payment overdue
- Waitlist spot offered
- New review received
- Provider application approved/suspended

### Step 7.3 — Payment Reminders

Build an Edge Function `generate-payment-reminders` (runs daily via cron):
- Find all active enrollments
- For monthly payments: check if the current month's payment exists and is confirmed
- If no payment recorded and we're past the 5th of the month: create a "payment_due" notification
- If no payment recorded and we're past the due date: create a "payment_overdue" notification
- Also create notifications for 3 days before due date

### Step 7.4 — Waitlist Automation

Build an Edge Function `process-waitlist` (triggered when an enrollment is dropped):
- When a student drops from a batch: decrement `current_enrollment_count`
- Check `waitlist_entries` for that batch, ordered by position
- Offer the spot to position #1: set status = 'offered', `offered_at = now()`, `offer_expires_at = now() + 24 hours`
- Create notification: "A spot opened in [Batch Name]! Enroll within 24 hours."

Build an Edge Function `expire-waitlist-offers` (runs hourly via cron):
- Find waitlist entries with status = 'offered' and `offer_expires_at < now()`
- Set status = 'expired'
- Move to the next person in line (repeat offer process)

### Step 7.5 — Class Materials

On Provider class detail → "Materials" tab:
- Upload button: select file type (Document, Video, Image, Note, Link)
- For document/image: file upload to Supabase Storage `class-materials` bucket
- For video/link: external URL input
- For note: rich text input
- Scope: "All batches" or select specific batch
- Title + Description

On Seeker enrollment detail → "Materials" tab:
- List of materials for this class (and optionally batch-specific)
- Tappable to view: documents open in browser, videos open URL, notes display inline, images display in lightbox

### Step 7.6 — Demo/Trial Class Flow

**Provider creates demo session:**
- From class detail → "Schedule a Trial"
- Date picker, Start time, End time
- Max participants (number input)
- Fee (₹, can be 0)

**Seeker books trial:**
- From class detail → "Book a Trial" section
- Shows upcoming demo sessions with date, time, fee, spots available
- Select session → select family member → payment (if fee > 0) → confirmed
- Shows in My Classes under a "Trials" section

### Step 7.7 — Final UI Polish

- **Empty states:** Every list screen needs a custom empty state with an illustration (use Lucide icons creatively), a message, and a CTA. Examples: "No classes yet" → "Explore classes", "No payments recorded" → "Your payment history will appear here"
- **Loading skeletons:** Every data-fetching screen needs Skeleton components (shadcn/ui Skeleton) that match the shape of the real content
- **Error states:** Every query should have an error fallback with "Something went wrong" + Retry button
- **Pull-to-refresh:** On all list screens (TanStack Query `refetch` on pull gesture)
- **Toast notifications:** Use shadcn/ui Toast for all success/error actions (enrollment confirmed, payment recorded, etc.)
- **Transitions:** Smooth page transitions using CSS transitions on route changes
- **WhatsApp share:** On class detail page, "Share" button generates a WhatsApp deep link: `https://wa.me/?text=Check%20out%20${classTitle}%20at%20${apartmentName}%20on%20CampusBee!%20${url}`
- **Responsive:** While mobile-first, ensure tablet (768px) and desktop (1024px+) layouts are usable. On desktop, show a centered container (max-width 480px) for the mobile app, or a sidebar layout for admin/provider dashboards.
- **Meta tags:** Set proper `<title>`, `<meta description>`, and Open Graph tags for class pages (for WhatsApp link previews).

---

## PHASE 8: PLATFORM ADMIN (Web Panel)

### Step 8.1 — Platform Admin Panel

Build as desktop-friendly pages (responsive, wider layouts):

**Apartment Management:**
- Table of all apartments: Name, City, Admin name, Status, Providers count, Families count
- Pending queue: apartments awaiting approval with details
- Approve/Reject with notes

**Admin Assignment:**
- Search for a user by mobile/email
- Assign them as apartment admin for a specific apartment
- Unassign admin

**Category Management:**
- Tree view of categories and sub-categories
- Add/edit/reorder categories
- Toggle active/inactive

**Global Analytics:**
- Platform-wide stats: Total apartments, Total providers, Total seekers, Total enrollments
- City-wise breakdown
- Growth charts (month over month)

**Platform Fee Configuration (Future):**
- Set fee type, value, who it applies to
- Toggle active/inactive
- Effective date

---

## SUMMARY OF ALL DATABASE TABLES (28 total)

1. users
2. apartment_complexes
3. apartment_admins
4. families
5. family_members
6. service_providers
7. trainers
8. provider_apartment_registrations
9. class_categories
10. classes
11. batches
12. batch_schedules
13. class_addons
14. demo_sessions
15. demo_registrations
16. enrollments
17. waitlist_entries
18. attendance_records
19. payments
20. admin_fee_payments
21. platform_fee_config
22. reviews
23. announcements
24. chat_conversations
25. chat_messages
26. notifications
27. class_materials
28. referrals

---

## VERIFICATION CHECKLIST (after each phase)

- [ ] `npm run build` passes with zero TypeScript errors
- [ ] All new tables have RLS enabled with appropriate policies
- [ ] All list screens have: loading skeleton, empty state, error state
- [ ] All forms have: validation, loading state, error display, success toast
- [ ] Mobile layout looks correct at 375px width
- [ ] Bottom nav is visible and correct for the active persona
- [ ] TanStack Query hooks are used for all data fetching (no raw `fetch` or `supabase.from()` in components)
- [ ] No `select('*')` — all queries specify explicit columns
