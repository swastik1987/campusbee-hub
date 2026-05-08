-- 026_ensure_self_family_member.sql
-- Idempotent "find-or-create" for the primary user's own family_member row
-- (relationship = 'self').  Called from onboarding (StepLocation) and lazily
-- from EnrollFlow so seekers can always enroll themselves.
--
-- IMPORTANT: family_links.user_id and families.primary_user_id store the
-- internal public.users.id, NOT auth.uid() (the Supabase auth UID).
-- We must resolve the internal ID first before doing any auth checks —
-- the same pattern used by create_own_family() in migration 012.

CREATE OR REPLACE FUNCTION public.ensure_self_family_member(
  p_family_id UUID,
  p_full_name  TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id UUID;
  v_id        UUID;
BEGIN
  -- 1. Resolve caller's internal user row (auth.uid() = Supabase auth UID,
  --    public.users.id = internal UUID — they are different).
  SELECT id INTO v_caller_id
  FROM   public.users
  WHERE  auth_id = auth.uid()
  LIMIT  1;

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'User not found for auth.uid() = %', auth.uid();
  END IF;

  -- 2. Authorisation: caller must be linked to this family OR be its primary owner.
  IF NOT EXISTS (
    SELECT 1 FROM family_links
    WHERE  family_id = p_family_id
      AND  user_id   = v_caller_id
  ) AND NOT EXISTS (
    SELECT 1 FROM families
    WHERE  id              = p_family_id
      AND  primary_user_id = v_caller_id
  ) THEN
    RAISE EXCEPTION 'Not authorised for family %', p_family_id;
  END IF;

  -- 3. Return existing active self member if one already exists (idempotent).
  SELECT id INTO v_id
  FROM   family_members
  WHERE  family_id    = p_family_id
    AND  relationship = 'self'
    AND  is_active    = TRUE
  LIMIT  1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  -- 4. Create the self member.
  INSERT INTO family_members (family_id, full_name, relationship, is_active)
  VALUES (p_family_id, p_full_name, 'self', TRUE)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_self_family_member(UUID, TEXT) TO authenticated;
