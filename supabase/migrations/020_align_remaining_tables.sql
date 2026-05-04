-- Migration 020: Align remaining tables with app code (v2 schema completion)
-- Fixes all remaining column mismatches across payments, enrollments, reviews,
-- demo_sessions, family_members, trainers, class_materials, announcements,
-- and chat_conversations.

-- ── PAYMENTS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS paid_at               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_method        TEXT,
  ADD COLUMN IF NOT EXISTS upi_transaction_id    TEXT,
  ADD COLUMN IF NOT EXISTS receipt_url           TEXT,
  ADD COLUMN IF NOT EXISTS payment_period_start  DATE,
  ADD COLUMN IF NOT EXISTS payment_period_end    DATE,
  ADD COLUMN IF NOT EXISTS due_date              DATE,
  ADD COLUMN IF NOT EXISTS confirmed_by          UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS confirmed_at          TIMESTAMPTZ;

-- ── ENROLLMENTS ───────────────────────────────────────────────────────────────
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS approved_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS drop_reason  TEXT;

-- ── REVIEWS ───────────────────────────────────────────────────────────────────
-- Rename comment → review_text (app code uses review_text everywhere)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='reviews' AND column_name='comment')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name='reviews' AND column_name='review_text')
  THEN ALTER TABLE public.reviews RENAME COLUMN comment TO review_text;
  END IF;
END $$;
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS review_text   TEXT,
  ADD COLUMN IF NOT EXISTS is_verified   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_visible    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enrollment_id UUID REFERENCES public.enrollments(id) ON DELETE SET NULL;

-- ── DEMO_SESSIONS ─────────────────────────────────────────────────────────────
-- Rename max_capacity → max_participants (app uses max_participants)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='demo_sessions' AND column_name='max_capacity')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name='demo_sessions' AND column_name='max_participants')
  THEN ALTER TABLE public.demo_sessions RENAME COLUMN max_capacity TO max_participants;
  END IF;
END $$;
ALTER TABLE public.demo_sessions
  ADD COLUMN IF NOT EXISTS current_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee           NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status        TEXT NOT NULL DEFAULT 'upcoming'
                             CHECK (status IN ('upcoming','completed','cancelled'));

-- ── FAMILY_MEMBERS ────────────────────────────────────────────────────────────
ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- ── TRAINERS ─────────────────────────────────────────────────────────────────
-- Rename avatar_url → photo_url (app uses photo_url throughout)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='trainers' AND column_name='avatar_url')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name='trainers' AND column_name='photo_url')
  THEN ALTER TABLE public.trainers RENAME COLUMN avatar_url TO photo_url;
  END IF;
END $$;
ALTER TABLE public.trainers
  ADD COLUMN IF NOT EXISTS qualifications   TEXT,
  ADD COLUMN IF NOT EXISTS experience_years INTEGER,
  ADD COLUMN IF NOT EXISTS specializations  TEXT[];

-- ── CLASS_MATERIALS ───────────────────────────────────────────────────────────
-- Rename type → material_type (app uses material_type)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='class_materials' AND column_name='type')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name='class_materials' AND column_name='material_type')
  THEN ALTER TABLE public.class_materials RENAME COLUMN "type" TO material_type;
  END IF;
END $$;
ALTER TABLE public.class_materials
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- ── ANNOUNCEMENTS ────────────────────────────────────────────────────────────
-- Rename type → announcement_type (app uses announcement_type)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='announcements' AND column_name='type')
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name='announcements' AND column_name='announcement_type')
  THEN ALTER TABLE public.announcements RENAME COLUMN "type" TO announcement_type;
  END IF;
END $$;
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS author_id       UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS target_audience TEXT DEFAULT 'all';

-- ── CHAT_CONVERSATIONS ───────────────────────────────────────────────────────
-- Add pair columns alongside the participant_ids array (MVP chat compat)
ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS participant_1        UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS participant_2        UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS last_message_preview TEXT;
