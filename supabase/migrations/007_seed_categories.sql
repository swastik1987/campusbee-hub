-- ============================================================================
-- 007_seed_categories.sql  —  initial class category tree
-- ============================================================================
-- Apply AFTER 006_geo_helpers.sql.
-- Idempotent via slug uniqueness — re-running is safe.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Top-level categories
-- ---------------------------------------------------------------------------
INSERT INTO public.class_categories (name, slug, icon, sort_order) VALUES
  ('Sports',       'sports',       'volleyball',   10),
  ('Dance',        'dance',        'music',        20),
  ('Music',        'music',        'music-2',      30),
  ('Arts & Craft', 'arts-craft',   'palette',      40),
  ('Academics',    'academics',    'book-open',    50),
  ('Fitness',      'fitness',      'dumbbell',     60),
  ('Wellness',     'wellness',     'leaf',         70),
  ('Tech & Coding','tech-coding',  'code',         80),
  ('Languages',    'languages',    'languages',    90),
  ('Hobbies',      'hobbies',      'sparkles',    100)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Subcategories (depend on top-level slugs above)
-- ---------------------------------------------------------------------------
WITH parents AS (
  SELECT id, slug FROM public.class_categories WHERE parent_id IS NULL
)
INSERT INTO public.class_categories (name, slug, parent_id, sort_order)
SELECT v.name, v.slug, p.id, v.sort_order
FROM (VALUES
  -- Sports
  ('Cricket',        'sports-cricket',     'sports', 10),
  ('Football',       'sports-football',    'sports', 20),
  ('Badminton',      'sports-badminton',   'sports', 30),
  ('Tennis',         'sports-tennis',      'sports', 40),
  ('Swimming',       'sports-swimming',    'sports', 50),
  ('Basketball',     'sports-basketball',  'sports', 60),
  ('Skating',        'sports-skating',     'sports', 70),
  ('Karate / Martial Arts', 'sports-martial-arts', 'sports', 80),
  ('Chess',          'sports-chess',       'sports', 90),

  -- Dance
  ('Bharatnatyam',   'dance-bharatnatyam', 'dance',  10),
  ('Kathak',         'dance-kathak',       'dance',  20),
  ('Hip-Hop',        'dance-hiphop',       'dance',  30),
  ('Western',        'dance-western',      'dance',  40),
  ('Bollywood',      'dance-bollywood',    'dance',  50),
  ('Salsa',          'dance-salsa',        'dance',  60),
  ('Contemporary',   'dance-contemporary', 'dance',  70),

  -- Music
  ('Vocal (Hindustani)','music-vocal-hindustani','music', 10),
  ('Vocal (Carnatic)',  'music-vocal-carnatic',  'music', 20),
  ('Western Vocal',     'music-vocal-western',   'music', 30),
  ('Guitar',            'music-guitar',          'music', 40),
  ('Piano / Keyboard',  'music-piano',           'music', 50),
  ('Drums',             'music-drums',           'music', 60),
  ('Violin',            'music-violin',          'music', 70),
  ('Tabla',             'music-tabla',           'music', 80),
  ('Flute',             'music-flute',           'music', 90),

  -- Arts & Craft
  ('Drawing & Sketching','art-drawing',     'arts-craft', 10),
  ('Painting',           'art-painting',    'arts-craft', 20),
  ('Pottery & Clay',     'art-pottery',     'arts-craft', 30),
  ('Origami',            'art-origami',     'arts-craft', 40),
  ('Calligraphy',        'art-calligraphy', 'arts-craft', 50),
  ('Digital Art',        'art-digital',     'arts-craft', 60),

  -- Academics
  ('Math Tuition',       'acad-math',       'academics', 10),
  ('Science',            'acad-science',    'academics', 20),
  ('English',            'acad-english',    'academics', 30),
  ('Social Studies',     'acad-social',     'academics', 40),
  ('Olympiads',          'acad-olympiads',  'academics', 50),
  ('Competitive Exam Prep','acad-competitive','academics', 60),

  -- Fitness
  ('Yoga',               'fitness-yoga',    'fitness',  10),
  ('Zumba',              'fitness-zumba',   'fitness',  20),
  ('Pilates',            'fitness-pilates', 'fitness',  30),
  ('Aerobics',           'fitness-aerobics','fitness',  40),
  ('Strength Training',  'fitness-strength','fitness',  50),
  ('Cardio',             'fitness-cardio',  'fitness',  60),

  -- Wellness
  ('Meditation',         'wellness-meditation','wellness', 10),
  ('Pranayama',          'wellness-pranayama', 'wellness', 20),
  ('Therapy & Counselling','wellness-therapy', 'wellness', 30),
  ('Nutrition',          'wellness-nutrition', 'wellness', 40),

  -- Tech & Coding
  ('Coding for Kids',    'tech-coding-kids',   'tech-coding', 10),
  ('Web Development',    'tech-web',           'tech-coding', 20),
  ('App Development',    'tech-app',           'tech-coding', 30),
  ('Robotics',           'tech-robotics',      'tech-coding', 40),
  ('AI / ML',            'tech-ai-ml',         'tech-coding', 50),
  ('Game Development',   'tech-gamedev',       'tech-coding', 60),

  -- Languages
  ('Spoken English',     'lang-english',       'languages', 10),
  ('Hindi',              'lang-hindi',         'languages', 20),
  ('French',              'lang-french',       'languages', 30),
  ('Spanish',            'lang-spanish',       'languages', 40),
  ('German',             'lang-german',        'languages', 50),
  ('Japanese',           'lang-japanese',      'languages', 60),
  ('Sanskrit',           'lang-sanskrit',      'languages', 70),

  -- Hobbies
  ('Photography',        'hobby-photography',  'hobbies',   10),
  ('Cooking',            'hobby-cooking',      'hobbies',   20),
  ('Baking',             'hobby-baking',       'hobbies',   30),
  ('Gardening',          'hobby-gardening',    'hobbies',   40),
  ('Public Speaking',    'hobby-speaking',     'hobbies',   50),
  ('Storytelling',       'hobby-storytelling', 'hobbies',   60)
) AS v(name, slug, parent_slug, sort_order)
JOIN parents p ON p.slug = v.parent_slug
ON CONFLICT (slug) DO NOTHING;

COMMIT;

-- ============================================================================
-- Post-seed checklist:
--   [ ] SELECT count(*) FROM public.class_categories WHERE parent_id IS NULL;  -- 10
--   [ ] SELECT count(*) FROM public.class_categories WHERE parent_id IS NOT NULL;  -- ~60
--   [ ] All Phase 1 migrations are now applied. Phase 2 is next.
-- ============================================================================
