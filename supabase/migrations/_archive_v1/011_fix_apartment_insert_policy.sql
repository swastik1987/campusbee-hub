-- ============================================================
-- FIX: Allow authenticated users to request new apartments
-- The apartment_complexes table had RLS enabled but no INSERT policy,
-- causing the "Request new apartment" form to fail silently.
-- ============================================================

-- Allow any authenticated user to submit a new apartment request
CREATE POLICY "Users can request new apartments"
  ON public.apartment_complexes
  FOR INSERT
  WITH CHECK (
    registered_by = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- Allow platform admins to manage all apartments (update/delete)
CREATE POLICY "Platform admin manages apartments"
  ON public.apartment_complexes
  FOR ALL
  USING (
    (SELECT COALESCE(is_platform_admin, false) FROM public.users WHERE auth_id = auth.uid())
  );

-- Allow the user who requested an apartment to update it (e.g. edit before approval)
CREATE POLICY "Users can update own pending apartments"
  ON public.apartment_complexes
  FOR UPDATE
  USING (
    status = 'pending'
    AND registered_by = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );
