-- HeyJarvis Supabase Database Schema
-- This file contains the complete database schema for HeyJarvis
-- Run this in your Supabase SQL editor to set up the database

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

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

-- Companies table (for enterprise organizations)
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  domain VARCHAR(100),
  industry VARCHAR(100),
  size VARCHAR(20),
  headquarters VARCHAR(100),
  website TEXT,
  
  -- Enterprise settings
  sso_provider VARCHAR(50),
  sso_domain VARCHAR(100),
  enforce_sso BOOLEAN DEFAULT false,
  require_2fa BOOLEAN DEFAULT false,
  session_timeout_minutes INTEGER DEFAULT 480,
  
  -- Compliance
  compliance_requirements TEXT[],
  audit_logging BOOLEAN DEFAULT true,
  data_retention_days INTEGER DEFAULT 365,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams table
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  company_id UUID REFERENCES companies(id),
  department VARCHAR(50),
  description TEXT,
  
  -- Subscription
  subscription_tier subscription_tier DEFAULT 'trial',
  subscription_status VARCHAR(20) DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ,
  max_members INTEGER DEFAULT 50,
  
  -- Competitive context
  competitive_context JSONB DEFAULT '{}',
  signal_preferences JSONB DEFAULT '{}',
  
  -- Settings
  shared_learning BOOLEAN DEFAULT true,
  knowledge_base BOOLEAN DEFAULT true,
  signal_retention_days INTEGER DEFAULT 90,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
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
  
  -- Organization
  team_id UUID REFERENCES teams(id),
  company_id UUID REFERENCES companies(id),
  
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
  signal_views INTEGER DEFAULT 0,
  actions_taken INTEGER DEFAULT 0,
  
  -- Account status
  subscription_plan subscription_tier DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

-- Team members junction table
CREATE TABLE team_members (
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role team_role DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  invited_by UUID REFERENCES users(id),
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
  
  -- Quality and trust
  trust_score DECIMAL(3,2) DEFAULT 0.5,
  quality_metrics JSONB DEFAULT '{}',
  
  -- Access control
  is_public BOOLEAN DEFAULT true,
  allowed_teams UUID[],
  created_by_team UUID REFERENCES teams(id),
  
  -- Status
  status source_status DEFAULT 'active',
  last_poll_at TIMESTAMPTZ,
  next_poll_at TIMESTAMPTZ,
  
  -- Metadata
  tags TEXT[],
  priority VARCHAR(10) DEFAULT 'medium',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Signals table
CREATE TABLE signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES sources(id),
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
  sentiment DECIMAL(3,2),
  
  -- Relevance and impact
  relevance_score DECIMAL(3,2),
  impact_assessment JSONB,
  
  -- User interaction
  view_count INTEGER DEFAULT 0,
  action_count INTEGER DEFAULT 0,
  feedback_score DECIMAL(3,2),
  
  -- Delivery tracking
  delivered_to JSONB DEFAULT '[]',
  
  -- Relationships
  related_signals UUID[],
  duplicate_of UUID REFERENCES signals(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  version INTEGER DEFAULT 1
);

-- Feedback table
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) NOT NULL,
  signal_id UUID REFERENCES signals(id) NOT NULL,
  team_id UUID REFERENCES teams(id),
  
  -- Feedback details
  type feedback_type NOT NULL,
  value JSONB, -- Can store boolean, number, or string
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
  signal_id UUID REFERENCES signals(id) NOT NULL,
  user_id UUID REFERENCES users(id) NOT NULL,
  channel VARCHAR(20) NOT NULL, -- 'slack', 'desktop', 'email', 'teams'
  destination VARCHAR(255), -- Channel ID, email, etc.
  
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  acted_on BOOLEAN DEFAULT false,
  
  -- Delivery metadata
  message_id VARCHAR(255), -- External message ID (Slack ts, etc.)
  delivery_metadata JSONB
);

-- Analytics aggregation tables
CREATE TABLE daily_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  user_id UUID REFERENCES users(id),
  team_id UUID REFERENCES teams(id),
  
  -- Signal metrics
  signals_processed INTEGER DEFAULT 0,
  signals_delivered INTEGER DEFAULT 0,
  signals_viewed INTEGER DEFAULT 0,
  signals_acted_on INTEGER DEFAULT 0,
  
  -- Feedback metrics
  positive_feedback INTEGER DEFAULT 0,
  negative_feedback INTEGER DEFAULT 0,
  total_feedback INTEGER DEFAULT 0,
  
  -- Time metrics
  avg_time_per_signal DECIMAL(8,2),
  total_engagement_time INTEGER, -- seconds
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(date, user_id, team_id)
);

-- Indexes for performance
CREATE INDEX idx_signals_user_published ON signals(published_at DESC);
CREATE INDEX idx_signals_category ON signals(category);
CREATE INDEX idx_signals_priority ON signals(priority);
CREATE INDEX idx_signals_source ON signals(source_id);
CREATE INDEX idx_signals_status ON signals(status);
CREATE INDEX idx_signals_relevance ON signals(relevance_score DESC);
CREATE INDEX idx_signals_fts ON signals USING GIN(to_tsvector('english', title || ' ' || COALESCE(summary, '')));

CREATE INDEX idx_feedback_user ON feedback(user_id);
CREATE INDEX idx_feedback_signal ON feedback(signal_id);
CREATE INDEX idx_feedback_created ON feedback(created_at DESC);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_team ON users(team_id);
CREATE INDEX idx_users_active ON users(is_active);

CREATE INDEX idx_sources_status ON sources(status);
CREATE INDEX idx_sources_type ON sources(type);
CREATE INDEX idx_sources_next_poll ON sources(next_poll_at);

CREATE INDEX idx_deliveries_user ON signal_deliveries(user_id);
CREATE INDEX idx_deliveries_signal ON signal_deliveries(signal_id);
CREATE INDEX idx_deliveries_delivered ON signal_deliveries(delivered_at DESC);

-- Row Level Security (RLS) Policies
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_deliveries ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY users_own_data ON users
  FOR ALL USING (auth.uid()::text = id::text);

-- Team members can see team data
CREATE POLICY team_members_access ON teams
  FOR ALL USING (
    id IN (
      SELECT team_id FROM team_members 
      WHERE user_id::text = auth.uid()::text AND is_active = true
    )
  );

-- Signals are visible based on team membership and delivery
CREATE POLICY signals_team_access ON signals
  FOR SELECT USING (
    -- User received this signal
    id IN (
      SELECT signal_id FROM signal_deliveries 
      WHERE user_id::text = auth.uid()::text
    )
    OR
    -- User is in a team that has access to the source
    source_id IN (
      SELECT s.id FROM sources s
      WHERE s.is_public = true
      OR s.created_by_team IN (
        SELECT team_id FROM team_members 
        WHERE user_id::text = auth.uid()::text AND is_active = true
      )
    )
  );

-- Feedback policies
CREATE POLICY feedback_own_data ON feedback
  FOR ALL USING (user_id::text = auth.uid()::text);

-- Source policies
CREATE POLICY sources_team_access ON sources
  FOR ALL USING (
    is_public = true
    OR created_by_team IN (
      SELECT team_id FROM team_members 
      WHERE user_id::text = auth.uid()::text AND is_active = true
    )
  );

-- Signal delivery policies
CREATE POLICY deliveries_own_data ON signal_deliveries
  FOR ALL USING (user_id::text = auth.uid()::text);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_signals_updated_at BEFORE UPDATE ON signals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sources_updated_at BEFORE UPDATE ON sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Functions for analytics
CREATE OR REPLACE FUNCTION get_user_signal_counts(user_id UUID, timeframe TEXT DEFAULT '30 days')
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT json_build_object(
      'total', COUNT(*),
      'by_priority', json_object_agg(priority, count),
      'by_category', json_object_agg(category, count)
    )
    FROM (
      SELECT 
        priority,
        category,
        COUNT(*) as count
      FROM signals s
      JOIN signal_deliveries sd ON s.id = sd.signal_id
      WHERE sd.user_id = $1
        AND s.created_at > NOW() - INTERVAL '1' || $2
      GROUP BY GROUPING SETS ((priority), (category), ())
    ) grouped
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_feedback_metrics(user_id UUID, timeframe TEXT DEFAULT '30 days')
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT json_build_object(
      'total_feedback', COUNT(*),
      'positive_feedback', COUNT(*) FILTER (WHERE (value->>'helpful')::boolean = true),
      'feedback_rate', ROUND(COUNT(*)::decimal / GREATEST(1, (
        SELECT COUNT(*) FROM signal_deliveries sd2 
        WHERE sd2.user_id = $1 AND sd2.delivered_at > NOW() - INTERVAL '1' || $2
      )), 3)
    )
    FROM feedback f
    WHERE f.user_id = $1
      AND f.created_at > NOW() - INTERVAL '1' || $2
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sample data for testing (optional)
INSERT INTO companies (id, name, domain, industry, size) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'Demo Company', 'demo.com', 'Technology', 'medium');

INSERT INTO teams (id, name, slug, company_id, created_by) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Product Team', 'product-team', '550e8400-e29b-41d4-a716-446655440000', null);

INSERT INTO sources (id, name, type, category, url, is_public, trust_score) VALUES
  ('550e8400-e29b-41d4-a716-446655440002', 'TechCrunch', 'rss', 'industry', 'https://techcrunch.com/feed/', true, 0.8),
  ('550e8400-e29b-41d4-a716-446655440003', 'Hacker News', 'rss', 'technical', 'https://hnrss.org/frontpage', true, 0.7);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Enable real-time for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE signals;
ALTER PUBLICATION supabase_realtime ADD TABLE feedback;
ALTER PUBLICATION supabase_realtime ADD TABLE signal_deliveries;
