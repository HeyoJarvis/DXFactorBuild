-- Team Chat Context Settings
-- Stores user preferences for which context sources to include per team

CREATE TABLE IF NOT EXISTS public.team_chat_context_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id character varying NOT NULL,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

  -- Toggle switches for different context types
  include_meetings BOOLEAN DEFAULT true,
  include_tasks BOOLEAN DEFAULT true,
  include_code BOOLEAN DEFAULT true,

  -- Specific selections (arrays of IDs)
  selected_meeting_ids TEXT[],
  selected_task_ids TEXT[],
  selected_repo_paths TEXT[],

  -- Custom context (user-provided text)
  custom_context TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure one setting per user per team
  UNIQUE(user_id, team_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_team_chat_context_user_team
  ON team_chat_context_settings(user_id, team_id);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_team_chat_context_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_team_chat_context_settings_timestamp
  BEFORE UPDATE ON team_chat_context_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_team_chat_context_settings_timestamp();

-- Grant permissions (adjust as needed for your setup)
ALTER TABLE team_chat_context_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only manage their own context settings
CREATE POLICY team_chat_context_user_policy ON team_chat_context_settings
  FOR ALL
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

COMMENT ON TABLE team_chat_context_settings IS 'Stores user preferences for team chat context sources';
