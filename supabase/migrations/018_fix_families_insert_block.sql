-- ============================================================
-- FIX: FOR ALL policy on families blocks INSERT
--
-- The "Linked users manage family" FOR ALL policy's USING clause
-- gets applied as WITH CHECK on INSERT. Since no family_links row
-- exists for a brand-new family, it always returns FALSE.
-- Even though the INSERT-specific policy should OR with it,
-- splitting into separate policies ensures no interference.
-- ============================================================

-- Drop the problematic FOR ALL policy
DROP POLICY IF EXISTS "Linked users manage family" ON families;

-- Replace with specific per-operation policies
CREATE POLICY "Linked users view family" ON families
  FOR SELECT USING (
    id IN (SELECT family_id FROM family_links WHERE user_id = get_user_id() AND status = 'active')
  );

CREATE POLICY "Linked users update family" ON families
  FOR UPDATE USING (
    id IN (SELECT family_id FROM family_links WHERE user_id = get_user_id() AND status = 'active')
  );

CREATE POLICY "Linked users delete family" ON families
  FOR DELETE USING (
    id IN (SELECT family_id FROM family_links WHERE user_id = get_user_id() AND status = 'active')
  );

-- INSERT policy "Users can create own family" already exists from migration 016
-- WITH CHECK (primary_user_id = get_user_id())

-- Also drop extra policies that query users table directly (not via get_user_id)
-- These were created outside our migrations and could cause issues
DROP POLICY IF EXISTS "Platform admin reads all families" ON families;
DROP POLICY IF EXISTS "Apartment admin reads apartment families" ON families;

-- Recreate them using get_user_id() / is_platform_admin() functions
CREATE POLICY "Platform admin reads all families" ON families
  FOR SELECT USING (is_platform_admin());

CREATE POLICY "Apartment admin reads apartment families" ON families
  FOR SELECT USING (
    apartment_id IN (
      SELECT aa.apartment_id FROM apartment_admins aa
      WHERE aa.user_id = get_user_id() AND aa.is_active = true
    )
  );
