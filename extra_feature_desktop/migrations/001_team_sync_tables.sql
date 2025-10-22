-- Team Sync Intelligence Database Schema
-- Run this migration in Supabase SQL Editor
-- IMPORTANT: This is SEPARATE from desktop2 - no conflicts!

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: team_sync_integrations
-- Stores OAuth tokens for Team Sync Intelligence (INDEPENDENT from desktop2)
CREATE TABLE IF NOT EXISTS team_sync_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL, -- References auth.users(id)
  service_name TEXT NOT NULL CHECK (service_name IN ('microsoft', 'jira', 'github')),
  access_token TEXT,
  refresh_token TEXT,
  token_expiry TIMESTAMPTZ,
  cloud_id TEXT, -- For JIRA
  site_url TEXT, -- For JIRA  
  metadata JSONB DEFAULT '{}'::jsonb,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_service UNIQUE(user_id, service_name)
);

-- Table: team_meetings
-- Stores meeting data and AI-generated summaries
CREATE TABLE IF NOT EXISTS team_meetings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL, -- References auth.users(id)
  meeting_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  attendees JSONB DEFAULT '[]'::jsonb,
  is_important BOOLEAN DEFAULT false,
  copilot_notes TEXT,
  manual_notes TEXT,
  ai_summary TEXT,
  key_decisions JSONB DEFAULT '[]'::jsonb,
  action_items JSONB DEFAULT '[]'::jsonb,
  topics JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table: team_updates
-- Aggregates JIRA issues and GitHub PRs/commits
CREATE TABLE IF NOT EXISTS team_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL, -- References auth.users(id)
  update_type TEXT NOT NULL CHECK (update_type IN ('jira_issue', 'github_pr', 'github_commit')),
  external_id TEXT UNIQUE NOT NULL,
  external_key TEXT, -- JIRA key or GitHub PR number
  title TEXT NOT NULL,
  description TEXT,
  content_text TEXT, -- Searchable text content combining title, description, and metadata
  author TEXT,
  status TEXT,
  linked_meeting_id UUID REFERENCES team_meetings(id) ON DELETE SET NULL,
  linked_jira_key TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table: team_context_index
-- For future semantic search implementation with pgvector
CREATE TABLE IF NOT EXISTS team_context_index (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_type TEXT NOT NULL, -- 'meeting', 'jira', 'github'
  content_id UUID NOT NULL,
  content_text TEXT NOT NULL,
  -- embedding VECTOR(1536), -- Uncomment when pgvector is enabled
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_sync_integrations_user_service ON team_sync_integrations(user_id, service_name);
CREATE INDEX IF NOT EXISTS idx_team_sync_integrations_user_id ON team_sync_integrations(user_id);

CREATE INDEX IF NOT EXISTS idx_team_meetings_user_id ON team_meetings(user_id);
CREATE INDEX IF NOT EXISTS idx_team_meetings_start_time ON team_meetings(start_time);
CREATE INDEX IF NOT EXISTS idx_team_meetings_is_important ON team_meetings(is_important);
CREATE INDEX IF NOT EXISTS idx_team_meetings_meeting_id ON team_meetings(meeting_id);

CREATE INDEX IF NOT EXISTS idx_team_updates_user_id ON team_updates(user_id);
CREATE INDEX IF NOT EXISTS idx_team_updates_type ON team_updates(update_type);
CREATE INDEX IF NOT EXISTS idx_team_updates_created_at ON team_updates(created_at);
CREATE INDEX IF NOT EXISTS idx_team_updates_jira_key ON team_updates(linked_jira_key);
CREATE INDEX IF NOT EXISTS idx_team_updates_meeting_id ON team_updates(linked_meeting_id);
CREATE INDEX IF NOT EXISTS idx_team_updates_external_id ON team_updates(external_id);

CREATE INDEX IF NOT EXISTS idx_team_context_type ON team_context_index(content_type);
CREATE INDEX IF NOT EXISTS idx_team_context_content_id ON team_context_index(content_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_team_meetings_updated_at ON team_meetings;
CREATE TRIGGER update_team_meetings_updated_at
  BEFORE UPDATE ON team_meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_team_updates_updated_at ON team_updates;
CREATE TRIGGER update_team_updates_updated_at
  BEFORE UPDATE ON team_updates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE team_sync_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_context_index ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for desktop app using service_role key)
CREATE POLICY "Service role full access integrations" ON team_sync_integrations
  FOR ALL USING (true);

CREATE POLICY "Service role full access meetings" ON team_meetings
  FOR ALL USING (true);

CREATE POLICY "Service role full access updates" ON team_updates
  FOR ALL USING (true);

CREATE POLICY "Service role full access context" ON team_context_index
  FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON team_sync_integrations TO service_role;
GRANT ALL ON team_meetings TO service_role;
GRANT ALL ON team_updates TO service_role;
GRANT ALL ON team_context_index TO service_role;

-- Comments for documentation
COMMENT ON TABLE team_meetings IS 'Stores meeting data with AI-generated summaries and key insights';
COMMENT ON TABLE team_updates IS 'Aggregates updates from JIRA and GitHub for team intelligence';
COMMENT ON TABLE team_context_index IS 'Search index for semantic queries (future pgvector integration)';

COMMENT ON COLUMN team_meetings.is_important IS 'Automatically scored by smart meeting detection algorithm';
COMMENT ON COLUMN team_meetings.copilot_notes IS 'Notes from Microsoft Copilot (if available)';
COMMENT ON COLUMN team_meetings.manual_notes IS 'User-uploaded meeting notes';
COMMENT ON COLUMN team_meetings.ai_summary IS 'AI-generated summary from Claude';
COMMENT ON COLUMN team_meetings.key_decisions IS 'JSON array of important decisions made';
COMMENT ON COLUMN team_meetings.action_items IS 'JSON array of action items with owners';

COMMENT ON COLUMN team_updates.update_type IS 'Type: jira_issue, github_pr, or github_commit';
COMMENT ON COLUMN team_updates.linked_meeting_id IS 'Links update to related meeting (optional)';
COMMENT ON COLUMN team_updates.linked_jira_key IS 'Extracted JIRA ticket key from commits/PRs';

