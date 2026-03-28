-- ============================================================
-- Add 'inactive' status to featured_class_listings
-- Allows apartment admins to deactivate active featured listings
-- and reactivate them later (with optional end-date change).
-- ============================================================

-- 1. Widen the status CHECK constraint to include 'inactive'
ALTER TABLE featured_class_listings DROP CONSTRAINT IF EXISTS featured_class_listings_status_check;
ALTER TABLE featured_class_listings ADD CONSTRAINT featured_class_listings_status_check
  CHECK (status IN ('pending_approval', 'fee_proposed', 'active', 'expired', 'cancelled', 'rejected', 'inactive'));

-- 2. Add deactivation tracking columns
ALTER TABLE featured_class_listings
  ADD COLUMN IF NOT EXISTS deactivation_reason TEXT,
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES users(id);

-- 3. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
