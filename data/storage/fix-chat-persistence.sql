-- =====================================================
-- Fix Task Chat Persistence Issues
-- This script fixes the database trigger and schema mismatches
-- Safe to run multiple times (idempotent)
-- =====================================================

-- Step 1: Fix the trigger function to use correct column name
-- The trigger was trying to update 'last_activity_at' which doesn't exist
-- It should update 'last_message_at' instead

CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversation_sessions
  SET
    last_message_at = NEW.timestamp,  -- ✅ Fixed: was last_activity_at
    message_count = COALESCE(message_count, 0) + 1,
    updated_at = NEW.timestamp
  WHERE id = NEW.session_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Ensure the trigger exists and is properly configured
DROP TRIGGER IF EXISTS update_session_on_message ON conversation_messages;

CREATE TRIGGER update_session_on_message
  AFTER INSERT ON conversation_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_session_activity();

-- Step 3: Ensure conversation_messages has user_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'conversation_messages'
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.conversation_messages
      ADD COLUMN user_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added user_id column to conversation_messages';
  ELSE
    RAISE NOTICE 'user_id column already exists in conversation_messages';
  END IF;
END $$;

-- Step 4: Ensure conversation_messages has context_used column (used for metadata)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'conversation_messages'
    AND column_name = 'context_used'
  ) THEN
    ALTER TABLE public.conversation_messages
      ADD COLUMN context_used JSONB DEFAULT '{}'::jsonb;
    RAISE NOTICE 'Added context_used column to conversation_messages';
  ELSE
    RAISE NOTICE 'context_used column already exists in conversation_messages';
  END IF;
END $$;

-- Step 5: Make user_id NOT NULL after backfilling (if needed)
-- First, backfill any NULL user_id values from the session's user_id
UPDATE conversation_messages cm
SET user_id = cs.user_id
FROM conversation_sessions cs
WHERE cm.session_id = cs.id
  AND cm.user_id IS NULL;

-- Now make it NOT NULL (if not already)
DO $$
BEGIN
  ALTER TABLE public.conversation_messages
    ALTER COLUMN user_id SET NOT NULL;
  RAISE NOTICE 'Set user_id to NOT NULL';
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'user_id may already be NOT NULL or has NULL values';
END $$;

-- Step 6: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_user ON conversation_messages(user_id);

-- Step 7: Refresh schema cache
SELECT pg_notify('pgrst', 'reload schema');

-- Done!
SELECT '✅ Task chat persistence fixed!' AS status;
SELECT 'Trigger now updates last_message_at correctly' AS fix_1;
SELECT 'conversation_messages now has user_id column' AS fix_2;
SELECT 'conversation_messages now has context_used column' AS fix_3;
