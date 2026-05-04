-- ============================================================
-- CampusBee — 016_categories_rls_and_seed.sql
--
-- Two problems fixed here:
--   1. class_categories has RLS enabled but no public SELECT
--      policy → queries return nothing for authenticated users.
--   2. The icon column values don't match the frontend
--      CATEGORY_ICONS map (which uses Lucide component names).
--
-- This migration:
--   a. Drops any stale v1/v2 SELECT policies on class_categories
--   b. Creates a simple public SELECT policy (categories are
--      non-sensitive and must be readable by everyone)
--   c. Upserts all 10 top-level v2 categories with icon values
--      that match the frontend CATEGORY_ICONS map
--      (idempotent via ON CONFLICT (slug) DO UPDATE)
--
-- NOTE: Live DB uses v2 column names:
--   icon        (NOT icon_name)
--   parent_id   (NOT parent_category_id)
--   sort_order  (NOT display_order)
--
-- Run in: supabase.com/dashboard/project/.../editor
-- Safe to re-run.
-- ============================================================

-- ── 1. Open SELECT for class_categories ──────────────────────────────────────

-- Drop any previously named policies (both v1 and v2 names)
DROP POLICY IF EXISTS categories_public_select     ON public.class_categories;
DROP POLICY IF EXISTS cat_public_read              ON public.class_categories;
DROP POLICY IF EXISTS class_categories_select      ON public.class_categories;
DROP POLICY IF EXISTS categories_select_all        ON public.class_categories;

-- Allow anyone (anon + authenticated) to read active categories
CREATE POLICY categories_public_select ON public.class_categories
  FOR SELECT
  USING (is_active = true OR is_active IS NULL);

-- ── 2. Upsert top-level categories with correct icon values ──────────────────
-- icon values must match the CATEGORY_ICONS map in the frontend:
-- { Trophy, Music, Guitar, Palette, GraduationCap, Dumbbell, Leaf, Code, Globe, Sparkles }

INSERT INTO public.class_categories (name, slug, icon, sort_order, is_active)
VALUES
  ('Sports',          'sports',        'Trophy',        10,  true),
  ('Dance',           'dance',         'Music',         20,  true),
  ('Music',           'music',         'Guitar',        30,  true),
  ('Arts & Craft',    'arts-craft',    'Palette',       40,  true),
  ('Academics',       'academics',     'GraduationCap', 50,  true),
  ('Fitness',         'fitness',       'Dumbbell',      60,  true),
  ('Wellness',        'wellness',      'Leaf',          70,  true),
  ('Tech & Coding',   'tech-coding',   'Code',          80,  true),
  ('Languages',       'languages',     'Globe',         90,  true),
  ('Hobbies',         'hobbies',       'Sparkles',     100,  true)
ON CONFLICT (slug) DO UPDATE
  SET is_active  = EXCLUDED.is_active,
      sort_order = EXCLUDED.sort_order,
      icon       = EXCLUDED.icon;

-- ── 3. Make sure anon + authenticated can also SELECT via GRANT ───────────────
GRANT SELECT ON public.class_categories TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
