-- Teams Feature Migration
-- Creates tables for team management with timezone support and context isolation

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: teams
-- Stores team information with timezone for working hours calculation
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  timezone TEXT NOT NULL,  -- e.g., 'America/New_York', 'Europe/London', 'Asia/Tokyo'
  color TEXT DEFAULT '#3B82F6',  -- For UI differentiation
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: team_members
-- Junction table linking users to teams with roles
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT DEFAULT 'member',  -- 'member', 'lead', 'admin'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)  -- User can only be in team once
);

-- Table: team_repositories
-- Links GitHub repositories to teams for code context
CREATE TABLE IF NOT EXISTS team_repositories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  repository_owner TEXT NOT NULL,
  repository_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, repository_owner, repository_name)
);

-- Add team_id columns to existing tables (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'team_meetings' 
    AND column_name = 'team_id'
  ) THEN
    ALTER TABLE team_meetings ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'team_updates' 
    AND column_name = 'team_id'
  ) THEN
    ALTER TABLE team_updates ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_meetings_team_id ON team_meetings(team_id);
CREATE INDEX IF NOT EXISTS idx_team_updates_team_id ON team_updates(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_repositories_team_id ON team_repositories(team_id);

-- Updated_at trigger for teams table
DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_repositories ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access teams" ON teams
  FOR ALL USING (true);

CREATE POLICY "Service role full access team_members" ON team_members
  FOR ALL USING (true);

CREATE POLICY "Service role full access team_repositories" ON team_repositories
  FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON teams TO service_role;
GRANT ALL ON team_members TO service_role;
GRANT ALL ON team_repositories TO service_role;

-- Comments for documentation
COMMENT ON TABLE teams IS 'Teams with timezone support for multi-timezone collaboration';
COMMENT ON TABLE team_members IS 'Junction table linking users to teams with roles';
COMMENT ON TABLE team_repositories IS 'GitHub repositories assigned to teams for code context';

COMMENT ON COLUMN teams.timezone IS 'IANA timezone identifier (e.g., America/New_York)';
COMMENT ON COLUMN teams.color IS 'Hex color for UI differentiation';
COMMENT ON COLUMN team_meetings.team_id IS 'Links meeting to a specific team for context isolation';
COMMENT ON COLUMN team_updates.team_id IS 'Links JIRA/GitHub update to a specific team for context isolation';

