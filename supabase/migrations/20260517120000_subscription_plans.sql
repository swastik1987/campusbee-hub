-- 20260517120000_subscription_plans.sql
-- Premium subscription pricing + payment-detail configuration.
--
-- Tables:
--   subscription_plans         — one row per billing_period ('monthly','annual')
--                                Admin-configurable mrp / price / is_active.
--   platform_payment_details   — single-row singleton with UPI + bank details.
--
-- Also extends provider_subscription_requests with billing_period + amount_paid,
-- updates request_premium_upgrade & approve_subscription_request RPCs to
-- carry the new fields and compute subscription_valid_until from the chosen
-- billing period.
--
-- Re-runnable. Apply manually in the Supabase SQL editor.

-- ── 1. subscription_plans table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_period  TEXT         NOT NULL UNIQUE
                                CHECK (billing_period IN ('monthly','annual')),
  mrp             NUMERIC(10,2) NOT NULL DEFAULT 0,
  price           NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency        TEXT         NOT NULL DEFAULT 'INR',
  duration_days   INTEGER      NOT NULL,
  is_active       BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_by      UUID         REFERENCES public.users(id)
);

-- Seed disabled rows so the admin only has to fill in pricing.
INSERT INTO public.subscription_plans (billing_period, mrp, price, duration_days, is_active)
VALUES
  ('monthly', 0, 0, 30,  FALSE),
  ('annual',  0, 0, 365, FALSE)
ON CONFLICT (billing_period) DO NOTHING;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sub_plans_public_select  ON public.subscription_plans;
DROP POLICY IF EXISTS sub_plans_admin_modify   ON public.subscription_plans;

-- Any authenticated user can read ACTIVE plans (instructor upgrade sheet).
-- Admins can read everything (including inactive rows).
CREATE POLICY sub_plans_public_select ON public.subscription_plans
  FOR SELECT TO anon, authenticated
  USING (is_active = TRUE OR public.is_platform_admin());

CREATE POLICY sub_plans_admin_modify ON public.subscription_plans
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

GRANT SELECT ON public.subscription_plans TO anon, authenticated;
GRANT UPDATE ON public.subscription_plans TO authenticated;

-- ── 2. platform_payment_details (singleton) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.platform_payment_details (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Enforces singleton via a CHECK on a fixed flag — only one row can have
  -- singleton=TRUE thanks to the unique index below.
  singleton       BOOLEAN      NOT NULL DEFAULT TRUE,
  upi_id          TEXT,
  upi_qr_url      TEXT,
  bank_account    TEXT,
  ifsc            TEXT,
  bank_name       TEXT,
  account_holder  TEXT,
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_by      UUID         REFERENCES public.users(id),
  CONSTRAINT platform_payment_details_singleton CHECK (singleton = TRUE)
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_payment_details_singleton_idx
  ON public.platform_payment_details (singleton);

-- Seed empty row so admin can UPDATE without worrying about INSERT.
INSERT INTO public.platform_payment_details (singleton) VALUES (TRUE)
ON CONFLICT DO NOTHING;

ALTER TABLE public.platform_payment_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pay_details_public_select ON public.platform_payment_details;
DROP POLICY IF EXISTS pay_details_admin_modify  ON public.platform_payment_details;

-- Readable by any authenticated user so the upgrade sheet can show the UPI / bank.
CREATE POLICY pay_details_public_select ON public.platform_payment_details
  FOR SELECT TO anon, authenticated USING (TRUE);

CREATE POLICY pay_details_admin_modify ON public.platform_payment_details
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

GRANT SELECT ON public.platform_payment_details TO anon, authenticated;
GRANT UPDATE ON public.platform_payment_details TO authenticated;

-- ── 3. Extend provider_subscription_requests ────────────────────────────────

ALTER TABLE public.provider_subscription_requests
  ADD COLUMN IF NOT EXISTS billing_period TEXT
    CHECK (billing_period IN ('monthly','annual')),
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2);

-- ── 4. Updated RPC: request_premium_upgrade ─────────────────────────────────
-- Now requires billing_period + amount_paid (matching the active plan).
-- Validates that the chosen plan is active and amount matches the configured
-- selling price (small grace amount allowed for rounding, e.g. 0.5 INR).

CREATE OR REPLACE FUNCTION public.request_premium_upgrade(
  p_provider_id         UUID,
  p_notes               TEXT DEFAULT NULL,
  p_off_app_payment_ref TEXT DEFAULT NULL,
  p_billing_period      TEXT DEFAULT NULL,
  p_amount_paid         NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_request_id      UUID;
  v_admin           RECORD;
  v_provider_name   TEXT;
  v_plan            public.subscription_plans;
BEGIN
  IF NOT public.is_provider_owner(p_provider_id) THEN
    RAISE EXCEPTION 'forbidden: not the owner of this provider';
  END IF;

  IF public.is_premium(p_provider_id) THEN
    RAISE EXCEPTION 'already on premium tier';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.provider_subscription_requests
    WHERE provider_id = p_provider_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'a pending request already exists';
  END IF;

  -- Billing period is now required.
  IF p_billing_period IS NULL OR p_billing_period NOT IN ('monthly','annual') THEN
    RAISE EXCEPTION 'billing_period is required (monthly or annual)';
  END IF;

  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE billing_period = p_billing_period AND is_active = TRUE;

  IF v_plan.id IS NULL THEN
    RAISE EXCEPTION 'subscription plan % is not currently available', p_billing_period;
  END IF;

  -- Allow tiny rounding tolerance (±1 INR) between the plan price and what
  -- the provider claims to have paid.
  IF p_amount_paid IS NULL OR ABS(p_amount_paid - v_plan.price) > 1 THEN
    RAISE EXCEPTION 'amount_paid (%) does not match the % plan price (%)',
      COALESCE(p_amount_paid::text, 'null'), p_billing_period, v_plan.price;
  END IF;

  INSERT INTO public.provider_subscription_requests
    (provider_id, requested_tier, status, notes, off_app_payment_ref,
     billing_period, amount_paid)
  VALUES
    (p_provider_id, 'premium', 'pending', p_notes, p_off_app_payment_ref,
     p_billing_period, p_amount_paid)
  RETURNING id INTO v_request_id;

  SELECT business_name INTO v_provider_name
  FROM   public.service_providers WHERE id = p_provider_id;

  FOR v_admin IN SELECT id FROM public.users WHERE is_platform_admin = TRUE LOOP
    PERFORM public.send_notification(
      v_admin.id,
      'New Premium Upgrade Request',
      coalesce(v_provider_name, 'A provider') || ' has paid for the ' ||
        p_billing_period || ' Premium plan (₹' || p_amount_paid::text || ').',
      'subscription_request_submitted',
      'provider_subscription_request',
      v_request_id
    );
  END LOOP;

  RETURN v_request_id;
END;
$$;

-- Keep both the new 5-arg and legacy 3-arg signatures coexisting? Drop the
-- 3-arg version since callers will be updated. Use REVOKE then drop.
DROP FUNCTION IF EXISTS public.request_premium_upgrade(UUID, TEXT, TEXT);

GRANT EXECUTE ON FUNCTION public.request_premium_upgrade(UUID, TEXT, TEXT, TEXT, NUMERIC)
  TO authenticated;

-- ── 5. Updated RPC: approve_subscription_request ────────────────────────────
-- If p_valid_until is NULL, compute it from the request's billing_period
-- (monthly → +30 days, annual → +365 days). Backward-compatible: if admin
-- still passes a specific date, that wins.

CREATE OR REPLACE FUNCTION public.approve_subscription_request(
  p_request_id  UUID,
  p_valid_until TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_user_id     UUID;
  v_provider_id       UUID;
  v_provider_user_id  UUID;
  v_billing_period    TEXT;
  v_valid_until       TIMESTAMPTZ;
  v_duration_days     INTEGER;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden: platform admin only';
  END IF;

  v_admin_user_id := public.current_user_id();

  SELECT provider_id, billing_period INTO v_provider_id, v_billing_period
  FROM   public.provider_subscription_requests
  WHERE  id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'request not found or not pending';
  END IF;

  -- Pick valid_until: explicit arg wins; else derive from billing_period.
  IF p_valid_until IS NOT NULL THEN
    v_valid_until := p_valid_until;
  ELSIF v_billing_period IS NOT NULL THEN
    SELECT duration_days INTO v_duration_days
    FROM   public.subscription_plans
    WHERE  billing_period = v_billing_period;
    v_valid_until := NOW() + make_interval(days => COALESCE(v_duration_days, 30));
  ELSE
    -- Legacy request with no billing_period AND no explicit date → fall back to 30 days.
    v_valid_until := NOW() + INTERVAL '30 days';
  END IF;

  UPDATE public.provider_subscription_requests
  SET    status        = 'approved',
         granted_until = v_valid_until,
         reviewed_by   = v_admin_user_id,
         reviewed_at   = NOW()
  WHERE  id = p_request_id;

  UPDATE public.service_providers
  SET    subscription_tier        = 'premium',
         subscription_valid_until = v_valid_until,
         updated_at               = NOW()
  WHERE  id = v_provider_id;

  SELECT user_id INTO v_provider_user_id
  FROM   public.service_providers WHERE id = v_provider_id;

  PERFORM public.send_notification(
    v_provider_user_id,
    'Premium Activated',
    'Your Premium upgrade has been approved. Premium features are now unlocked until '
      || to_char(v_valid_until, 'DD Mon YYYY') || '.',
    'subscription_approved',
    'provider_subscription_request',
    p_request_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_subscription_request(UUID, TIMESTAMPTZ)
  TO authenticated;

-- ── 6. updated_at trigger reuse ─────────────────────────────────────────────
-- (Reuses public.touch_updated_at from the coaches migration.)

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'touch_updated_at'
             AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS subscription_plans_touch_updated_at ON public.subscription_plans';
    EXECUTE 'CREATE TRIGGER subscription_plans_touch_updated_at
             BEFORE UPDATE ON public.subscription_plans
             FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()';

    EXECUTE 'DROP TRIGGER IF EXISTS platform_payment_details_touch_updated_at ON public.platform_payment_details';
    EXECUTE 'CREATE TRIGGER platform_payment_details_touch_updated_at
             BEFORE UPDATE ON public.platform_payment_details
             FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()';
  END IF;
END $$;
