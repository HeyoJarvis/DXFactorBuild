-- =====================================================
-- Fix Task Chat Persistence - Simple Version
-- Matches your actual database schema
-- =====================================================

-- Step 1: Add user_id column to conversation_messages
-- Your schema doesn't have it, but the code needs it
-- Note: conversation_sessions.user_id is VARCHAR, so we match that type
ALTER TABLE public.conversation_messages
  ADD COLUMN IF NOT EXISTS user_id character varying;

-- Step 2: Backfill user_id from the session
-- For existing messages, get user_id from their session
UPDATE conversation_messages cm
SET user_id = cs.user_id
FROM conversation_sessions cs
WHERE cm.session_id = cs.id
  AND cm.user_id IS NULL;

-- Step 3: Create index for performance
CREATE INDEX IF NOT EXISTS idx_conversation_messages_user_id
  ON conversation_messages(user_id);

-- Step 4: Fix the trigger to use last_message_at (if trigger exists)
CREATE OR REPLACE FUNCTION update_session_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversation_sessions
  SET
    last_message_at = NEW.timestamp,
    message_count = COALESCE(message_count, 0) + 1,
    updated_at = NEW.timestamp
  WHERE id = NEW.session_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_update_session_on_message ON conversation_messages;

CREATE TRIGGER trigger_update_session_on_message
  AFTER INSERT ON conversation_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_session_on_message();

-- Step 5: Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Done!
SELECT
  '✅ Chat persistence fixed!' as status,
  'Added user_id column to conversation_messages' as step_1,
  'Backfilled existing messages' as step_2,
  'Fixed trigger to update last_message_at' as step_3;
