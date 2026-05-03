-- ============================================================
-- FIX: Allow creating new families during onboarding
--
-- Migration 010 changed the families policy to check family_links,
-- but on INSERT there's no family_links row yet (chicken-and-egg).
-- Add a separate INSERT policy that checks primary_user_id directly.
-- ============================================================

-- Allow users to create a family where they are the primary user
CREATE POLICY "Users can create own family"
  ON public.families
  FOR INSERT
  WITH CHECK (primary_user_id = get_user_id());

-- Allow users to add family members to families they own (for onboarding,
-- before family_links row is created)
CREATE POLICY "Owner can add family members"
  ON public.family_members
  FOR INSERT
  WITH CHECK (
    family_id IN (SELECT id FROM families WHERE primary_user_id = get_user_id())
  );
