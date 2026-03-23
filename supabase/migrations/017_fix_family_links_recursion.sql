-- ============================================================
-- FIX: Infinite recursion on family_links table
--
-- "Linked users see co-member links" and "Primary can unlink members"
-- both query family_links FROM WITHIN family_links policies → recursion.
-- Replace with SECURITY DEFINER RPC functions.
-- ============================================================

-- Drop recursive policies
DROP POLICY IF EXISTS "Linked users see co-member links" ON family_links;
DROP POLICY IF EXISTS "Primary can unlink members" ON family_links;

-- RPC: Get co-member links for a family (replaces the co-member SELECT policy)
CREATE OR REPLACE FUNCTION get_family_co_links(for_family_id uuid)
RETURNS TABLE (
  id uuid,
  family_id uuid,
  user_id uuid,
  role text,
  status text,
  linked_at timestamptz,
  linked_via text
) AS $$
BEGIN
  -- Verify caller is linked to this family
  IF NOT EXISTS (
    SELECT 1 FROM public.family_links fl
    WHERE fl.family_id = for_family_id
      AND fl.user_id = get_user_id()
      AND fl.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT fl.id, fl.family_id, fl.user_id, fl.role::text, fl.status::text, fl.linked_at, fl.linked_via::text
  FROM public.family_links fl
  WHERE fl.family_id = for_family_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- RPC: Primary user can unlink a family member
CREATE OR REPLACE FUNCTION unlink_family_member(link_id uuid)
RETURNS void AS $$
DECLARE
  target_link RECORD;
BEGIN
  SELECT * INTO target_link FROM public.family_links WHERE id = link_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link not found';
  END IF;

  -- Verify caller is primary of that family
  IF NOT EXISTS (
    SELECT 1 FROM public.family_links fl
    WHERE fl.family_id = target_link.family_id
      AND fl.user_id = get_user_id()
      AND fl.role = 'primary'
      AND fl.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.family_links
  SET status = 'unlinked', unlinked_at = now(), unlinked_by = get_user_id()
  WHERE id = link_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Transfer primary role to another linked member
CREATE OR REPLACE FUNCTION transfer_family_primary(
  current_primary_link_id uuid,
  new_primary_link_id uuid
)
RETURNS void AS $$
DECLARE
  current_link RECORD;
  new_link RECORD;
BEGIN
  SELECT * INTO current_link FROM public.family_links WHERE id = current_primary_link_id;
  SELECT * INTO new_link FROM public.family_links WHERE id = new_primary_link_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link not found';
  END IF;

  -- Verify caller is the current primary
  IF current_link.user_id != get_user_id() OR current_link.role != 'primary' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Verify both links are in the same family
  IF current_link.family_id != new_link.family_id THEN
    RAISE EXCEPTION 'Links are not in the same family';
  END IF;

  -- Demote current primary
  UPDATE public.family_links SET role = 'member' WHERE id = current_primary_link_id;
  -- Promote new primary
  UPDATE public.family_links SET role = 'primary' WHERE id = new_primary_link_id;
  -- Update the families table too
  UPDATE public.families SET primary_user_id = new_link.user_id WHERE id = current_link.family_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_family_co_links(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION unlink_family_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_family_primary(uuid, uuid) TO authenticated;
