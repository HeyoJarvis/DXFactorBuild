-- HeyJarvis Improved Supabase Database Schema
-- Production-ready schema with performance optimizations and data integrity
-- Run this in your Supabase SQL editor to set up the database

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- For query performance monitoring

-- Create custom types
CREATE TYPE signal_priority AS ENUM ('critical', 'high', 'medium', 'low', 'fyi');
CREATE TYPE signal_category AS ENUM (
  'product_launch', 'funding', 'acquisition', 'partnership', 
  'leadership_change', 'market_expansion', 'technology_update', 
  'pricing_change', 'security_incident', 'regulatory_change', 
  'competitive_analysis', 'industry_trend'
);
CREATE TYPE trust_level AS ENUM ('verified', 'official', 'reliable', 'unverified');
CREATE TYPE processing_status AS ENUM ('raw', 'enriching', 'scoring', 'ready', 'delivered', 'archived', 'error');
CREATE TYPE source_type AS ENUM ('rss', 'api', 'webhook', 'scraper', 'email', 'social', 'news', 'financial', 'patent', 'github');
CREATE TYPE source_status AS ENUM ('active', 'paused', 'error', 'rate_limited', 'unauthorized', 'not_found', 'disabled');
CREATE TYPE feedback_type AS ENUM (
  'explicit_rating', 'relevance_score', 'view', 'click', 'action', 
  'dismiss', 'snooze', 'flag', 'share', 'create_task', 
  'mute_source', 'mute_category', 'time_spent'
);
CREATE TYPE user_role AS ENUM (
  'executive', 'product_manager', 'marketing_manager', 'sales_manager', 
  'engineer', 'analyst', 'consultant', 'founder', 'investor'
);
CREATE TYPE team_role AS ENUM ('owner', 'admin', 'manager', 'member', 'viewer');
CREATE TYPE subscription_tier AS ENUM ('trial', 'individual', 'team', 'enterprise');

-- ==============================================
-- CORE TABLES
-- ==============================================

-- Companies table (for enterprise organizations)
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  domain VARCHAR(100),
  industry VARCHAR(100),
  size VARCHAR(20) CHECK (size IN ('startup', 'small', 'medium', 'large', 'enterprise')),
  headquarters VARCHAR(100),
  website TEXT,
  
  -- Enterprise settings
  sso_provider VARCHAR(50),
  sso_domain VARCHAR(100),
  enforce_sso BOOLEAN DEFAULT false,
  require_2fa BOOLEAN DEFAULT false,
  session_timeout_minutes INTEGER DEFAULT 480 CHECK (session_timeout_minutes > 0),
  
  -- Compliance
  compliance_requirements TEXT[],
  audit_logging BOOLEAN DEFAULT true,
  data_retention_days INTEGER DEFAULT 365 CHECK (data_retention_days > 0),
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams table
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  department VARCHAR(50),
  description TEXT,
  
  -- Subscription
  subscription_tier subscription_tier DEFAULT 'trial',
  subscription_status VARCHAR(20) DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ,
  max_members INTEGER DEFAULT 50 CHECK (max_members > 0),
  
  -- Competitive context
  competitive_context JSONB DEFAULT '{}',
  signal_preferences JSONB DEFAULT '{}',
  
  -- Settings
  shared_learning BOOLEAN DEFAULT true,
  knowledge_base BOOLEAN DEFAULT true,
  signal_retention_days INTEGER DEFAULT 90 CHECK (signal_retention_days > 0),
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  
  -- Ensure slug is lowercase
  CONSTRAINT slug_lowercase CHECK (slug = LOWER(slug))
);

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  
  -- Authentication
  auth_provider VARCHAR(20) DEFAULT 'email',
  auth_id VARCHAR(100),
  email_verified BOOLEAN DEFAULT false,
  
  -- Organization (with proper cascade behavior)
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Profile and context
  user_role user_role,
  seniority VARCHAR(20),
  department VARCHAR(50),
  context JSONB DEFAULT '{}',
  
  -- Preferences
  notifications JSONB DEFAULT '{}',
  work_schedule JSONB DEFAULT '{}',
  learning_profile JSONB DEFAULT '{}',
  integrations JSONB DEFAULT '{}',
  
  -- Usage tracking
  onboarding_completed BOOLEAN DEFAULT false,
  last_active TIMESTAMPTZ,
  signal_views INTEGER DEFAULT 0 CHECK (signal_views >= 0),
  actions_taken INTEGER DEFAULT 0 CHECK (actions_taken >= 0),
  
  -- Account status
  subscription_plan subscription_tier DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  
  -- Version for optimistic locking
  version INTEGER DEFAULT 1,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  
  -- Ensure email is lowercase
  CONSTRAINT email_lowercase CHECK (email = LOWER(email))
);

-- Team members junction table
CREATE TABLE team_members (
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role team_role DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  PRIMARY KEY (team_id, user_id)
);

-- Sources table
CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  type source_type NOT NULL,
  category VARCHAR(20) NOT NULL,
  url TEXT NOT NULL,
  homepage TEXT,
  
  -- Configuration
  polling_config JSONB DEFAULT '{}',
  extraction_config JSONB DEFAULT '{}',
  auth_config JSONB DEFAULT '{}',
  
  -- Targeting
  target_companies TEXT[],
  target_keywords TEXT[],
  exclude_keywords TEXT[],
  
  -- Quality and trust (with constraints)
  trust_score DECIMAL(3,2) DEFAULT 0.5 CHECK (trust_score >= 0 AND trust_score <= 1),
  quality_metrics JSONB DEFAULT '{}',
  
  -- Access control
  is_public BOOLEAN DEFAULT true,
  allowed_teams UUID[],
  created_by_team UUID REFERENCES teams(id) ON DELETE SET NULL,
  
  -- Status
  status source_status DEFAULT 'active',
  last_poll_at TIMESTAMPTZ,
  next_poll_at TIMESTAMPTZ,
  consecutive_errors INTEGER DEFAULT 0 CHECK (consecutive_errors >= 0),
  
  -- Metadata
  tags TEXT[],
  priority VARCHAR(10) DEFAULT 'medium',
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Signals table
CREATE TABLE signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
  external_id VARCHAR(255),
  
  -- Content
  title VARCHAR(500) NOT NULL,
  summary TEXT,
  content TEXT,
  url TEXT NOT NULL,
  
  -- Classification
  category signal_category NOT NULL,
  priority signal_priority DEFAULT 'medium',
  trust_level trust_level DEFAULT 'unverified',
  language VARCHAR(5) DEFAULT 'en',
  
  -- Timing
  published_at TIMESTAMPTZ NOT NULL,
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  
  -- Processing
  status processing_status DEFAULT 'raw',
  processing_errors TEXT[],
  
  -- Enrichment
  entities JSONB DEFAULT '[]',
  keywords TEXT[],
  topics TEXT[],
  sentiment DECIMAL(3,2) CHECK (sentiment >= -1 AND sentiment <= 1),
  
  -- Relevance and impact (with constraints)
  relevance_score DECIMAL(3,2) CHECK (relevance_score >= 0 AND relevance_score <= 1),
  impact_assessment JSONB,
  
  -- User interaction
  view_count INTEGER DEFAULT 0 CHECK (view_count >= 0),
  action_count INTEGER DEFAULT 0 CHECK (action_count >= 0),
  feedback_score DECIMAL(3,2) CHECK (feedback_score >= 0 AND feedback_score <= 1),
  
  -- Delivery tracking
  delivered_to JSONB DEFAULT '[]',
  
  -- Relationships
  related_signals UUID[],
  duplicate_of UUID REFERENCES signals(id) ON DELETE SET NULL,
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  
  -- Version for optimistic locking
  version INTEGER DEFAULT 1,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint for external sources
  UNIQUE(source_id, external_id)
);

-- Feedback table
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  signal_id UUID REFERENCES signals(id) ON DELETE CASCADE NOT NULL,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  
  -- Feedback details
  type feedback_type NOT NULL,
  value JSONB,
  comment TEXT,
  
  -- Context
  context JSONB DEFAULT '{}',
  
  -- Signal metadata at time of feedback
  signal_metadata JSONB,
  user_metadata JSONB,
  
  -- Processing
  processed BOOLEAN DEFAULT false,
  used_for_training BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- Signal delivery tracking
CREATE TABLE signal_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  signal_id UUID REFERENCES signals(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('slack', 'desktop', 'email', 'teams', 'webhook')),
  destination VARCHAR(255),
  
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  acted_on BOOLEAN DEFAULT false,
  
  -- Delivery metadata
  message_id VARCHAR(255),
  delivery_metadata JSONB,
  
  -- Ensure read_at is after delivered_at
  CONSTRAINT read_after_delivered CHECK (read_at IS NULL OR read_at >= delivered_at)
);

-- ==============================================
-- CHAT SYSTEM TABLES
-- ==============================================

-- Chat conversations
CREATE TABLE chat_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(200),
  
  -- Conversation metadata
  message_count INTEGER DEFAULT 0 CHECK (message_count >= 0),
  total_tokens INTEGER DEFAULT 0 CHECK (total_tokens >= 0),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Context and settings
  context JSONB DEFAULT '{}',
  model_settings JSONB DEFAULT '{}',
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_archived BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  
  -- Message content
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  
  -- AI model metadata
  model_name VARCHAR(50),
  tokens_used INTEGER CHECK (tokens_used >= 0),
  processing_time_ms INTEGER CHECK (processing_time_ms >= 0),
  
  -- Context and attachments
  context JSONB DEFAULT '{}',
  attachments JSONB DEFAULT '[]',
  
  -- Message metadata
  edited_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User sessions for authentication
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  session_token VARCHAR(500) UNIQUE NOT NULL,
  
  -- Session metadata
  ip_address INET,
  user_agent TEXT,
  device_info JSONB,
  
  -- Session status
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure expires_at is in the future when created
  CONSTRAINT expires_in_future CHECK (expires_at > created_at)
);

-- ==============================================
-- SLACK INTEGRATION TABLES
-- ==============================================

-- Slack Conversations
CREATE TABLE slack_conversations (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('public', 'private', 'dm', 'group')),
  messages JSONB NOT NULL DEFAULT '[]',
  participants JSONB NOT NULL DEFAULT '[]',
  relevance_score DECIMAL(3,2) NOT NULL CHECK (relevance_score >= 0 AND relevance_score <= 1),
  key_topics TEXT[] DEFAULT '{}',
  action_items TEXT[] DEFAULT '{}',
  conversation_type TEXT DEFAULT 'general',
  summary TEXT,
  captured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversation Contexts
CREATE TABLE conversation_contexts (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES slack_conversations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  context_type TEXT NOT NULL DEFAULT 'slack_conversation',
  source_data JSONB NOT NULL DEFAULT '{}',
  context_prompt TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_count INTEGER DEFAULT 0 CHECK (used_count >= 0),
  last_used_at TIMESTAMPTZ,
  
  -- Ensure expires_at is in the future
  CONSTRAINT context_expires_in_future CHECK (expires_at > created_at)
);

-- ==============================================
-- ANALYTICS TABLES
-- ==============================================

-- Daily metrics aggregation
CREATE TABLE daily_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  
  -- Signal metrics
  signals_processed INTEGER DEFAULT 0 CHECK (signals_processed >= 0),
  signals_delivered INTEGER DEFAULT 0 CHECK (signals_delivered >= 0),
  signals_viewed INTEGER DEFAULT 0 CHECK (signals_viewed >= 0),
  signals_acted_on INTEGER DEFAULT 0 CHECK (signals_acted_on >= 0),
  
  -- Feedback metrics
  positive_feedback INTEGER DEFAULT 0 CHECK (positive_feedback >= 0),
  negative_feedback INTEGER DEFAULT 0 CHECK (negative_feedback >= 0),
  total_feedback INTEGER DEFAULT 0 CHECK (total_feedback >= 0),
  
  -- Time metrics
  avg_time_per_signal DECIMAL(8,2) CHECK (avg_time_per_signal >= 0),
  total_engagement_time INTEGER CHECK (total_engagement_time >= 0),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(date, user_id, team_id)
);

-- ==============================================
-- INDEXES FOR PERFORMANCE
-- ==============================================

-- Signals indexes
CREATE INDEX idx_signals_published ON signals(published_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_signals_category ON signals(category) WHERE deleted_at IS NULL;
CREATE INDEX idx_signals_priority ON signals(priority) WHERE deleted_at IS NULL;
CREATE INDEX idx_signals_source ON signals(source_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_signals_status ON signals(status);
CREATE INDEX idx_signals_relevance ON signals(relevance_score DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_signals_user_priority ON signals(published_at DESC, priority, category) WHERE deleted_at IS NULL;
CREATE INDEX idx_signals_fts ON signals USING GIN(to_tsvector('english', title || ' ' || COALESCE(summary, ''))) WHERE deleted_at IS NULL;

-- Feedback indexes
CREATE INDEX idx_feedback_user ON feedback(user_id);
CREATE INDEX idx_feedback_signal ON feedback(signal_id);
CREATE INDEX idx_feedback_created ON feedback(created_at DESC);
CREATE INDEX idx_feedback_team_unprocessed ON feedback(team_id, created_at DESC) WHERE processed = false;

-- Users indexes
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_team ON users(team_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_active ON users(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_last_active ON users(last_active DESC) WHERE is_active = true;

-- Sources indexes
CREATE INDEX idx_sources_status ON sources(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_sources_type ON sources(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_sources_next_poll ON sources(next_poll_at) WHERE status = 'active' AND deleted_at IS NULL;

-- Deliveries indexes
CREATE INDEX idx_deliveries_user ON signal_deliveries(user_id);
CREATE INDEX idx_deliveries_signal ON signal_deliveries(signal_id);
CREATE INDEX idx_deliveries_delivered ON signal_deliveries(delivered_at DESC);
CREATE INDEX idx_deliveries_user_channel ON signal_deliveries(user_id, channel, delivered_at DESC);
CREATE INDEX idx_deliveries_unread ON signal_deliveries(user_id, delivered_at DESC) WHERE read_at IS NULL;

-- Chat indexes
CREATE INDEX idx_conversations_user ON chat_conversations(user_id);
CREATE INDEX idx_conversations_active ON chat_conversations(user_id, is_active, last_message_at DESC);
CREATE INDEX idx_messages_conversation ON chat_messages(conversation_id, created_at);
CREATE INDEX idx_messages_user ON chat_messages(user_id);

-- Session indexes
CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_sessions_active ON user_sessions(is_active, expires_at) WHERE is_active = true;

-- Slack indexes
CREATE INDEX idx_slack_conversations_relevance ON slack_conversations(relevance_score DESC);
CREATE INDEX idx_slack_conversations_channel ON slack_conversations(channel_id);
CREATE INDEX idx_slack_conversations_created ON slack_conversations(created_at DESC);
CREATE INDEX idx_conversation_contexts_expires ON conversation_contexts(expires_at);

-- ==============================================
-- TRIGGERS
-- ==============================================

-- Update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_signals_updated_at BEFORE UPDATE ON signals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sources_updated_at BEFORE UPDATE ON sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON chat_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_slack_conversations_updated_at BEFORE UPDATE ON slack_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Increment version for optimistic locking
CREATE OR REPLACE FUNCTION increment_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER signals_version_trigger BEFORE UPDATE ON signals
  FOR EACH ROW EXECUTE FUNCTION increment_version();

CREATE TRIGGER users_version_trigger BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION increment_version();

-- Update conversation stats
CREATE OR REPLACE FUNCTION update_conversation_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_conversations 
  SET 
    message_count = (
      SELECT COUNT(*) FROM chat_messages 
      WHERE conversation_id = NEW.conversation_id AND is_deleted = false
    ),
    last_message_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_stats_trigger
  AFTER INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_stats();

-- ==============================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================

-- Enable RLS on all tables
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_contexts ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY users_own_data ON users
  FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY users_insert_during_oauth ON users
  FOR INSERT WITH CHECK (true);

CREATE POLICY users_update_own ON users
  FOR UPDATE USING (auth.uid()::text = id::text);

-- Team policies
CREATE POLICY team_members_access ON teams
  FOR ALL USING (
    id IN (
      SELECT team_id FROM team_members 
      WHERE user_id::text = auth.uid()::text AND is_active = true
    )
  );

-- Signals policies (simplified for performance)
CREATE POLICY signals_access ON signals
  FOR SELECT USING (
    deleted_at IS NULL AND (
      id IN (
        SELECT signal_id FROM signal_deliveries 
        WHERE user_id::text = auth.uid()::text
      )
    )
  );

-- Feedback policies
CREATE POLICY feedback_own_data ON feedback
  FOR ALL USING (user_id::text = auth.uid()::text);

-- Source policies
CREATE POLICY sources_access ON sources
  FOR SELECT USING (
    deleted_at IS NULL AND (
      is_public = true
      OR created_by_team IN (
        SELECT team_id FROM team_members 
        WHERE user_id::text = auth.uid()::text AND is_active = true
      )
    )
  );

-- Delivery policies
CREATE POLICY deliveries_own_data ON signal_deliveries
  FOR ALL USING (user_id::text = auth.uid()::text);

-- Chat policies
CREATE POLICY conversations_own_data ON chat_conversations
  FOR ALL USING (user_id::text = auth.uid()::text);

CREATE POLICY messages_own_data ON chat_messages
  FOR ALL USING (user_id::text = auth.uid()::text);

-- Session policies
CREATE POLICY sessions_own_data ON user_sessions
  FOR ALL USING (user_id::text = auth.uid()::text);

-- Slack conversation policies (team-wide visibility)
CREATE POLICY slack_conversations_read ON slack_conversations
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY slack_conversations_write ON slack_conversations
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY conversation_contexts_read ON conversation_contexts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY conversation_contexts_write ON conversation_contexts
  FOR ALL USING (auth.role() = 'service_role');

-- ==============================================
-- UTILITY FUNCTIONS
-- ==============================================

-- Clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  UPDATE user_sessions 
  SET is_active = false 
  WHERE expires_at < NOW() AND is_active = true;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Archive old signals
CREATE OR REPLACE FUNCTION archive_old_signals(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  UPDATE signals 
  SET status = 'archived'
  WHERE published_at < NOW() - INTERVAL '1 day' * retention_days
    AND status != 'archived'
    AND deleted_at IS NULL;
  
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Get user engagement score
CREATE OR REPLACE FUNCTION get_user_engagement_score(p_user_id UUID, days INTEGER DEFAULT 30)
RETURNS DECIMAL AS $$
BEGIN
  RETURN (
    SELECT 
      ROUND(
        (COUNT(*) FILTER (WHERE read_at IS NOT NULL)::DECIMAL / NULLIF(COUNT(*), 0)) * 100,
        2
      )
    FROM signal_deliveries
    WHERE user_id = p_user_id
      AND delivered_at > NOW() - INTERVAL '1 day' * days
  );
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- SAMPLE DATA (Optional - for testing)
-- ==============================================

-- Create demo company
INSERT INTO companies (id, name, domain, industry, size) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'Demo Company', 'demo.com', 'Technology', 'medium')
ON CONFLICT (id) DO NOTHING;

-- Create demo team
INSERT INTO teams (id, name, slug, company_id, competitive_context) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Product Team', 'product-team', 
   '550e8400-e29b-41d4-a716-446655440000',
   '{"primary_competitors": ["OpenAI", "Anthropic"], "focus_areas": ["AI", "competitive intelligence"]}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Create sample sources
INSERT INTO sources (id, name, type, category, url, is_public, trust_score) VALUES
  ('550e8400-e29b-41d4-a716-446655440002', 'TechCrunch', 'rss', 'industry', 'https://techcrunch.com/feed/', true, 0.8),
  ('550e8400-e29b-41d4-a716-446655440003', 'Hacker News', 'rss', 'technical', 'https://hnrss.org/frontpage', true, 0.7)
ON CONFLICT (id) DO NOTHING;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE signals;
ALTER PUBLICATION supabase_realtime ADD TABLE feedback;
ALTER PUBLICATION supabase_realtime ADD TABLE signal_deliveries;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE slack_conversations;

-- ==============================================
-- SCHEMA COMPLETE
-- ==============================================

COMMENT ON TABLE signals IS 'Competitive intelligence signals from various sources';
COMMENT ON TABLE sources IS 'Data sources for signal ingestion (RSS, APIs, webhooks)';
COMMENT ON TABLE feedback IS 'User feedback for AI learning and relevance tuning';
COMMENT ON TABLE chat_conversations IS 'Chat conversation history for AI assistant';
COMMENT ON TABLE slack_conversations IS 'Captured Slack conversations with relevance scoring';

