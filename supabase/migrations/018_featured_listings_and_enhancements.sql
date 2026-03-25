-- ============================================================
-- FEATURED CLASS LISTINGS, PROVIDER CATEGORY IDS, REGISTRATION FEE
-- ============================================================

-- ========== 1. Add specialization_category_ids to service_providers ==========

ALTER TABLE service_providers
  ADD COLUMN IF NOT EXISTS specialization_category_ids UUID[] DEFAULT '{}';

-- ========== 2. Add registration_fee to batches ==========

ALTER TABLE batches
  ADD COLUMN IF NOT EXISTS registration_fee DECIMAL(10,2) DEFAULT 0;

-- ========== 3. Featured Class Listings table ==========

CREATE TABLE IF NOT EXISTS featured_class_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id) NOT NULL,
  apartment_id UUID REFERENCES apartment_complexes(id) NOT NULL,
  provider_registration_id UUID REFERENCES provider_apartment_registrations(id) NOT NULL,
  banner_image_url TEXT NOT NULL,
  -- Provider request
  requested_at TIMESTAMPTZ DEFAULT now(),
  requested_by UUID REFERENCES users(id) NOT NULL,
  -- Admin response
  ad_fee DECIMAL(10,2),
  valid_from DATE,
  valid_until DATE,
  admin_notes TEXT,
  responded_by UUID REFERENCES users(id),
  responded_at TIMESTAMPTZ,
  -- Provider acceptance
  fee_status VARCHAR(20) DEFAULT 'pending'
    CHECK (fee_status IN ('pending', 'fee_proposed', 'accepted', 'rejected')),
  fee_accepted_at TIMESTAMPTZ,
  -- Overall status
  status VARCHAR(20) DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval', 'fee_proposed', 'active', 'expired', 'cancelled', 'rejected')),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_featured_listings_apartment
  ON featured_class_listings(apartment_id, status);
CREATE INDEX IF NOT EXISTS idx_featured_listings_class
  ON featured_class_listings(class_id);

-- ========== 4. RLS for featured_class_listings ==========

ALTER TABLE featured_class_listings ENABLE ROW LEVEL SECURITY;

-- Provider manages own featured requests
CREATE POLICY "Provider manages own featured listings" ON featured_class_listings
  FOR ALL USING (
    provider_registration_id IN (
      SELECT id FROM provider_apartment_registrations
      WHERE provider_id IN (SELECT id FROM service_providers WHERE user_id = get_user_id())
    )
  );

-- Admin manages apartment featured listings
CREATE POLICY "Admin manages apartment featured listings" ON featured_class_listings
  FOR ALL USING (
    apartment_id IN (
      SELECT apartment_id FROM apartment_admins WHERE user_id = get_user_id()
    )
  );

-- Seekers see active featured listings in their apartment
CREATE POLICY "Seekers see active featured listings" ON featured_class_listings
  FOR SELECT USING (
    status = 'active'
    AND valid_from <= CURRENT_DATE
    AND valid_until >= CURRENT_DATE
  );

-- ========== 5. Reload PostgREST schema ==========
NOTIFY pgrst, 'reload schema';
