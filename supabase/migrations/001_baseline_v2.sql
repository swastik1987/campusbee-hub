-- ============================================================================
-- 001_baseline_v2.sql  —  CampusBee v2 schema baseline
-- ============================================================================
-- Apply AFTER 000_wipe_v1.sql.
-- Creates all v2 tables, indexes, foundational helpers, and triggers.
-- RLS policies live in 002_rls_v2.sql.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"   WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto"    WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "postgis";  -- geography/geometry types + GIST

-- ---------------------------------------------------------------------------
-- Foundational helpers
-- ---------------------------------------------------------------------------

-- Maintain `updated_at` columns on row updates.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- USERS & AUTH MIRROR
-- ============================================================================
CREATE TABLE public.users (
  id                     UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  auth_id                UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name              TEXT NOT NULL,
  email                  TEXT UNIQUE,
  mobile_number          TEXT,
  avatar_url             TEXT,

  -- Persona flags
  is_provider            BOOLEAN NOT NULL DEFAULT false,
  is_platform_admin      BOOLEAN NOT NULL DEFAULT false,
  last_active_persona    TEXT NOT NULL DEFAULT 'seeker'
                           CHECK (last_active_persona IN ('seeker','provider','platform_admin')),

  -- Status
  is_active              BOOLEAN NOT NULL DEFAULT true,
  is_verified            BOOLEAN NOT NULL DEFAULT false,

  -- Seeker home location (set via MapMyIndia picker)
  seeker_home_address    TEXT,
  seeker_home_location   geography(Point, 4326),

  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_auth_id           ON public.users(auth_id);
CREATE INDEX idx_users_is_provider       ON public.users(is_provider) WHERE is_provider;
CREATE INDEX idx_users_is_platform_admin ON public.users(is_platform_admin) WHERE is_platform_admin;
CREATE INDEX idx_users_seeker_home_loc   ON public.users USING GIST (seeker_home_location);
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================================
-- FAMILIES
-- ============================================================================
CREATE TABLE public.families (
  id                UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  primary_user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (primary_user_id)
);
CREATE INDEX idx_families_primary_user ON public.families(primary_user_id);
CREATE TRIGGER trg_families_updated_at BEFORE UPDATE ON public.families
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.family_members (
  id              UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  family_id       UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL,
  date_of_birth   DATE,
  age_group       TEXT CHECK (age_group IN ('infant','toddler','child','teen','adult','senior')),
  gender          TEXT CHECK (gender IN ('male','female','other','prefer_not_to_say')),
  relationship    TEXT,
  linked_user_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_family_members_family       ON public.family_members(family_id);
CREATE INDEX idx_family_members_linked_user  ON public.family_members(linked_user_id);
CREATE TRIGGER trg_family_members_updated_at BEFORE UPDATE ON public.family_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Multi-adult linking (Phase 2 family linking)
CREATE TABLE public.family_links (
  id          UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  family_id   UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id)    ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'co_primary'
                CHECK (role IN ('primary','co_primary','viewer')),
  status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('pending','active','revoked')),
  invited_by  UUID REFERENCES public.users(id),
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (family_id, user_id)
);
CREATE INDEX idx_family_links_user   ON public.family_links(user_id, status);
CREATE INDEX idx_family_links_family ON public.family_links(family_id, status);

CREATE TABLE public.family_invites (
  id              UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  family_id       UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  invite_code     TEXT NOT NULL UNIQUE,
  invited_email   TEXT,
  invited_phone   TEXT,
  invited_user_id UUID REFERENCES public.users(id),
  invited_by      UUID NOT NULL REFERENCES public.users(id),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  accepted_by     UUID REFERENCES public.users(id),
  accepted_at     TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','accepted','expired','revoked')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_family_invites_code  ON public.family_invites(invite_code);
CREATE INDEX idx_family_invites_email ON public.family_invites(invited_email);
CREATE INDEX idx_family_invites_phone ON public.family_invites(invited_phone);
CREATE INDEX idx_family_invites_user  ON public.family_invites(invited_user_id);


-- ============================================================================
-- PROVIDERS
-- ============================================================================
CREATE TABLE public.service_providers (
  id                          UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id                     UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  business_name               TEXT NOT NULL,
  provider_type               TEXT NOT NULL DEFAULT 'individual'
                                CHECK (provider_type IN ('individual','academy')),
  bio                         TEXT,
  experience_years            INTEGER,
  qualifications              TEXT[],
  specializations             TEXT[],
  specialization_category_ids UUID[],
  whatsapp_number             TEXT,
  logo_url                    TEXT,
  is_verified                 BOOLEAN NOT NULL DEFAULT false,

  -- Provider home base (fallback location for home-based classes)
  home_address                TEXT,
  home_location               geography(Point, 4326),

  -- Subscription tier
  subscription_tier           TEXT NOT NULL DEFAULT 'basic'
                                CHECK (subscription_tier IN ('basic','premium')),
  subscription_valid_until    TIMESTAMPTZ,

  -- Suspension
  suspended_at                TIMESTAMPTZ,
  suspension_reason           TEXT,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_providers_user     ON public.service_providers(user_id);
CREATE INDEX idx_providers_tier     ON public.service_providers(subscription_tier);
CREATE INDEX idx_providers_home_loc ON public.service_providers USING GIST (home_location);
CREATE TRIGGER trg_providers_updated_at BEFORE UPDATE ON public.service_providers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.trainers (
  id              UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  provider_id     UUID NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  specialization  TEXT,
  bio             TEXT,
  avatar_url      TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_trainers_provider ON public.trainers(provider_id);
CREATE TRIGGER trg_trainers_updated_at BEFORE UPDATE ON public.trainers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.provider_subscription_requests (
  id                 UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  provider_id        UUID NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  requested_tier     TEXT NOT NULL DEFAULT 'premium'
                       CHECK (requested_tier IN ('premium')),
  status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','approved','rejected')),
  notes              TEXT,
  off_app_payment_ref TEXT,
  granted_until      TIMESTAMPTZ,
  rejection_reason   TEXT,
  requested_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by        UUID REFERENCES public.users(id),
  reviewed_at        TIMESTAMPTZ
);
CREATE INDEX idx_subscription_reqs_provider ON public.provider_subscription_requests(provider_id, status);
CREATE INDEX idx_subscription_reqs_status   ON public.provider_subscription_requests(status);


-- ============================================================================
-- CATEGORIES & CLASSES
-- ============================================================================
CREATE TABLE public.class_categories (
  id          UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  icon        TEXT,
  parent_id   UUID REFERENCES public.class_categories(id) ON DELETE CASCADE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_categories_parent ON public.class_categories(parent_id);
CREATE INDEX idx_categories_slug   ON public.class_categories(slug);

CREATE TABLE public.classes (
  id                          UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  provider_id                 UUID NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  category_id                 UUID REFERENCES public.class_categories(id),
  title                       TEXT NOT NULL,
  description                 TEXT,
  status                      TEXT NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','published','paused','archived')),

  -- Audience
  age_min                     INTEGER,
  age_max                     INTEGER,
  skill_level                 TEXT CHECK (skill_level IN ('beginner','intermediate','advanced','all')),

  -- Trial
  trial_available             BOOLEAN NOT NULL DEFAULT false,
  trial_fee                   NUMERIC(10,2),

  -- Media & tags
  images                      TEXT[] NOT NULL DEFAULT '{}',
  tags                        TEXT[] NOT NULL DEFAULT '{}',

  -- Location (per-class)
  address                     TEXT,
  location                    geography(Point, 4326),
  is_home_based               BOOLEAN NOT NULL DEFAULT false,

  -- Moderation
  moderation_status           TEXT NOT NULL DEFAULT 'pending'
                                CHECK (moderation_status IN ('pending','in_review','approved','rejected')),
  moderation_notes            TEXT,

  -- Aggregates
  total_rating                NUMERIC(10,2) NOT NULL DEFAULT 0,
  rating_count                INTEGER NOT NULL DEFAULT 0,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_classes_provider          ON public.classes(provider_id);
CREATE INDEX idx_classes_category          ON public.classes(category_id);
CREATE INDEX idx_classes_status_moderation ON public.classes(status, moderation_status);
CREATE INDEX idx_classes_location          ON public.classes USING GIST (location);
CREATE TRIGGER trg_classes_updated_at BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.batches (
  id                        UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  class_id                  UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  trainer_id                UUID REFERENCES public.trainers(id) ON DELETE SET NULL,
  name                      TEXT NOT NULL,
  status                    TEXT NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','active','full','paused','completed','cancelled')),
  max_capacity              INTEGER NOT NULL DEFAULT 0,
  current_enrollment_count  INTEGER NOT NULL DEFAULT 0,
  fee_amount                NUMERIC(10,2) NOT NULL DEFAULT 0,
  fee_frequency             TEXT NOT NULL DEFAULT 'monthly'
                              CHECK (fee_frequency IN ('one_time','monthly','quarterly','yearly','per_session')),
  skill_level               TEXT CHECK (skill_level IN ('beginner','intermediate','advanced','all')),
  auto_waitlist             BOOLEAN NOT NULL DEFAULT true,
  start_date                DATE,
  end_date                  DATE,
  total_sessions            INTEGER,
  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_batches_class   ON public.batches(class_id);
CREATE INDEX idx_batches_trainer ON public.batches(trainer_id);
CREATE INDEX idx_batches_status  ON public.batches(status);
CREATE TRIGGER trg_batches_updated_at BEFORE UPDATE ON public.batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.batch_schedules (
  id           UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  batch_id     UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  location     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_batch_schedules_batch ON public.batch_schedules(batch_id);

CREATE TABLE public.class_addons (
  id           UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  class_id     UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  fee          NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_class_addons_class ON public.class_addons(class_id);


-- ============================================================================
-- DEMOS / TRIALS
-- ============================================================================
CREATE TABLE public.demo_sessions (
  id            UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  class_id      UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  session_date  DATE NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  max_capacity  INTEGER NOT NULL DEFAULT 0,
  location_text TEXT,
  notes         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_demo_sessions_class ON public.demo_sessions(class_id, session_date);

CREATE TABLE public.demo_registrations (
  id                UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  demo_session_id   UUID NOT NULL REFERENCES public.demo_sessions(id) ON DELETE CASCADE,
  family_member_id  UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  registered_by     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'registered'
                      CHECK (status IN ('registered','attended','no_show','cancelled')),
  feedback          TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (demo_session_id, family_member_id)
);
CREATE INDEX idx_demo_regs_session ON public.demo_registrations(demo_session_id);
CREATE INDEX idx_demo_regs_member  ON public.demo_registrations(family_member_id);


-- ============================================================================
-- ENROLLMENTS & WAITLIST
-- ============================================================================
CREATE TABLE public.enrollments (
  id                  UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  batch_id            UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  family_member_id    UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  enrolled_by         UUID NOT NULL REFERENCES public.users(id),
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','active','paused','completed','dropped','rejected')),
  enrolled_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  dropped_at          TIMESTAMPTZ,
  selected_addon_ids  UUID[] NOT NULL DEFAULT '{}',
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_enrollments_batch  ON public.enrollments(batch_id, status);
CREATE INDEX idx_enrollments_member ON public.enrollments(family_member_id);
CREATE TRIGGER trg_enrollments_updated_at BEFORE UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.waitlist_entries (
  id                UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  batch_id          UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  family_member_id  UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  position          INTEGER NOT NULL,
  status            TEXT NOT NULL DEFAULT 'waiting'
                      CHECK (status IN ('waiting','offered','accepted','expired','cancelled')),
  offered_at        TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, family_member_id)
);
CREATE INDEX idx_waitlist_batch ON public.waitlist_entries(batch_id, status, position);


-- ============================================================================
-- ATTENDANCE & PAYMENTS
-- ============================================================================
CREATE TABLE public.attendance_records (
  id             UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  enrollment_id  UUID NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
  batch_id       UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  session_date   DATE NOT NULL,
  status         TEXT NOT NULL DEFAULT 'present'
                   CHECK (status IN ('present','absent','late','excused')),
  marked_by      UUID NOT NULL REFERENCES public.users(id),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, session_date)
);
CREATE INDEX idx_attendance_enrollment ON public.attendance_records(enrollment_id);
CREATE INDEX idx_attendance_batch_date ON public.attendance_records(batch_id, session_date);

CREATE TABLE public.payments (
  id                UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  enrollment_id     UUID REFERENCES public.enrollments(id) ON DELETE SET NULL,
  batch_id          UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  payer_user_id     UUID NOT NULL REFERENCES public.users(id),
  provider_id       UUID NOT NULL REFERENCES public.service_providers(id),
  amount            NUMERIC(10,2) NOT NULL,
  payment_type      TEXT NOT NULL DEFAULT 'class_fee'
                      CHECK (payment_type IN ('class_fee','addon_fee','demo_fee')),
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','recorded','confirmed','disputed','refunded')),
  payment_date      DATE,
  payment_mode      TEXT,
  reference_number  TEXT,
  screenshot_url    TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_enrollment ON public.payments(enrollment_id);
CREATE INDEX idx_payments_payer      ON public.payments(payer_user_id);
CREATE INDEX idx_payments_provider   ON public.payments(provider_id);
CREATE INDEX idx_payments_status     ON public.payments(status);
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================================
-- ENGAGEMENT
-- ============================================================================
CREATE TABLE public.reviews (
  id                UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  class_id          UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  batch_id          UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  family_member_id  UUID REFERENCES public.family_members(id) ON DELETE SET NULL,
  reviewer_user_id  UUID NOT NULL REFERENCES public.users(id),
  rating            SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment           TEXT,
  provider_reply    TEXT,
  provider_replied_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reviews_class ON public.reviews(class_id);
CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.announcements (
  id           UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  provider_id  UUID NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  batch_id     UUID REFERENCES public.batches(id) ON DELETE CASCADE,
  class_id     UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'general'
                 CHECK (type IN ('general','schedule_change','holiday','reminder','urgent')),
  priority     TEXT NOT NULL DEFAULT 'normal'
                 CHECK (priority IN ('low','normal','high')),
  is_pinned    BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_announcements_provider ON public.announcements(provider_id);
CREATE INDEX idx_announcements_batch    ON public.announcements(batch_id);

CREATE TABLE public.chat_conversations (
  id              UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  participant_ids UUID[] NOT NULL,
  type            TEXT NOT NULL DEFAULT 'direct'
                    CHECK (type IN ('direct','group','class','batch')),
  class_id        UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  batch_id        UUID REFERENCES public.batches(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_conv_participants ON public.chat_conversations USING GIN (participant_ids);

CREATE TABLE public.chat_messages (
  id              UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES public.users(id),
  body            TEXT NOT NULL,
  message_type    TEXT NOT NULL DEFAULT 'text'
                    CHECK (message_type IN ('text','image','file','system')),
  attachment_url  TEXT,
  is_read         BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_msgs_conv ON public.chat_messages(conversation_id, created_at);

CREATE TABLE public.notifications (
  id          UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT,
  type        TEXT NOT NULL,
  ref_type    TEXT,
  ref_id      UUID,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read, created_at DESC);

CREATE TABLE public.class_materials (
  id           UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  class_id     UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  batch_id     UUID REFERENCES public.batches(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  type         TEXT NOT NULL DEFAULT 'document'
                 CHECK (type IN ('document','video','audio','link','note')),
  file_url     TEXT,
  external_url TEXT,
  uploaded_by  UUID NOT NULL REFERENCES public.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_class_materials_class ON public.class_materials(class_id);


-- ============================================================================
-- SPONSORED LISTINGS & FEATURED BANNERS  (Premium-only, admin-approved)
-- ============================================================================
CREATE TABLE public.sponsored_listings (
  id                  UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  class_id            UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  provider_id         UUID NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','active','expired','rejected','cancelled')),
  slot_position       SMALLINT,
  center_address      TEXT,
  center_location     geography(Point, 4326),
  radius_km           NUMERIC(6,2) NOT NULL DEFAULT 10,
  valid_from          TIMESTAMPTZ,
  valid_until         TIMESTAMPTZ,
  off_app_payment_ref TEXT,
  rejection_reason    TEXT,
  requested_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by         UUID REFERENCES public.users(id),
  reviewed_at         TIMESTAMPTZ
);
CREATE INDEX idx_sponsored_status        ON public.sponsored_listings(status);
CREATE INDEX idx_sponsored_provider      ON public.sponsored_listings(provider_id);
CREATE INDEX idx_sponsored_center_loc    ON public.sponsored_listings USING GIST (center_location);
CREATE INDEX idx_sponsored_active_window ON public.sponsored_listings(valid_from, valid_until)
  WHERE status = 'active';

CREATE TABLE public.featured_banners (
  id                 UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  provider_id        UUID NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  class_id           UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  image_url          TEXT NOT NULL,
  target_url         TEXT,
  status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','approved','active','expired','rejected','cancelled')),
  moderation_status  TEXT NOT NULL DEFAULT 'pending'
                       CHECK (moderation_status IN ('pending','in_review','approved','rejected')),
  valid_from         TIMESTAMPTZ,
  valid_until        TIMESTAMPTZ,
  click_count        INTEGER NOT NULL DEFAULT 0,
  impression_count   INTEGER NOT NULL DEFAULT 0,
  rejection_reason   TEXT,
  requested_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by        UUID REFERENCES public.users(id),
  reviewed_at        TIMESTAMPTZ
);
CREATE INDEX idx_banners_status   ON public.featured_banners(status);
CREATE INDEX idx_banners_provider ON public.featured_banners(provider_id);


-- ============================================================================
-- MODERATION
-- ============================================================================
CREATE TABLE public.moderation_flags (
  id              UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  ref_type        TEXT NOT NULL
                    CHECK (ref_type IN ('class_image','class_text','provider_avatar','provider_bio','banner','class_title','class_description')),
  ref_id          UUID NOT NULL,
  owner_user_id   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  content_snapshot TEXT,
  image_url        TEXT,
  ai_provider     TEXT CHECK (ai_provider IN ('sightengine','openai','manual')),
  ai_score        NUMERIC(5,4),
  ai_categories   JSONB,
  status          TEXT NOT NULL DEFAULT 'in_review'
                    CHECK (status IN ('in_review','approved','rejected')),
  action_notes    TEXT,
  reviewed_by     UUID REFERENCES public.users(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_moderation_status   ON public.moderation_flags(status, created_at DESC);
CREATE INDEX idx_moderation_ref      ON public.moderation_flags(ref_type, ref_id);
CREATE INDEX idx_moderation_owner    ON public.moderation_flags(owner_user_id);


-- ============================================================================
-- REFERRALS & PLATFORM SETTINGS
-- ============================================================================
CREATE TABLE public.referrals (
  id                UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  referrer_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referred_user_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  referral_code     TEXT NOT NULL UNIQUE,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','signed_up','rewarded','expired')),
  reward_type       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_referrals_code ON public.referrals(referral_code);

CREATE TABLE public.platform_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  description TEXT,
  updated_by  UUID REFERENCES public.users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default platform settings
INSERT INTO public.platform_settings (key, value, description) VALUES
  ('moderation.image_auto_reject_threshold', '0.85'::jsonb,
   'Sightengine score above which images are auto-rejected'),
  ('moderation.image_review_threshold',      '0.45'::jsonb,
   'Sightengine score above which images are queued for human review'),
  ('discovery.default_radius_km',            '5'::jsonb,
   'Default seeker explore radius'),
  ('discovery.max_radius_km',                '50'::jsonb,
   'Maximum allowed explore radius'),
  ('sponsored.slots_per_region',             '3'::jsonb,
   'Number of sponsored slots shown per nearby query');

COMMIT;

-- ============================================================================
-- Post-baseline checklist:
--   [ ] SELECT count(*) FROM pg_tables WHERE schemaname='public';   -- expect ~30
--   [ ] SELECT extname FROM pg_extension WHERE extname='postgis';    -- exists
--   [ ] SELECT key FROM public.platform_settings;                    -- 5 rows
--   [ ] Run 002_rls_v2.sql next
-- ============================================================================
