-- ============================================================
-- Allow chat participants to read each other's family info
-- (flat_number, block_tower) for display in chat UI
--
-- Problem: The families table RLS only allows users to read
-- their own family. Chat participants can't see the other
-- person's flat/block info.
--
-- Solution: SECURITY DEFINER function that returns family info
-- for users the current user has a chat conversation with.
-- ============================================================

-- Helper: get family IDs of users the current user is chatting with
CREATE OR REPLACE FUNCTION get_chat_partner_family_ids()
RETURNS SETOF UUID AS $$
  SELECT DISTINCT f.id
  FROM families f
  JOIN users u ON u.id = f.primary_user_id
  WHERE u.id IN (
    SELECT CASE
      WHEN cc.participant_1 = get_user_id() THEN cc.participant_2
      ELSE cc.participant_1
    END
    FROM chat_conversations cc
    WHERE cc.participant_1 = get_user_id() OR cc.participant_2 = get_user_id()
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Also handle family_links-based ownership (families may not use primary_user_id)
CREATE OR REPLACE FUNCTION get_chat_partner_family_ids_v2()
RETURNS SETOF UUID AS $$
  SELECT DISTINCT f.id
  FROM families f
  WHERE f.primary_user_id IN (
    SELECT CASE
      WHEN cc.participant_1 = get_user_id() THEN cc.participant_2
      ELSE cc.participant_1
    END
    FROM chat_conversations cc
    WHERE cc.participant_1 = get_user_id() OR cc.participant_2 = get_user_id()
  )
  UNION
  SELECT DISTINCT fl.family_id
  FROM family_links fl
  WHERE fl.user_id IN (
    SELECT CASE
      WHEN cc.participant_1 = get_user_id() THEN cc.participant_2
      ELSE cc.participant_1
    END
    FROM chat_conversations cc
    WHERE cc.participant_1 = get_user_id() OR cc.participant_2 = get_user_id()
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Add RLS policy for chat participant family reads
DROP POLICY IF EXISTS "Chat participants read partner families" ON families;

CREATE POLICY "Chat participants read partner families" ON families
  FOR SELECT USING (
    id IN (SELECT get_chat_partner_family_ids_v2())
  );
