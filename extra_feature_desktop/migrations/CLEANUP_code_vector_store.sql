-- Cleanup Script for Code Vector Store
-- CAUTION: This will delete all indexed code data!
-- Only run this if you want to start fresh or remove the code indexer completely.

-- Drop triggers first
DROP TRIGGER IF EXISTS update_code_chunks_updated_at ON code_chunks;
DROP TRIGGER IF EXISTS update_indexing_status_updated_at ON code_indexing_status;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS update_indexing_status(text, text, text, text, integer, integer, text, text);
DROP FUNCTION IF EXISTS search_code_chunks(vector, float, int, text, text, text);

-- Drop indexes
DROP INDEX IF EXISTS idx_code_chunks_embedding;
DROP INDEX IF EXISTS idx_code_chunks_language;
DROP INDEX IF EXISTS idx_code_chunks_type;
DROP INDEX IF EXISTS idx_code_chunks_file_path;
DROP INDEX IF EXISTS idx_code_chunks_repository;
DROP INDEX IF EXISTS idx_indexing_status_status;
DROP INDEX IF EXISTS idx_indexing_status_repository;

-- Drop tables
DROP TABLE IF EXISTS code_chunks;
DROP TABLE IF EXISTS code_indexing_status;

-- Note: We don't drop the vector extension as other tables might be using it
-- If you want to drop it completely, uncomment the line below:
-- DROP EXTENSION IF EXISTS vector;

SELECT '✅ Code Vector Store cleanup completed!' as message;

