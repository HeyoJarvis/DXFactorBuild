-- Email Vector Store Migration
-- Creates tables for storing email embeddings and enabling semantic search

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Email Chunks Table
-- Stores email messages with their vector embeddings for semantic search
CREATE TABLE IF NOT EXISTS email_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User and email identification
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL, -- External message ID from provider
  thread_id TEXT, -- Email thread ID if available

  -- Provider information
  provider TEXT NOT NULL CHECK (provider IN ('gmail', 'outlook', 'linkedin')),
  provider_account TEXT, -- The specific account (for users with multiple)

  -- Email metadata
  from_address TEXT NOT NULL,
  from_name TEXT,
  to_addresses TEXT[], -- Array of recipient emails
  cc_addresses TEXT[],
  subject TEXT NOT NULL,

  -- Email content
  body_text TEXT NOT NULL, -- Plain text body
  body_html TEXT, -- HTML body if available
  body_preview TEXT, -- Short preview (first 200 chars)

  -- Categorization
  tags TEXT[], -- e.g., ['sales', 'urgent', 'follow-up']
  category TEXT, -- e.g., 'sales', 'support', 'marketing'

  -- Timestamps
  sent_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ,

  -- Vector embedding (1536 dimensions for OpenAI text-embedding-3-small)
  embedding vector(1536),

  -- Additional metadata
  token_count INTEGER,
  has_attachments BOOLEAN DEFAULT false,
  attachment_names TEXT[],
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,

  -- Metadata JSON for flexible storage
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  indexed_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_user_message UNIQUE (user_id, provider, message_id)
);

-- Email Indexing Status Table
-- Tracks the status of email indexing for each user and provider
CREATE TABLE IF NOT EXISTS email_indexing_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('gmail', 'outlook', 'linkedin')),
  provider_account TEXT,

  -- Status tracking
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'paused')),

  -- Progress metrics
  total_emails INTEGER DEFAULT 0,
  indexed_emails INTEGER DEFAULT 0,
  failed_emails INTEGER DEFAULT 0,
  progress_percentage INTEGER DEFAULT 0,

  -- Current processing info
  current_email_subject TEXT,
  current_batch_number INTEGER DEFAULT 0,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- Error tracking
  error_message TEXT,
  error_count INTEGER DEFAULT 0,
  last_error_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_user_provider UNIQUE (user_id, provider, provider_account)
);

-- Indexes for performance

-- User lookup (most common query)
CREATE INDEX IF NOT EXISTS idx_email_chunks_user_id
  ON email_chunks(user_id);

-- Provider filtering
CREATE INDEX IF NOT EXISTS idx_email_chunks_provider
  ON email_chunks(provider);

-- Message ID lookup for deduplication
CREATE INDEX IF NOT EXISTS idx_email_chunks_message_id
  ON email_chunks(user_id, provider, message_id);

-- Thread grouping
CREATE INDEX IF NOT EXISTS idx_email_chunks_thread_id
  ON email_chunks(thread_id)
  WHERE thread_id IS NOT NULL;

-- Date range queries (most recent emails)
CREATE INDEX IF NOT EXISTS idx_email_chunks_sent_at
  ON email_chunks(sent_at DESC);

-- Category filtering
CREATE INDEX IF NOT EXISTS idx_email_chunks_category
  ON email_chunks(category)
  WHERE category IS NOT NULL;

-- Tags filtering (GIN index for array containment)
CREATE INDEX IF NOT EXISTS idx_email_chunks_tags
  ON email_chunks USING GIN(tags);

-- Vector similarity search (IVFFlat index)
-- This index dramatically speeds up similarity searches
-- Lists parameter (100) can be tuned based on dataset size
CREATE INDEX IF NOT EXISTS idx_email_chunks_embedding
  ON email_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Composite index for user + date queries
CREATE INDEX IF NOT EXISTS idx_email_chunks_user_sent
  ON email_chunks(user_id, sent_at DESC);

-- Status tracking indexes
CREATE INDEX IF NOT EXISTS idx_email_indexing_status_user
  ON email_indexing_status(user_id);

CREATE INDEX IF NOT EXISTS idx_email_indexing_status_provider
  ON email_indexing_status(user_id, provider);

-- Vector Similarity Search Function
-- RPC function for semantic email search
CREATE OR REPLACE FUNCTION search_email_chunks(
  query_embedding vector(1536),
  search_user_id UUID,
  search_provider TEXT DEFAULT NULL,
  search_category TEXT DEFAULT NULL,
  search_tags TEXT[] DEFAULT NULL,
  date_from TIMESTAMPTZ DEFAULT NULL,
  date_to TIMESTAMPTZ DEFAULT NULL,
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  message_id TEXT,
  provider TEXT,
  from_address TEXT,
  from_name TEXT,
  subject TEXT,
  body_preview TEXT,
  tags TEXT[],
  category TEXT,
  sent_at TIMESTAMPTZ,
  similarity FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ec.id,
    ec.message_id,
    ec.provider,
    ec.from_address,
    ec.from_name,
    ec.subject,
    ec.body_preview,
    ec.tags,
    ec.category,
    ec.sent_at,
    1 - (ec.embedding <=> query_embedding) AS similarity,
    ec.metadata
  FROM email_chunks ec
  WHERE
    ec.user_id = search_user_id
    AND (search_provider IS NULL OR ec.provider = search_provider)
    AND (search_category IS NULL OR ec.category = search_category)
    AND (search_tags IS NULL OR ec.tags && search_tags) -- Array overlap operator
    AND (date_from IS NULL OR ec.sent_at >= date_from)
    AND (date_to IS NULL OR ec.sent_at <= date_to)
    AND ec.embedding IS NOT NULL
    AND 1 - (ec.embedding <=> query_embedding) >= match_threshold
  ORDER BY ec.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to get email statistics for a user
CREATE OR REPLACE FUNCTION get_user_email_stats(search_user_id UUID)
RETURNS TABLE (
  total_emails BIGINT,
  indexed_emails BIGINT,
  providers JSONB,
  categories JSONB,
  date_range JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_emails,
    COUNT(ec.embedding) as indexed_emails,
    jsonb_object_agg(
      ec.provider,
      COUNT(*)
    ) as providers,
    jsonb_object_agg(
      COALESCE(ec.category, 'uncategorized'),
      COUNT(*)
    ) as categories,
    jsonb_build_object(
      'earliest', MIN(ec.sent_at),
      'latest', MAX(ec.sent_at)
    ) as date_range
  FROM email_chunks ec
  WHERE ec.user_id = search_user_id
  GROUP BY ec.user_id;
END;
$$;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_email_chunks_updated_at
  BEFORE UPDATE ON email_chunks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_indexing_status_updated_at
  BEFORE UPDATE ON email_indexing_status
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE email_chunks IS 'Stores email messages with vector embeddings for semantic search';
COMMENT ON TABLE email_indexing_status IS 'Tracks email indexing progress for each user and provider';
COMMENT ON FUNCTION search_email_chunks IS 'Performs semantic similarity search on email embeddings';
COMMENT ON FUNCTION get_user_email_stats IS 'Returns statistics about indexed emails for a user';
