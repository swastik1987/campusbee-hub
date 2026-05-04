-- Migration 019: Align classes / batches / class_addons with app code
-- Fixes 400 errors on POST /classes and POST /batches

-- ── CLASSES ──────────────────────────────────────────────────────────

-- Add columns missing from v2 baseline
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS short_description TEXT,
  ADD COLUMN IF NOT EXISTS cover_image_url   TEXT,
  ADD COLUMN IF NOT EXISTS gallery_urls      TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS promo_video_url   TEXT,
  ADD COLUMN IF NOT EXISTS class_type        TEXT NOT NULL DEFAULT 'recurring'
                             CHECK (class_type IN ('recurring','fixed_duration','one_time')),
  ADD COLUMN IF NOT EXISTS venue_details     TEXT,
  ADD COLUMN IF NOT EXISTS what_to_bring     TEXT;

-- Rename age_min → age_group_min, age_max → age_group_max
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='classes' AND column_name='age_min') THEN
    ALTER TABLE public.classes RENAME COLUMN age_min TO age_group_min;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='classes' AND column_name='age_max') THEN
    ALTER TABLE public.classes RENAME COLUMN age_max TO age_group_max;
  END IF;
END $$;

-- skill_level: change TEXT → TEXT[] (code passes an array of levels)
DO $$ DECLARE cname TEXT; BEGIN
  SELECT conname INTO cname FROM pg_constraint
  WHERE conrelid = 'public.classes'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%skill_level%';
  IF cname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.classes DROP CONSTRAINT ' || quote_ident(cname);
  END IF;
END $$;

ALTER TABLE public.classes
  ALTER COLUMN skill_level TYPE TEXT[]
  USING CASE WHEN skill_level IS NULL THEN NULL ELSE ARRAY[skill_level] END;

-- ── BATCHES ───────────────────────────────────────────────────────────

-- Add missing columns
ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS batch_type        TEXT DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS age_group_min     INTEGER,
  ADD COLUMN IF NOT EXISTS age_group_max     INTEGER,
  ADD COLUMN IF NOT EXISTS registration_mode TEXT NOT NULL DEFAULT 'auto'
                             CHECK (registration_mode IN ('auto','manual')),
  ADD COLUMN IF NOT EXISTS registration_fee  NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Rename name → batch_name, max_capacity → max_batch_size
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='batches' AND column_name='name') THEN
    ALTER TABLE public.batches RENAME COLUMN name TO batch_name;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='batches' AND column_name='max_capacity') THEN
    ALTER TABLE public.batches RENAME COLUMN max_capacity TO max_batch_size;
  END IF;
END $$;

-- Add 'for_duration' to fee_frequency CHECK constraint
DO $$ DECLARE cname TEXT; BEGIN
  SELECT conname INTO cname FROM pg_constraint
  WHERE conrelid = 'public.batches'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%fee_frequency%';
  IF cname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.batches DROP CONSTRAINT ' || quote_ident(cname);
  END IF;
END $$;

ALTER TABLE public.batches
  ADD CONSTRAINT batches_fee_frequency_check
  CHECK (fee_frequency IN ('one_time','monthly','quarterly','yearly','per_session','for_duration'));

-- ── BATCH_SCHEDULES ───────────────────────────────────────────────────

-- Add is_active (code filters on it; default true so existing rows stay visible)
ALTER TABLE public.batch_schedules
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- ── CLASS_ADDONS ──────────────────────────────────────────────────────

-- Add missing columns
ALTER TABLE public.class_addons
  ADD COLUMN IF NOT EXISTS fee_type     TEXT DEFAULT 'one_time',
  ADD COLUMN IF NOT EXISTS is_mandatory BOOLEAN NOT NULL DEFAULT false;

-- Rename fee → fee_amount
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='class_addons' AND column_name='fee') THEN
    ALTER TABLE public.class_addons RENAME COLUMN fee TO fee_amount;
  END IF;
END $$;
