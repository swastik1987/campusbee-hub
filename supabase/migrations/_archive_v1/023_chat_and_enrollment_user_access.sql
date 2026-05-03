-- ============================================================
-- Fix: Allow chat participants and providers to read user profiles
--
-- Problem 1: Chat participants can't see each other's names/avatars
-- because the users table RLS doesn't have a policy for chat partners.
--
-- Problem 2: Providers can't read the enrolled_by user's profile
-- from the enrollments table (needed for chat button on Students page).
--
-- Solution: SECURITY DEFINER functions + new SELECT policies on users.
-- ============================================================

-- Helper: get user IDs of people the current user is chatting with
CREATE OR REPLACE FUNCTION get_chat_partner_user_ids()
RETURNS SETOF UUID AS $$
  SELECT CASE
    WHEN cc.participant_1 = get_user_id() THEN cc.participant_2
    ELSE cc.participant_1
  END
  FROM chat_conversations cc
  WHERE cc.participant_1 = get_user_id() OR cc.participant_2 = get_user_id()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get user IDs of people enrolled in the current provider's batches
CREATE OR REPLACE FUNCTION get_provider_enrolled_user_ids()
RETURNS SETOF UUID AS $$
  SELECT DISTINCT e.enrolled_by
  FROM enrollments e
  JOIN batches b ON e.batch_id = b.id
  JOIN classes c ON b.class_id = c.id
  JOIN provider_apartment_registrations par ON c.provider_registration_id = par.id
  WHERE par.provider_id IN (
    SELECT id FROM service_providers WHERE user_id = get_user_id()
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Policy: chat participants can read each other's user profiles
DROP POLICY IF EXISTS "Chat participants read partner profiles" ON users;
CREATE POLICY "Chat participants read partner profiles" ON users
  FOR SELECT USING (
    id IN (SELECT get_chat_partner_user_ids())
  );

-- Policy: providers can read enrolled users' profiles
DROP POLICY IF EXISTS "Providers read enrolled user profiles" ON users;
CREATE POLICY "Providers read enrolled user profiles" ON users
  FOR SELECT USING (
    id IN (SELECT get_provider_enrolled_user_ids())
  );
