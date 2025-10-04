-- =====================================================
-- Safe Fix for conversation_sessions table
-- This script is idempotent and safe to run multiple times
-- =====================================================

-- Step 1: Ensure metadata column exists (most likely issue)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'conversation_sessions' 
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.conversation_sessions ADD COLUMN metadata JSONB DEFAULT '{}';
    RAISE NOTICE 'Added metadata column';
  ELSE
    RAISE NOTICE 'metadata column already exists';
  END IF;
END $$;

-- Step 2: Ensure is_active column exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'conversation_sessions' 
    AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.conversation_sessions ADD COLUMN is_active BOOLEAN DEFAULT true;
    RAISE NOTICE 'Added is_active column';
  ELSE
    RAISE NOTICE 'is_active column already exists';
  END IF;
END $$;

-- Step 3: Enable RLS if not already enabled
ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY;

-- Step 4: Update RLS policies
DROP POLICY IF EXISTS "Service role full access to sessions" ON public.conversation_sessions;
DROP POLICY IF EXISTS "Service role has full access to conversation_sessions" ON public.conversation_sessions;

-- Service role needs full access
CREATE POLICY "Service role full access to sessions" ON public.conversation_sessions
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Step 5: Refresh schema cache (this is key!)
SELECT pg_notify('pgrst', 'reload schema');

SELECT '✅ conversation_sessions table updated!' AS status;
SELECT 'Now restart your app to pick up the schema changes' AS next_step;

