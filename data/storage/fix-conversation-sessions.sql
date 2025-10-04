-- =====================================================
-- Fix conversation_sessions table for authenticated users
-- =====================================================

-- First, let's make sure the table exists with the correct structure
-- We'll use ALTER TABLE to add any missing columns

-- Add metadata column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'conversation_sessions' 
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.conversation_sessions ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
END $$;

-- Make sure user_id is UUID (if it's VARCHAR, we need to handle existing data)
DO $$
BEGIN
  -- Check if user_id is VARCHAR
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'conversation_sessions' 
    AND column_name = 'user_id'
    AND data_type = 'character varying'
  ) THEN
    -- Add a new UUID column temporarily
    ALTER TABLE public.conversation_sessions ADD COLUMN user_id_uuid UUID;
    
    -- Try to convert existing user_id values to UUID where possible
    -- For 'desktop-user' and other non-UUID values, we'll need to handle separately
    UPDATE public.conversation_sessions 
    SET user_id_uuid = user_id::UUID
    WHERE user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    
    -- Drop the old column
    ALTER TABLE public.conversation_sessions DROP COLUMN user_id;
    
    -- Rename the new column
    ALTER TABLE public.conversation_sessions RENAME COLUMN user_id_uuid TO user_id;
    
    -- Make it NOT NULL after populating
    ALTER TABLE public.conversation_sessions ALTER COLUMN user_id SET NOT NULL;
    
    -- Add foreign key reference to users table
    ALTER TABLE public.conversation_sessions 
    ADD CONSTRAINT fk_conversation_sessions_user 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Make sure is_active column exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'conversation_sessions' 
    AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.conversation_sessions ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Add RLS policies for conversation_sessions if not exists
ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Users can view own sessions" ON public.conversation_sessions;
DROP POLICY IF EXISTS "Users can create own sessions" ON public.conversation_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON public.conversation_sessions;
DROP POLICY IF EXISTS "Service role full access to sessions" ON public.conversation_sessions;

-- Create new user-specific policies
CREATE POLICY "Users can view own sessions" ON public.conversation_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions" ON public.conversation_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON public.conversation_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role still needs full access for system operations
CREATE POLICY "Service role full access to sessions" ON public.conversation_sessions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_user_id ON public.conversation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_is_active ON public.conversation_sessions(is_active) WHERE is_active = true;

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';

SELECT '✅ conversation_sessions table fixed for authenticated users!' AS status;

