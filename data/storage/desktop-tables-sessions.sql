-- Desktop App with Session-Based Conversations
-- This replaces the previous desktop-tables.sql with a better session-based structure
-- Drop old tables first if they exist, then run this

-- Drop old tables and indexes (if they exist)
DROP TABLE IF EXISTS copilot_conversations CASCADE;
DROP TABLE IF EXISTS conversation_messages CASCADE;
DROP TABLE IF EXISTS conversation_sessions CASCADE;
DROP TABLE IF EXISTS slack_messages CASCADE;
DROP TABLE IF EXISTS user_activity CASCADE;

-- Drop any existing indexes
DROP INDEX IF EXISTS idx_sessions_user;
DROP INDEX IF EXISTS idx_sessions_last_activity;
DROP INDEX IF EXISTS idx_sessions_active;
DROP INDEX IF EXISTS idx_messages_session;
DROP INDEX IF EXISTS idx_messages_role;
DROP INDEX IF EXISTS idx_slack_messages_user;
DROP INDEX IF EXISTS idx_slack_messages_channel;
DROP INDEX IF EXISTS idx_slack_messages_timestamp;
DROP INDEX IF EXISTS idx_slack_messages_urgent;
DROP INDEX IF EXISTS idx_user_activity_user;
DROP INDEX IF EXISTS idx_user_activity_type;
DROP INDEX IF EXISTS idx_user_activity_timestamp;

-- Conversation Sessions table (the "bucket" for each conversation)
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(100) NOT NULL,
  session_title VARCHAR(200), -- Optional: Auto-generated or user-provided title
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}', -- Store context like slack_connected, crm_connected, etc.
  is_active BOOLEAN DEFAULT true
);

-- Create indexes separately
CREATE INDEX idx_sessions_user ON conversation_sessions(user_id);
CREATE INDEX idx_sessions_last_activity ON conversation_sessions(last_activity_at DESC);
CREATE INDEX idx_sessions_active ON conversation_sessions(is_active) WHERE is_active = true;

-- Conversation Messages table (individual messages within sessions)
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  metadata JSONB DEFAULT '{}', -- Store things like model, tokens, context_used, etc.
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes separately
CREATE INDEX idx_messages_session ON conversation_messages(session_id, timestamp);
CREATE INDEX idx_messages_role ON conversation_messages(role);

-- Slack Messages table (unchanged)
CREATE TABLE IF NOT EXISTS slack_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id VARCHAR(100) UNIQUE NOT NULL,
  user_id VARCHAR(100) NOT NULL,
  channel_id VARCHAR(100) NOT NULL,
  message_text TEXT,
  message_type VARCHAR(50) CHECK (message_type IN ('mention', 'message', 'reply', 'thread')),
  is_urgent BOOLEAN DEFAULT false,
  timestamp TIMESTAMPTZ NOT NULL,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Slack messages
CREATE INDEX idx_slack_messages_user ON slack_messages(user_id);
CREATE INDEX idx_slack_messages_channel ON slack_messages(channel_id);
CREATE INDEX idx_slack_messages_timestamp ON slack_messages(timestamp DESC);
CREATE INDEX idx_slack_messages_urgent ON slack_messages(is_urgent) WHERE is_urgent = true;

-- User Activity tracking table
CREATE TABLE IF NOT EXISTS user_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(100) NOT NULL,
  activity_type VARCHAR(100) NOT NULL,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for user activity
CREATE INDEX idx_user_activity_user ON user_activity(user_id);
CREATE INDEX idx_user_activity_type ON user_activity(activity_type);
CREATE INDEX idx_user_activity_timestamp ON user_activity(timestamp DESC);

-- Function to auto-update last_activity_at when new message is added
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

-- Trigger to automatically update session when message is added
CREATE TRIGGER update_session_on_message
  AFTER INSERT ON conversation_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_session_activity();

-- Row Level Security (RLS) Policies
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role has full access to conversation_sessions"
  ON conversation_sessions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to conversation_messages"
  ON conversation_messages FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to slack_messages"
  ON slack_messages FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to user_activity"
  ON user_activity FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Enable realtime for these tables
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE slack_messages;

-- Comments for documentation
COMMENT ON TABLE conversation_sessions IS 'Stores conversation sessions (the "bucket" for each copilot conversation)';
COMMENT ON TABLE conversation_messages IS 'Stores individual messages within conversation sessions';
COMMENT ON TABLE slack_messages IS 'Stores Slack messages captured by the desktop app';
COMMENT ON TABLE user_activity IS 'Tracks user activity in the desktop app for analytics';

-- Success message
SELECT 'Session-based conversation tables created successfully! ✅' AS status;

