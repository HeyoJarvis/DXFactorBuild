-- Add source tracking columns to tasks table
-- This enables tracking task origin from Slack, Teams, Email, JIRA, or Manual creation

-- Add source tracking columns
ALTER TABLE tasks 
  ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS source_context JSONB DEFAULT '{}';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_source ON tasks(source);
CREATE INDEX IF NOT EXISTS idx_tasks_source_id ON tasks(source_id);

-- Add comments for documentation
COMMENT ON COLUMN tasks.source IS 'Task origin: manual, slack, teams, email, jira';
COMMENT ON COLUMN tasks.source_id IS 'External ID from source system (message ID, email ID, issue key)';
COMMENT ON COLUMN tasks.source_context IS 'Full metadata from source (channel, sender, thread, etc.)';

-- Add check constraint for valid sources
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_source_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_source_check 
  CHECK (source IN ('manual', 'slack', 'teams', 'email', 'jira'));

