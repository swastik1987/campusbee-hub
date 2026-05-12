-- Fix category_requests RLS: service_providers.user_id stores public.users.id, not auth.uid()
DROP POLICY IF EXISTS cat_req_provider_insert ON public.category_requests;
DROP POLICY IF EXISTS cat_req_provider_select ON public.category_requests;
DROP POLICY IF EXISTS cat_req_provider_update ON public.category_requests;

CREATE POLICY cat_req_provider_insert ON public.category_requests
  FOR INSERT TO authenticated
  WITH CHECK (provider_id IN (
    SELECT id FROM public.service_providers WHERE user_id = public.current_user_id()
  ));

CREATE POLICY cat_req_provider_select ON public.category_requests
  FOR SELECT TO authenticated
  USING (provider_id IN (
    SELECT id FROM public.service_providers WHERE user_id = public.current_user_id()
  ));

CREATE POLICY cat_req_provider_update ON public.category_requests
  FOR UPDATE TO authenticated
  USING (provider_id IN (
    SELECT id FROM public.service_providers WHERE user_id = public.current_user_id()
  ));