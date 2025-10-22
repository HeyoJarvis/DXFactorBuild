-- Optional: Create Vector Index Later
-- Run this AFTER you've indexed some repositories
-- The index is faster to build when there's already data in the table

-- This script creates the vector index with minimal memory requirements
-- Run this if the main migration completed but skipped the vector index

DO $$ 
DECLARE
  row_count INTEGER;
BEGIN
  -- Check if we have data
  SELECT COUNT(*) INTO row_count FROM code_chunks;
  
  IF row_count = 0 THEN
    RAISE NOTICE '⚠️  No data in code_chunks yet. Index some repositories first, then run this script.';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Found % chunks, creating index...', row_count;
  
  -- Drop existing index if any
  DROP INDEX IF EXISTS idx_code_chunks_embedding;
  
  -- Create with minimal lists (works with low memory)
  CREATE INDEX idx_code_chunks_embedding 
    ON code_chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = LEAST(GREATEST(row_count / 1000, 10), 100));
    -- Formula: 1 list per 1000 rows, minimum 10, maximum 100
  
  RAISE NOTICE '✅ Vector index created successfully!';
END $$;

