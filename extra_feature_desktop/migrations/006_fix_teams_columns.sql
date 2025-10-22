-- Migration: Fix teams table columns
-- Adds missing columns to teams table if they don't exist

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

-- Add working_hours_start if missing (from original migration)
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

-- Add working_hours_end if missing (from original migration)
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

-- Update timezone to be NOT NULL after adding it
ALTER TABLE teams ALTER COLUMN timezone SET NOT NULL;

-- Update timestamps to use TIMESTAMPTZ for proper timezone support
DO $$
BEGIN
  -- Check if created_at is TIMESTAMP and convert to TIMESTAMPTZ
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teams' 
    AND column_name = 'created_at'
    AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE teams ALTER COLUMN created_at TYPE TIMESTAMPTZ;
  END IF;

  -- Check if updated_at is TIMESTAMP and convert to TIMESTAMPTZ
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teams' 
    AND column_name = 'updated_at'
    AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE teams ALTER COLUMN updated_at TYPE TIMESTAMPTZ;
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN teams.timezone IS 'IANA timezone identifier (e.g., America/New_York)';
COMMENT ON COLUMN teams.color IS 'Hex color for UI differentiation';

