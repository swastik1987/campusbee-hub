-- ──────────────────────────────────────────────────────────────────────────
-- 20260514120000_chat_mark_read.sql
-- Adds a SECURITY DEFINER RPC for the receiver to mark all unread messages
-- in a conversation as read, plus a composite index for the unread-count
-- query path. RLS on chat_messages keeps `chat_msg_self_update` (sender-only)
-- intact — the RPC bypasses RLS but checks conversation participation first.
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := public.current_user_id();
  v_updated integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Only allow if the caller is a participant in this conversation
  IF NOT EXISTS (
    SELECT 1
    FROM public.chat_conversations cc
    WHERE cc.id = p_conversation_id
      AND (cc.participant_1 = v_user_id OR cc.participant_2 = v_user_id)
  ) THEN
    RAISE EXCEPTION 'not a participant';
  END IF;

  WITH upd AS (
    UPDATE public.chat_messages
    SET is_read = true
    WHERE conversation_id = p_conversation_id
      AND sender_id <> v_user_id
      AND is_read = false
    RETURNING 1
  )
  SELECT count(*)::int INTO v_updated FROM upd;

  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;

-- Index that backs both the global unread count and the per-conversation
-- unread badge queries (filter on conversation_id + is_read=false + sender_id<>me).
CREATE INDEX IF NOT EXISTS chat_messages_unread_idx
  ON public.chat_messages (conversation_id, is_read, sender_id)
  WHERE is_read = false;
