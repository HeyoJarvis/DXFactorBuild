-- Fix: Add content_text column to team_updates table
-- This column was added in migration 003 but may not have been applied

-- Add content_text column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'team_updates' 
    AND column_name = 'content_text'
  ) THEN
    ALTER TABLE team_updates ADD COLUMN content_text TEXT;
    COMMENT ON COLUMN team_updates.content_text IS 'Searchable text content combining title, description, and metadata';
  END IF;
END $$;

-- Verify the column was added
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'team_updates' 
AND column_name = 'content_text';

