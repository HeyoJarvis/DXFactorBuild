-- Code Vector Store Migration (Idempotent Version)
-- This version is safe to run multiple times without errors

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create code_chunks table (will skip if exists)
CREATE TABLE IF NOT EXISTS code_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Repository information
  repository_owner TEXT NOT NULL,
  repository_name TEXT NOT NULL,
  repository_branch TEXT DEFAULT 'main',
  
  -- File information
  file_path TEXT NOT NULL,
  file_language TEXT NOT NULL,
  
  -- Chunk information
  chunk_content TEXT NOT NULL,
  chunk_type TEXT NOT NULL, -- 'function', 'class', 'method', 'block', 'file'
  chunk_name TEXT,
  chunk_index INTEGER NOT NULL,
  total_chunks INTEGER NOT NULL,
  start_line INTEGER,
  token_count INTEGER,
  
  -- Embedding
  embedding vector(1536), -- OpenAI text-embedding-3-small dimensions
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT unique_chunk UNIQUE (repository_owner, repository_name, file_path, chunk_index)
);

-- Create indexes for fast retrieval (will skip if exist)
CREATE INDEX IF NOT EXISTS idx_code_chunks_repository 
  ON code_chunks(repository_owner, repository_name);

CREATE INDEX IF NOT EXISTS idx_code_chunks_file_path 
  ON code_chunks(repository_owner, repository_name, file_path);

CREATE INDEX IF NOT EXISTS idx_code_chunks_type 
  ON code_chunks(chunk_type);

CREATE INDEX IF NOT EXISTS idx_code_chunks_language 
  ON code_chunks(file_language);

-- Drop existing vector index if it exists
DO $$ 
BEGIN
  DROP INDEX IF EXISTS idx_code_chunks_embedding;
EXCEPTION 
  WHEN undefined_object THEN NULL;
END $$;

-- Create vector index with memory-efficient settings
-- Try IVFFlat first with fewer lists, fall back to simpler index if memory constrained
DO $$ 
BEGIN
  -- Try to increase maintenance_work_mem for this session (if allowed)
  BEGIN
    SET LOCAL maintenance_work_mem = '128MB';
  EXCEPTION 
    WHEN insufficient_privilege THEN 
      RAISE NOTICE 'Could not increase maintenance_work_mem, using default';
  END;
  
  -- Try to create IVFFlat index with fewer lists (requires less memory)
  BEGIN
    CREATE INDEX idx_code_chunks_embedding 
      ON code_chunks USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 50);  -- Reduced from 100 to 50 for lower memory usage
    RAISE NOTICE '✅ Created IVFFlat index with 50 lists';
  EXCEPTION 
    WHEN OTHERS THEN
      RAISE NOTICE '⚠️  IVFFlat index failed (memory constraint), creating basic index instead';
      -- Fall back to basic index (no memory issues, but slower search)
      CREATE INDEX idx_code_chunks_embedding 
        ON code_chunks USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 10);  -- Minimum lists for IVFFlat
      RAISE NOTICE '✅ Created basic IVFFlat index with 10 lists';
  END;
END $$;

-- Create or replace function for cosine similarity search
CREATE OR REPLACE FUNCTION search_code_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10,
  filter_owner text DEFAULT NULL,
  filter_repo text DEFAULT NULL,
  filter_language text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  repository_owner text,
  repository_name text,
  file_path text,
  file_language text,
  chunk_content text,
  chunk_type text,
  chunk_name text,
  start_line integer,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.repository_owner,
    c.repository_name,
    c.file_path,
    c.file_language,
    c.chunk_content,
    c.chunk_type,
    c.chunk_name,
    c.start_line,
    1 - (c.embedding <=> query_embedding) as similarity
  FROM code_chunks c
  WHERE 
    (filter_owner IS NULL OR c.repository_owner = filter_owner)
    AND (filter_repo IS NULL OR c.repository_name = filter_repo)
    AND (filter_language IS NULL OR c.file_language = filter_language)
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create repository indexing status table (will skip if exists)
CREATE TABLE IF NOT EXISTS code_indexing_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  repository_owner TEXT NOT NULL,
  repository_name TEXT NOT NULL,
  repository_branch TEXT DEFAULT 'main',
  
  status TEXT NOT NULL, -- 'pending', 'in_progress', 'completed', 'failed'
  
  -- Statistics
  total_files INTEGER DEFAULT 0,
  indexed_files INTEGER DEFAULT 0,
  total_chunks INTEGER DEFAULT 0,
  indexed_chunks INTEGER DEFAULT 0,
  
  -- Progress
  progress_percentage INTEGER DEFAULT 0,
  current_file TEXT,
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  
  -- Error handling
  error_message TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_repository_index UNIQUE (repository_owner, repository_name, repository_branch)
);

-- Create index on status table (will skip if exists)
CREATE INDEX IF NOT EXISTS idx_indexing_status_repository 
  ON code_indexing_status(repository_owner, repository_name);

CREATE INDEX IF NOT EXISTS idx_indexing_status_status 
  ON code_indexing_status(status);

-- Create or replace function to update indexing status
CREATE OR REPLACE FUNCTION update_indexing_status(
  owner text,
  repo text,
  branch text,
  new_status text,
  files_indexed integer DEFAULT NULL,
  chunks_indexed integer DEFAULT NULL,
  current_file_path text DEFAULT NULL,
  error_msg text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE code_indexing_status
  SET
    status = new_status,
    indexed_files = COALESCE(files_indexed, indexed_files),
    indexed_chunks = COALESCE(chunks_indexed, indexed_chunks),
    current_file = COALESCE(current_file_path, current_file),
    error_message = error_msg,
    progress_percentage = CASE 
      WHEN total_files > 0 THEN (COALESCE(files_indexed, indexed_files) * 100 / total_files)
      ELSE 0
    END,
    completed_at = CASE 
      WHEN new_status IN ('completed', 'failed') THEN NOW()
      ELSE completed_at
    END,
    duration_ms = CASE
      WHEN new_status IN ('completed', 'failed') THEN EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
      ELSE duration_ms
    END,
    updated_at = NOW()
  WHERE
    repository_owner = owner
    AND repository_name = repo
    AND repository_branch = branch;
END;
$$;

-- Create or replace trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop and recreate triggers (safe way)
DO $$ 
BEGIN
  DROP TRIGGER IF EXISTS update_code_chunks_updated_at ON code_chunks;
  DROP TRIGGER IF EXISTS update_indexing_status_updated_at ON code_indexing_status;
END $$;

CREATE TRIGGER update_code_chunks_updated_at 
  BEFORE UPDATE ON code_chunks
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_indexing_status_updated_at 
  BEFORE UPDATE ON code_indexing_status
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE code_chunks IS 'Stores code chunks with vector embeddings for semantic search';
COMMENT ON TABLE code_indexing_status IS 'Tracks indexing progress for repositories';
COMMENT ON FUNCTION search_code_chunks IS 'Performs semantic search on code chunks using cosine similarity';
COMMENT ON FUNCTION update_indexing_status IS 'Helper function to update repository indexing status';

-- Success message
DO $$ 
BEGIN
  RAISE NOTICE '✅ Code Vector Store migration completed successfully!';
END $$;

