-- Migration: Add color column to teams table
-- This adds the missing color column for team visual identification

-- Add color column if it doesn't exist
ALTER TABLE teams
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3B82F6';

-- Add comment for documentation
COMMENT ON COLUMN teams.color IS 'Hex color code for UI differentiation of teams';

