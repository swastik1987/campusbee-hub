-- Fix certifications RLS: service_providers.user_id stores public.users.id, not auth.uid()
DROP POLICY IF EXISTS providers_manage_own_certs ON public.certifications;

CREATE POLICY providers_manage_own_certs
ON public.certifications
FOR ALL
USING (
  ((owner_type = 'provider' AND provider_id IN (
    SELECT sp.id FROM public.service_providers sp WHERE sp.user_id = public.current_user_id()
  )) OR (owner_type = 'trainer' AND trainer_id IN (
    SELECT t.id FROM public.trainers t
    JOIN public.service_providers sp ON sp.id = t.provider_id
    WHERE sp.user_id = public.current_user_id()
  )))
)
WITH CHECK (
  ((owner_type = 'provider' AND provider_id IN (
    SELECT sp.id FROM public.service_providers sp WHERE sp.user_id = public.current_user_id()
  )) OR (owner_type = 'trainer' AND trainer_id IN (
    SELECT t.id FROM public.trainers t
    JOIN public.service_providers sp ON sp.id = t.provider_id
    WHERE sp.user_id = public.current_user_id()
  )))
);