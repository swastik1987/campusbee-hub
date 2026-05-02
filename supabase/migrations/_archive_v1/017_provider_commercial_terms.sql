-- ============================================================
-- PROVIDER COMMERCIAL TERMS & ADMIN APARTMENT LOOKUP
-- Adds enhanced commercial arrangement fields, provider terms
-- acceptance flow, admin apartment RPC, and notification RPC.
-- ============================================================

-- ========== 1. Add commercial terms columns ==========

ALTER TABLE provider_apartment_registrations
  ADD COLUMN IF NOT EXISTS min_guaranteed_fee DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_share_pct DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_frequency VARCHAR(20) DEFAULT 'monthly'
    CHECK (payment_frequency IN ('monthly', 'quarterly')),
  ADD COLUMN IF NOT EXISTS free_trial_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commercial_notes TEXT,
  ADD COLUMN IF NOT EXISTS terms_status VARCHAR(30) DEFAULT NULL
    CHECK (terms_status IN ('pending_acceptance', 'accepted', 'rejected', 'renegotiating')),
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_version INTEGER DEFAULT 1;


-- ========== 2. Update seeker RLS to enforce terms acceptance ==========

DROP POLICY IF EXISTS "Seekers see approved registrations" ON provider_apartment_registrations;
CREATE POLICY "Seekers see approved registrations" ON provider_apartment_registrations
  FOR SELECT USING (
    status = 'approved' AND (terms_status = 'accepted' OR terms_status IS NULL)
  );


-- ========== 3. RPC: Provider accepts/rejects terms ==========

CREATE OR REPLACE FUNCTION accept_provider_terms(
  p_registration_id uuid,
  p_accept boolean
)
RETURNS void AS $$
DECLARE
  v_provider_id uuid;
  v_user_id uuid;
BEGIN
  v_user_id := get_user_id();

  -- Verify caller is the provider who owns this registration
  SELECT sp.id INTO v_provider_id
  FROM public.service_providers sp
  WHERE sp.user_id = v_user_id;

  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'Not a provider';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.provider_apartment_registrations
    WHERE id = p_registration_id
      AND provider_id = v_provider_id
      AND terms_status = 'pending_acceptance'
  ) THEN
    RAISE EXCEPTION 'Registration not found or terms not pending';
  END IF;

  IF p_accept THEN
    UPDATE public.provider_apartment_registrations
    SET terms_status = 'accepted', terms_accepted_at = now()
    WHERE id = p_registration_id;
  ELSE
    UPDATE public.provider_apartment_registrations
    SET terms_status = 'rejected'
    WHERE id = p_registration_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION accept_provider_terms(uuid, boolean) TO authenticated;


-- ========== 4. RPC: Get admin's apartment ==========

CREATE OR REPLACE FUNCTION get_admin_apartment()
RETURNS TABLE (
  id uuid,
  name text,
  city text,
  locality text,
  logo_url text
) AS $$
  SELECT ac.id, ac.name::text, ac.city::text, ac.locality::text, ac.logo_url::text
  FROM public.apartment_admins aa
  JOIN public.apartment_complexes ac ON ac.id = aa.apartment_id
  WHERE aa.user_id = get_user_id()
    AND aa.is_active = true
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_admin_apartment() TO authenticated;


-- ========== 5. RPC: Send notification to any user ==========
-- Needed because notifications RLS only allows user_id = get_user_id()
-- but admin needs to notify providers and vice versa

CREATE OR REPLACE FUNCTION send_notification(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_type text,
  p_ref_type text DEFAULT NULL,
  p_ref_id uuid DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- Only authenticated users can send notifications
  IF get_user_id() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.notifications (user_id, title, body, notification_type, reference_type, reference_id)
  VALUES (p_user_id, p_title, p_body, p_type, p_ref_type, p_ref_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION send_notification(uuid, text, text, text, text, uuid) TO authenticated;


-- ========== 6. Reload PostgREST schema ==========
NOTIFY pgrst, 'reload schema';
