-- =====================================================
-- FINAL FIX: Chat Persistence for Desktop2
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Fix the trigger function to use correct column names
CREATE OR REPLACE FUNCTION update_session_activity()
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

-- 2. Recreate the trigger
DROP TRIGGER IF EXISTS update_session_on_message ON conversation_messages;

CREATE TRIGGER update_session_on_message
  AFTER INSERT ON conversation_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_session_activity();

-- 3. Verify everything is set up correctly
SELECT 
  'Chat persistence fixed!' as status,
  (SELECT COUNT(*) FROM conversation_sessions) as total_sessions,
  (SELECT COUNT(*) FROM conversation_messages) as total_messages;

-- 4. Show the trigger is active
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'update_session_on_message';

