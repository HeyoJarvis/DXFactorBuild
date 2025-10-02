-- Desktop App Additional Tables
-- Run this in your Supabase SQL editor AFTER running supabase-schema-improved.sql
-- These tables support the Desktop Electron app's Slack and Copilot features

-- Slack Messages table
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

-- Create indexes separately
CREATE INDEX idx_slack_messages_user ON slack_messages(user_id);
CREATE INDEX idx_slack_messages_channel ON slack_messages(channel_id);
CREATE INDEX idx_slack_messages_timestamp ON slack_messages(timestamp DESC);
CREATE INDEX idx_slack_messages_urgent ON slack_messages(is_urgent) WHERE is_urgent = true;

-- Copilot Conversations table
CREATE TABLE IF NOT EXISTS copilot_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(100) NOT NULL, -- Will use UUID when auth is implemented
  message_text TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes separately
CREATE INDEX idx_copilot_user_timestamp ON copilot_conversations(user_id, timestamp DESC);
CREATE INDEX idx_copilot_role ON copilot_conversations(role);

-- User Activity tracking table
CREATE TABLE IF NOT EXISTS user_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(100) NOT NULL,
  activity_type VARCHAR(100) NOT NULL,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes separately
CREATE INDEX idx_user_activity_user ON user_activity(user_id);
CREATE INDEX idx_user_activity_type ON user_activity(activity_type);
CREATE INDEX idx_user_activity_timestamp ON user_activity(timestamp DESC);

-- Row Level Security (RLS) Policies
-- For now, allow all access since we're using service role key
-- TODO: Add proper RLS policies when user authentication is implemented

ALTER TABLE slack_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE copilot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

-- Temporary policy: Allow service role to do everything
CREATE POLICY "Service role has full access to slack_messages"
  ON slack_messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to copilot_conversations"
  ON copilot_conversations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to user_activity"
  ON user_activity
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Enable realtime for these tables (optional)
ALTER PUBLICATION supabase_realtime ADD TABLE slack_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE copilot_conversations;

-- Comments for documentation
COMMENT ON TABLE slack_messages IS 'Stores Slack messages captured by the desktop app';
COMMENT ON TABLE copilot_conversations IS 'Stores copilot chat conversations from the desktop app';
COMMENT ON TABLE user_activity IS 'Tracks user activity in the desktop app for analytics';

-- Success message
SELECT 'Desktop tables created successfully! ✅' AS status;

