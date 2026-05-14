-- ──────────────────────────────────────────────────────────────────────────
-- 20260514140000_explore_indexes.sql
-- Indexes that back the seeker Explore page query path. The radius filter
-- already rides on the GIST index on classes.location (added by 001_baseline_v2
-- / 010_add_seeker_location_columns). These add coverage for the post-RPC
-- hydrate query (classes.in(id list).order(created_at)) and the heavy
-- batches join used by ClassCard rendering.
-- All partial / composite — kept tight to avoid bloating writes.
-- ──────────────────────────────────────────────────────────────────────────

-- Listing scan: status='published' AND moderation_status='approved' ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS classes_published_listing_idx
  ON public.classes (created_at DESC)
  WHERE status = 'published' AND moderation_status = 'approved';

-- Category-scoped listing
CREATE INDEX IF NOT EXISTS classes_category_published_idx
  ON public.classes (category_id, created_at DESC)
  WHERE status = 'published' AND moderation_status = 'approved';

-- Sort-by-rating
CREATE INDEX IF NOT EXISTS classes_rating_published_idx
  ON public.classes (total_rating DESC NULLS LAST, rating_count DESC NULLS LAST)
  WHERE status = 'published' AND moderation_status = 'approved';

-- Batches lookup by class (joined on every Explore row)
CREATE INDEX IF NOT EXISTS batches_class_status_idx
  ON public.batches (class_id, status);

-- Pending category requests by provider (dashboard counter)
CREATE INDEX IF NOT EXISTS category_requests_pending_by_provider_idx
  ON public.category_requests (provider_id)
  WHERE status = 'pending';
