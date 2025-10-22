-- Migration: Add content_text column to team_updates table
-- For existing installations that already have team_updates table

-- Add content_text column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'team_updates' 
    AND column_name = 'content_text'
  ) THEN
    ALTER TABLE team_updates 
    ADD COLUMN content_text TEXT;
    
    RAISE NOTICE 'Added content_text column to team_updates table';
  ELSE
    RAISE NOTICE 'content_text column already exists in team_updates table';
  END IF;
END $$;

-- Update existing rows to populate content_text from title and description
UPDATE team_updates
SET content_text = CONCAT_WS(E'\n', 
  title, 
  description,
  CONCAT('Status: ', COALESCE(status, 'None')),
  CASE 
    WHEN metadata->>'priority' IS NOT NULL 
    THEN CONCAT('Priority: ', metadata->>'priority')
    ELSE ''
  END
)
WHERE content_text IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN team_updates.content_text IS 'Searchable text content combining title, description, and key metadata for filtering and search';

