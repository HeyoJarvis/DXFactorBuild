-- Complete Teams Feature Setup
-- Run this in Supabase SQL Editor to fix all issues at once

-- ============================================
-- STEP 1: Fix teams table columns
-- ============================================

-- Add timezone column if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teams' 
    AND column_name = 'timezone'
  ) THEN
    ALTER TABLE teams ADD COLUMN timezone TEXT DEFAULT 'UTC';
  END IF;
END $$;

-- Add color column if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teams' 
    AND column_name = 'color'
  ) THEN
    ALTER TABLE teams ADD COLUMN color TEXT DEFAULT '#3B82F6';
  END IF;
END $$;

-- Add working_hours_start if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teams' 
    AND column_name = 'working_hours_start'
  ) THEN
    ALTER TABLE teams ADD COLUMN working_hours_start TIME DEFAULT '09:00:00';
  END IF;
END $$;

-- Add working_hours_end if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teams' 
    AND column_name = 'working_hours_end'
  ) THEN
    ALTER TABLE teams ADD COLUMN working_hours_end TIME DEFAULT '17:00:00';
  END IF;
END $$;

-- Update timezone to be NOT NULL
ALTER TABLE teams ALTER COLUMN timezone SET NOT NULL;

-- ============================================
-- STEP 2: Ensure all other tables exist
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Team members table
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- Team repositories table
CREATE TABLE IF NOT EXISTS team_repositories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  repository_owner TEXT NOT NULL,
  repository_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, repository_owner, repository_name)
);

-- ============================================
-- STEP 3: Add team_id to existing tables
-- ============================================

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

-- ============================================
-- STEP 4: Create indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_team_meetings_team_id ON team_meetings(team_id);
CREATE INDEX IF NOT EXISTS idx_team_updates_team_id ON team_updates(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_repositories_team_id ON team_repositories(team_id);

-- ============================================
-- STEP 5: Setup RLS policies
-- ============================================

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_repositories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role full access teams" ON teams;
DROP POLICY IF EXISTS "Service role full access team_members" ON team_members;
DROP POLICY IF EXISTS "Service role full access team_repositories" ON team_repositories;

-- Create policies
CREATE POLICY "Service role full access teams" ON teams
  FOR ALL USING (true);

CREATE POLICY "Service role full access team_members" ON team_members
  FOR ALL USING (true);

CREATE POLICY "Service role full access team_repositories" ON team_repositories
  FOR ALL USING (true);

-- ============================================
-- STEP 6: Grant permissions
-- ============================================

GRANT ALL ON teams TO service_role;
GRANT ALL ON team_members TO service_role;
GRANT ALL ON team_repositories TO service_role;

-- ============================================
-- STEP 7: Add comments
-- ============================================

COMMENT ON TABLE teams IS 'Teams with timezone support for multi-timezone collaboration';
COMMENT ON TABLE team_members IS 'Junction table linking users to teams with roles';
COMMENT ON TABLE team_repositories IS 'GitHub repositories assigned to teams for code context';

COMMENT ON COLUMN teams.timezone IS 'IANA timezone identifier (e.g., America/New_York)';
COMMENT ON COLUMN teams.color IS 'Hex color for UI differentiation';
COMMENT ON COLUMN team_meetings.team_id IS 'Links meeting to a specific team for context isolation';
COMMENT ON COLUMN team_updates.team_id IS 'Links JIRA/GitHub update to a specific team for context isolation';

-- ============================================
-- STEP 8: Create trigger for updated_at
-- ============================================

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;

-- Create trigger
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DONE! Verify with:
-- ============================================

-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'teams'
-- ORDER BY ordinal_position;

