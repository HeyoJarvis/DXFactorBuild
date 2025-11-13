-- Add epic fields to conversation_sessions table
-- This enables tracking which epic a task belongs to (for JIRA integration)

-- Add epic tracking columns
ALTER TABLE public.conversation_sessions 
  ADD COLUMN IF NOT EXISTS epic_key TEXT,
  ADD COLUMN IF NOT EXISTS epic_name TEXT;

-- Add index for performance when filtering by epic
CREATE INDEX IF NOT EXISTS idx_sessions_epic_key ON public.conversation_sessions(epic_key);

-- Add comments for documentation
COMMENT ON COLUMN public.conversation_sessions.epic_key IS 'JIRA epic key (e.g., PROJ-123) that this task belongs to';
COMMENT ON COLUMN public.conversation_sessions.epic_name IS 'Human-readable name of the epic';

-- Verify the changes
SELECT 
  'conversation_sessions' as table_name,
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'conversation_sessions' 
  AND table_schema = 'public'
  AND column_name IN ('epic_key', 'epic_name')
ORDER BY ordinal_position;

