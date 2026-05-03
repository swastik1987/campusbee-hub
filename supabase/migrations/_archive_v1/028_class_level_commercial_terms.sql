-- Migration 028: Move commercial terms from provider-registration level to class level.
-- Provider registrations are now auto-approved on creation.
-- Commercial terms are now negotiated per common-area class, not per provider.

-- ─── 1. Add class-level approval + commercial terms columns ─────────────────

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS common_area_approval_status TEXT NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS common_area_rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS class_fee_type               TEXT,
  ADD COLUMN IF NOT EXISTS class_fee_amount             DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS class_revenue_share_pct      DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS class_payment_frequency      TEXT,
  ADD COLUMN IF NOT EXISTS class_commercial_notes       TEXT,
  ADD COLUMN IF NOT EXISTS class_terms_status           TEXT NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS class_terms_accepted_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS class_terms_proposed_by      UUID REFERENCES users(id);

COMMENT ON COLUMN classes.common_area_approval_status IS
  'not_required | pending_review | approved | rejected';
COMMENT ON COLUMN classes.class_terms_status IS
  'not_required | pending_acceptance | accepted | rejected';

-- ─── 2. Add pending_approval to class status (drop+recreate CHECK) ───────────

DO $$
DECLARE
  v_con TEXT;
BEGIN
  SELECT constraint_name INTO v_con
  FROM information_schema.table_constraints
  WHERE table_name = 'classes'
    AND constraint_type = 'CHECK'
    AND constraint_name ILIKE '%status%'
  LIMIT 1;

  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE classes DROP CONSTRAINT %I', v_con);
  END IF;
END $$;

ALTER TABLE classes ADD CONSTRAINT classes_status_check
  CHECK (status IN ('draft', 'pending_approval', 'published', 'paused', 'archived'));

-- ─── 3. Data migration: copy registration-level commercial terms to classes ──
-- For each class whose registration had commercial terms set, copy those terms.
-- Existing common-area published classes are treated as already approved.

UPDATE classes c
SET
  class_fee_type           = par.admin_fee_type,
  class_fee_amount         = par.admin_fee_amount,
  class_revenue_share_pct  = par.revenue_share_pct,
  class_payment_frequency  = par.payment_frequency,
  class_commercial_notes   = par.commercial_notes,
  class_terms_status       = CASE
                               WHEN par.terms_status = 'accepted' THEN 'accepted'
                               ELSE 'not_required'
                             END,
  class_terms_accepted_at  = CASE
                               WHEN par.terms_status = 'accepted' THEN par.terms_accepted_at
                               ELSE NULL
                             END,
  common_area_approval_status = CASE
                                  WHEN c.requires_common_area = TRUE
                                    AND c.status = 'published' THEN 'approved'
                                  ELSE 'not_required'
                                END
FROM provider_apartment_registrations par
WHERE c.provider_registration_id = par.id
  AND par.admin_fee_type IS NOT NULL
  AND par.admin_fee_type <> '';

-- For published common-area classes with no prior terms, still mark approved.
UPDATE classes
SET common_area_approval_status = 'approved'
WHERE requires_common_area = TRUE
  AND status = 'published'
  AND common_area_approval_status = 'not_required';

-- ─── 4. RPC: accept_class_terms ─────────────────────────────────────────────
-- Called by provider to accept or reject class-level commercial terms.
-- On accept: publishes the class. On reject: leaves class in pending_approval.

CREATE OR REPLACE FUNCTION public.accept_class_terms(
  p_class_id UUID,
  p_accept   BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_user_id UUID;
  v_provider_user_id UUID;
BEGIN
  v_caller_user_id := get_user_id();

  -- Verify the caller is the provider who owns this class
  SELECT u.id INTO v_provider_user_id
  FROM classes c
  JOIN provider_apartment_registrations par ON c.provider_registration_id = par.id
  JOIN service_providers sp ON par.provider_id = sp.id
  JOIN users u ON sp.user_id = u.id
  WHERE c.id = p_class_id;

  IF v_provider_user_id IS NULL OR v_provider_user_id <> v_caller_user_id THEN
    RAISE EXCEPTION 'Not authorized to respond to terms for this class';
  END IF;

  IF p_accept THEN
    UPDATE classes
    SET
      class_terms_status      = 'accepted',
      class_terms_accepted_at = NOW(),
      status                  = 'published',
      common_area_approval_status = 'approved'
    WHERE id = p_class_id;
  ELSE
    UPDATE classes
    SET class_terms_status = 'rejected'
    WHERE id = p_class_id;
  END IF;
END;
$$;
