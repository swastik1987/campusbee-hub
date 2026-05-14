-- ──────────────────────────────────────────────────────────────────────────
-- 20260514130000_category_requests_dismissed_at.sql
-- Lets a provider hide approved / rejected / retag-declined category
-- requests from their dashboard. Pending requests cannot be dismissed —
-- that's enforced in app code (always shown as Active) and reinforced by
-- a CHECK trigger here so a stale client can't dismiss a pending row.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.category_requests
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS category_requests_provider_active_idx
  ON public.category_requests (provider_id, status, dismissed_at);

-- Guard: a pending request must keep dismissed_at NULL.
CREATE OR REPLACE FUNCTION public.cat_req_block_dismiss_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.dismissed_at IS NOT NULL
     AND NEW.status = 'pending'
  THEN
    RAISE EXCEPTION 'cannot dismiss a pending category request';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cat_req_block_dismiss_pending_trg ON public.category_requests;
CREATE TRIGGER cat_req_block_dismiss_pending_trg
  BEFORE INSERT OR UPDATE OF dismissed_at, status
  ON public.category_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.cat_req_block_dismiss_pending();
