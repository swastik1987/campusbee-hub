-- ============================================================================
-- 004_subscription_helpers.sql  —  Premium tier helpers + workflow RPCs
-- ============================================================================
-- Apply AFTER 003_storage_buckets_v2.sql.
-- Defines is_premium() check + the request/approve/reject RPCs that drive
-- the manual Premium provisioning workflow during MVP.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- is_premium(provider_id) — true if provider has an active premium subscription
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_premium(p_provider_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.service_providers
    WHERE  id = p_provider_id
      AND  subscription_tier = 'premium'
      AND  (subscription_valid_until IS NULL OR subscription_valid_until > now())
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_premium(UUID) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- request_premium_upgrade — provider self-service request
-- ---------------------------------------------------------------------------
-- Inserts a subscription_request row. Provider must own the provider_id.
-- Notifies all platform admins.
CREATE OR REPLACE FUNCTION public.request_premium_upgrade(
  p_provider_id        UUID,
  p_notes              TEXT DEFAULT NULL,
  p_off_app_payment_ref TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_request_id UUID;
  v_admin RECORD;
  v_provider_name TEXT;
BEGIN
  -- Caller must own the provider
  IF NOT public.is_provider_owner(p_provider_id) THEN
    RAISE EXCEPTION 'forbidden: not the owner of this provider';
  END IF;

  -- Reject if already premium and not yet expired
  IF public.is_premium(p_provider_id) THEN
    RAISE EXCEPTION 'already on premium tier';
  END IF;

  -- Reject if there's already a pending request
  IF EXISTS (
    SELECT 1 FROM public.provider_subscription_requests
    WHERE provider_id = p_provider_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'a pending request already exists';
  END IF;

  INSERT INTO public.provider_subscription_requests
    (provider_id, requested_tier, status, notes, off_app_payment_ref)
  VALUES
    (p_provider_id, 'premium', 'pending', p_notes, p_off_app_payment_ref)
  RETURNING id INTO v_request_id;

  -- Look up provider name for the notification body
  SELECT business_name INTO v_provider_name
  FROM   public.service_providers
  WHERE  id = p_provider_id;

  -- Notify every platform admin
  FOR v_admin IN SELECT id FROM public.users WHERE is_platform_admin = true LOOP
    PERFORM public.send_notification(
      v_admin.id,
      'New Premium Upgrade Request',
      coalesce(v_provider_name, 'A provider') || ' has requested a Premium upgrade.',
      'subscription_request_submitted',
      'provider_subscription_request',
      v_request_id
    );
  END LOOP;

  RETURN v_request_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.request_premium_upgrade(UUID, TEXT, TEXT)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- approve_subscription_request — admin approves and grants premium
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_subscription_request(
  p_request_id   UUID,
  p_valid_until  TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_user_id UUID;
  v_provider_id   UUID;
  v_provider_user_id UUID;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden: platform admin only';
  END IF;

  v_admin_user_id := public.current_user_id();

  -- Lock & fetch the request
  SELECT provider_id INTO v_provider_id
  FROM   public.provider_subscription_requests
  WHERE  id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'request not found or not pending';
  END IF;

  -- Mark approved
  UPDATE public.provider_subscription_requests
  SET    status        = 'approved',
         granted_until = p_valid_until,
         reviewed_by   = v_admin_user_id,
         reviewed_at   = now()
  WHERE  id = p_request_id;

  -- Grant premium on the provider
  UPDATE public.service_providers
  SET    subscription_tier        = 'premium',
         subscription_valid_until = p_valid_until,
         updated_at               = now()
  WHERE  id = v_provider_id;

  -- Notify the provider
  SELECT user_id INTO v_provider_user_id
  FROM   public.service_providers WHERE id = v_provider_id;

  PERFORM public.send_notification(
    v_provider_user_id,
    'Premium Activated',
    'Your Premium upgrade has been approved. Premium features are now unlocked'
      || CASE WHEN p_valid_until IS NOT NULL
              THEN ' until ' || to_char(p_valid_until, 'DD Mon YYYY') || '.'
              ELSE '.'
         END,
    'subscription_approved',
    'provider_subscription_request',
    p_request_id
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.approve_subscription_request(UUID, TIMESTAMPTZ)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- reject_subscription_request — admin rejects with reason
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_subscription_request(
  p_request_id UUID,
  p_reason     TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin_user_id    UUID;
  v_provider_user_id UUID;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden: platform admin only';
  END IF;

  v_admin_user_id := public.current_user_id();

  UPDATE public.provider_subscription_requests
  SET    status           = 'rejected',
         rejection_reason = p_reason,
         reviewed_by      = v_admin_user_id,
         reviewed_at      = now()
  WHERE  id = p_request_id AND status = 'pending'
  RETURNING (SELECT user_id FROM public.service_providers
             WHERE id = provider_subscription_requests.provider_id)
    INTO v_provider_user_id;

  IF v_provider_user_id IS NULL THEN
    RAISE EXCEPTION 'request not found or not pending';
  END IF;

  PERFORM public.send_notification(
    v_provider_user_id,
    'Premium Request Not Approved',
    'Your Premium upgrade request was not approved. Reason: ' || COALESCE(p_reason, 'unspecified'),
    'subscription_rejected',
    'provider_subscription_request',
    p_request_id
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.reject_subscription_request(UUID, TEXT)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- expire_premium_subscriptions — cron job: downgrade expired providers
-- ---------------------------------------------------------------------------
-- Called by a daily cron edge function (or pg_cron later). Anything past
-- subscription_valid_until is rolled back to basic and a notification fires.
CREATE OR REPLACE FUNCTION public.expire_premium_subscriptions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_row   RECORD;
BEGIN
  FOR v_row IN
    SELECT id, user_id, business_name
    FROM   public.service_providers
    WHERE  subscription_tier = 'premium'
      AND  subscription_valid_until IS NOT NULL
      AND  subscription_valid_until < now()
  LOOP
    UPDATE public.service_providers
    SET    subscription_tier = 'basic',
           updated_at        = now()
    WHERE  id = v_row.id;

    PERFORM public.send_notification(
      v_row.user_id,
      'Premium Expired',
      'Your Premium subscription has expired. Renew to continue accessing Premium features.',
      'subscription_expired',
      'service_provider',
      v_row.id
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
-- Service role only; not exposed to authenticated.
GRANT EXECUTE ON FUNCTION public.expire_premium_subscriptions() TO service_role;

COMMIT;

-- ============================================================================
-- Post-subscription-helpers checklist:
--   [ ] SELECT public.is_premium('00000000-0000-0000-0000-000000000000');  -- false
--   [ ] Run 005_moderation_helpers.sql next
-- ============================================================================
