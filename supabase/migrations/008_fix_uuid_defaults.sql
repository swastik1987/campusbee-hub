-- ============================================================================
-- 008_fix_uuid_defaults.sql  —  switch all id DEFAULTs to gen_random_uuid()
-- ============================================================================
-- 001_baseline_v2 used `extensions.uuid_generate_v4()`, which only resolves
-- if the uuid-ossp extension is installed in the `extensions` schema. On a
-- fresh Supabase project the extension may live elsewhere (or not be
-- installed at all), so every INSERT errored with
--   "function extensions.uuid_generate_v4() does not exist".
--
-- gen_random_uuid() is built into PostgreSQL 13+ — no extension required.
-- Switch every `id` column default to it.
-- ============================================================================

BEGIN;

ALTER TABLE public.users                           ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.families                        ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.family_members                  ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.family_links                    ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.family_invites                  ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.service_providers               ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.trainers                        ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.provider_subscription_requests  ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.class_categories                ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.classes                         ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.batches                         ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.batch_schedules                 ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.class_addons                    ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.demo_sessions                   ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.demo_registrations              ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.enrollments                     ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.waitlist_entries                ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.attendance_records              ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.payments                        ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.reviews                         ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.announcements                   ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.chat_conversations              ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.chat_messages                   ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.notifications                   ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.class_materials                 ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.sponsored_listings              ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.featured_banners                ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.moderation_flags                ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.referrals                       ALTER COLUMN id SET DEFAULT gen_random_uuid();

COMMIT;

-- ============================================================================
-- Verify:
--   INSERT INTO public.users (auth_id, email, full_name)
--   VALUES (NULL, 'sanity@test.com', 'Sanity Test') RETURNING id;
--   -- Should return a UUID. Then DELETE the test row.
-- ============================================================================
