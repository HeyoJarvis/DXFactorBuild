-- Enhanced Session-Based Conversations with Workflow Support
-- Run this in your Supabase SQL Editor to set up workflow-based chat sessions

-- Drop old tables if they exist (be careful - this will delete data!)
DROP TABLE IF EXISTS conversation_messages CASCADE;
DROP TABLE IF EXISTS conversation_sessions CASCADE;

-- Drop old indexes
DROP INDEX IF EXISTS idx_sessions_user;
DROP INDEX IF EXISTS idx_sessions_workflow_type;
DROP INDEX IF EXISTS idx_sessions_workflow_id;
DROP INDEX IF EXISTS idx_sessions_user_workflow;
DROP INDEX IF EXISTS idx_sessions_last_activity;
DROP INDEX IF EXISTS idx_sessions_active;
DROP INDEX IF EXISTS idx_messages_session;
DROP INDEX IF EXISTS idx_messages_role;

-- Conversation Sessions with Workflow Support
CREATE TABLE conversation_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(100) NOT NULL,
  
  -- Workflow identification
  workflow_id VARCHAR(200), -- Unique identifier for this workflow instance
  workflow_type VARCHAR(100), -- e.g., 'task_automation', 'tool_recommendation', 'integration_help', 'general_inquiry'
  workflow_intent VARCHAR(100), -- e.g., 'information_seeking', 'problem_solving', 'learning'
  
  -- Session metadata
  session_title VARCHAR(200), -- Auto-generated or user-provided title
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  
  -- Workflow context
  source_channel_id VARCHAR(100), -- Slack channel where workflow originated
  source_message_id VARCHAR(100), -- Original Slack message that triggered this
  workflow_metadata JSONB DEFAULT '{}', -- Store workflow analysis (urgency, tools_mentioned, entities, etc.)
  
  -- Session state
  is_active BOOLEAN DEFAULT true,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ
);

-- Create indexes for efficient queries
CREATE INDEX idx_sessions_user ON conversation_sessions(user_id);
CREATE INDEX idx_sessions_workflow_type ON conversation_sessions(workflow_type);
CREATE INDEX idx_sessions_workflow_id ON conversation_sessions(workflow_id);
CREATE INDEX idx_sessions_user_workflow ON conversation_sessions(user_id, workflow_type, is_active);
CREATE INDEX idx_sessions_last_activity ON conversation_sessions(last_activity_at DESC);
CREATE INDEX idx_sessions_active ON conversation_sessions(is_active) WHERE is_active = true;

-- Conversation Messages (linked to workflow sessions)
CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  metadata JSONB DEFAULT '{}', -- Store model, tokens, context_used, workflow_analysis, etc.
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_session ON conversation_messages(session_id, timestamp);
CREATE INDEX idx_messages_role ON conversation_messages(role);

-- Auto-update session activity when message is added
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversation_sessions
  SET 
    last_activity_at = NEW.timestamp,
    message_count = message_count + 1
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_session_on_message
  AFTER INSERT ON conversation_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_session_activity();

-- Row Level Security (RLS)
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to conversation_sessions"
  ON conversation_sessions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to conversation_messages"
  ON conversation_messages FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_messages;

-- Helper function: Create new workflow session (always creates new, never reuses)
CREATE OR REPLACE FUNCTION create_workflow_session(
  p_user_id VARCHAR,
  p_workflow_type VARCHAR,
  p_workflow_intent VARCHAR DEFAULT 'information_seeking',
  p_workflow_metadata JSONB DEFAULT '{}',
  p_source_channel_id VARCHAR DEFAULT NULL,
  p_source_message_id VARCHAR DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
BEGIN
  -- Always create a new session for each workflow
  INSERT INTO conversation_sessions (
    user_id,
    workflow_type,
    workflow_intent,
    workflow_id,
    workflow_metadata,
    source_channel_id,
    source_message_id,
    is_active
  ) VALUES (
    p_user_id,
    p_workflow_type,
    p_workflow_intent,
    p_user_id || '_workflow_' || EXTRACT(EPOCH FROM NOW())::TEXT,
    p_workflow_metadata,
    p_source_channel_id,
    p_source_message_id,
    true
  )
  RETURNING id INTO v_session_id;
  
  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;

-- Helper function: Get user's active session (most recent, any workflow type)
CREATE OR REPLACE FUNCTION get_user_active_session(
  p_user_id VARCHAR,
  p_max_age_hours INTEGER DEFAULT 1
)
RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
BEGIN
  -- Get the most recent active session regardless of workflow type
  SELECT id INTO v_session_id
  FROM conversation_sessions
  WHERE user_id = p_user_id
    AND is_active = true
    AND is_completed = false
    AND last_activity_at >= NOW() - INTERVAL '1 hour' * p_max_age_hours
  ORDER BY last_activity_at DESC
  LIMIT 1;
  
  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;

-- Helper function: Get workflow sessions summary for a user
CREATE OR REPLACE FUNCTION get_user_workflow_summary(
  p_user_id VARCHAR,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE(
  workflow_type VARCHAR,
  session_count BIGINT,
  total_messages BIGINT,
  last_activity TIMESTAMPTZ,
  active_sessions BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.workflow_type,
    COUNT(DISTINCT cs.id)::BIGINT as session_count,
    COALESCE(SUM(cs.message_count), 0)::BIGINT as total_messages,
    MAX(cs.last_activity_at) as last_activity,
    COUNT(DISTINCT cs.id) FILTER (WHERE cs.is_active = true)::BIGINT as active_sessions
  FROM conversation_sessions cs
  WHERE cs.user_id = p_user_id
    AND cs.started_at >= NOW() - INTERVAL '1 day' * p_days
  GROUP BY cs.workflow_type
  ORDER BY last_activity DESC;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE conversation_sessions IS 'Workflow-based conversation sessions - each workflow instance gets a separate session';
COMMENT ON TABLE conversation_messages IS 'Messages within workflow-based conversation sessions';
COMMENT ON COLUMN conversation_sessions.workflow_type IS 'Type of workflow: task_automation, tool_recommendation, integration_help, problem_solving, etc. (for context only, not for grouping)';
COMMENT ON COLUMN conversation_sessions.workflow_metadata IS 'Rich metadata from WorkflowIntelligenceSystem: urgency, tools_mentioned, entities, intent, etc.';

-- Success message
SELECT '✅ Workflow-based conversation tables created successfully!' AS status;
SELECT '📊 Tables created: conversation_sessions, conversation_messages' AS info;
SELECT '🔧 Helper functions: create_workflow_session, get_user_active_session, get_user_workflow_summary' AS functions;
SELECT '💡 Each workflow detection creates a NEW session (type is just metadata)' AS behavior;

