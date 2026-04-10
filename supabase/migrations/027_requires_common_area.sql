-- Migration 027: Add requires_common_area flag to classes
-- Classes that don't need common area access can be published directly
-- without admin approval or commercial terms acceptance.

ALTER TABLE classes
ADD COLUMN IF NOT EXISTS requires_common_area BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN classes.requires_common_area IS
'Whether this class uses society common areas (clubhouse, playground, pool, etc.).
If true: provider must have admin approval + accepted commercial terms before publishing.
If false: provider can publish directly (e.g. home tuitions, classes at own premises).
Existing classes default to true for backward compatibility.';

-- Allow apartment admins to update class status (suspend/reactivate home-based classes)
-- Scoped to classes in their apartment via provider_apartment_registrations
CREATE POLICY "apartment_admins_can_update_class_status" ON classes
FOR UPDATE
USING (
  provider_registration_id IN (
    SELECT par.id
    FROM provider_apartment_registrations par
    JOIN apartment_admins aa ON aa.apartment_id = par.apartment_id
    WHERE aa.user_id = get_user_id()
      AND aa.is_active = true
  )
)
WITH CHECK (
  provider_registration_id IN (
    SELECT par.id
    FROM provider_apartment_registrations par
    JOIN apartment_admins aa ON aa.apartment_id = par.apartment_id
    WHERE aa.user_id = get_user_id()
      AND aa.is_active = true
  )
);
