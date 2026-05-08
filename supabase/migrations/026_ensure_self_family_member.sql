-- 026_ensure_self_family_member.sql
-- Idempotent "find-or-create" for the primary user's own family_member row
-- (relationship = 'self').  Called from onboarding (StepLocation) and lazily
-- from EnrollFlow so seekers can always enroll themselves.

CREATE OR REPLACE FUNCTION public.ensure_self_family_member(
  p_family_id UUID,
  p_full_name  TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Authorisation: caller must be linked to this family OR be its primary owner.
  IF NOT EXISTS (
    SELECT 1 FROM family_links
    WHERE  family_id = p_family_id
      AND  user_id   = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM families
    WHERE  id              = p_family_id
      AND  primary_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorised for family %', p_family_id;
  END IF;

  -- Return existing active self member if one already exists (idempotent).
  SELECT id INTO v_id
  FROM   family_members
  WHERE  family_id    = p_family_id
    AND  relationship = 'self'
    AND  is_active    = TRUE
  LIMIT  1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  -- Create the self member.
  INSERT INTO family_members (family_id, full_name, relationship, is_active)
  VALUES (p_family_id, p_full_name, 'self', TRUE)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_self_family_member(UUID, TEXT) TO authenticated;
