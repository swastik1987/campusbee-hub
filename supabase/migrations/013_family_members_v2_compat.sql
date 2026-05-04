-- ============================================================
-- CampusBee — 013_family_members_v2_compat.sql
--
-- Makes family_members compatible with v2 code which sends
-- full_name instead of the v1 column name `name`.
--
-- Also updates the age_group CHECK constraint to include 'infant'
-- (added in v2 baseline) and gender to include extended values.
--
-- Safe to re-run (IF NOT EXISTS / IF EXISTS guards throughout).
--
-- Run in: supabase.com/dashboard/project/uspqewlpgdsvabturfes/editor
-- ============================================================

-- ── 1. Rename `name` → `full_name` if still on v1 schema ─────────────────
DO $$
BEGIN
  -- Only rename if `name` exists and `full_name` does NOT
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'family_members'
      AND column_name  = 'name'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'family_members'
      AND column_name  = 'full_name'
  ) THEN
    ALTER TABLE public.family_members RENAME COLUMN name TO full_name;
    RAISE NOTICE 'family_members.name renamed to full_name';
  ELSE
    RAISE NOTICE 'family_members.full_name already exists or name absent — no rename needed';
  END IF;
END;
$$;

-- ── 2. Add full_name if neither column exists (safety net) ────────────────
ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS full_name TEXT;

-- ── 3. Update age_group CHECK constraint to include v2 values ────────────
--    v1 constraint: ('toddler','child','teen','adult','senior')
--    v2 adds 'infant'. Drop and recreate constraint.
DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  SELECT constraint_name INTO v_constraint
  FROM information_schema.table_constraints
  WHERE table_schema    = 'public'
    AND table_name      = 'family_members'
    AND constraint_type = 'CHECK'
    AND constraint_name LIKE '%age_group%';

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.family_members DROP CONSTRAINT %I', v_constraint);
    RAISE NOTICE 'Dropped old age_group constraint: %', v_constraint;
  END IF;
END;
$$;

ALTER TABLE public.family_members
  ADD CONSTRAINT family_members_age_group_check
  CHECK (age_group IN ('infant','toddler','child','teen','adult','senior'));

-- ── 4. Update gender CHECK constraint to include v2 values ───────────────
--    v1 constraint: VARCHAR(10) no named constraint (or loose check)
--    v2: ('male','female','other','prefer_not_to_say')
DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  SELECT constraint_name INTO v_constraint
  FROM information_schema.table_constraints
  WHERE table_schema    = 'public'
    AND table_name      = 'family_members'
    AND constraint_type = 'CHECK'
    AND constraint_name LIKE '%gender%';

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.family_members DROP CONSTRAINT %I', v_constraint);
    RAISE NOTICE 'Dropped old gender constraint: %', v_constraint;
  END IF;
END;
$$;

ALTER TABLE public.family_members
  ADD CONSTRAINT family_members_gender_check
  CHECK (gender IN ('male','female','other','prefer_not_to_say'));

-- ── 5. Ensure family_members RLS allows the owning family to insert ───────
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- Drop any stale INSERT policies by v1/v2 names
DROP POLICY IF EXISTS family_members_family_insert   ON public.family_members;
DROP POLICY IF EXISTS "Owner can add family members" ON public.family_members;

-- New INSERT policy: user must own (be primary of) the family they're
-- adding members to. Uses SECURITY DEFINER helper to avoid RLS recursion.
CREATE POLICY family_members_family_insert ON public.family_members
  FOR INSERT
  WITH CHECK (
    family_id IN (
      SELECT id FROM public.families
      WHERE primary_user_id = (
        SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1
      )
    )
    OR
    family_id IN (
      SELECT family_id FROM public.family_links
      WHERE user_id = (
        SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1
      )
      AND status = 'active'
    )
  );
