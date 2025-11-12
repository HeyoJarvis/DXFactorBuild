-- =====================================================
-- HEYJARVIS SUPABASE DATABASE SETUP
-- Complete schema for JIRA-focused project management
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE user_role AS ENUM ('developer', 'admin', 'pm', 'functional', 'sales');
CREATE TYPE subscription_tier AS ENUM ('trial', 'starter', 'professional', 'enterprise');
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'completed', 'cancelled');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- =====================================================
-- USERS TABLE
-- Links to Supabase Auth, stores user profiles
-- =====================================================

CREATE TABLE IF NOT EXISTS public.users (
  -- Core identity (linked to Supabase Auth)
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  
  -- Role determines app features and UI
  user_role user_role NOT NULL DEFAULT 'developer',
  
  -- Organization
  company_name TEXT,
  department TEXT,
  
  -- Primary auth provider
  primary_auth_provider TEXT DEFAULT 'email', -- email, slack, microsoft, google
  
  -- Integration settings (OAuth tokens stored encrypted)
  integration_settings JSONB DEFAULT '{}'::jsonb,
  -- Structure: {
  --   "jira": { "access_token": "...", "refresh_token": "...", "site_url": "...", "cloud_id": "..." },
  --   "confluence": { "access_token": "...", "refresh_token": "..." }
  -- }
  
  -- Subscription & Billing
  subscription_plan subscription_tier DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ,
  subscription_ends_at TIMESTAMPTZ,
  
  -- Onboarding tracking
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_step TEXT DEFAULT 'welcome',
  onboarding_completed_at TIMESTAMPTZ,
  
  -- Usage tracking
  last_active_at TIMESTAMPTZ,
  total_tasks_created INTEGER DEFAULT 0,
  total_ai_messages INTEGER DEFAULT 0,
  
  -- Account status
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for users
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(user_role);
CREATE INDEX IF NOT EXISTS idx_users_active ON public.users(is_active) WHERE is_active = true;

-- =====================================================
-- CONVERSATION SESSIONS TABLE
-- Stores tasks/conversations (JIRA-synced and manual)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.conversation_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Ownership
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Task details
  session_title TEXT NOT NULL,
  session_type TEXT DEFAULT 'task', -- 'task', 'jira', 'manual'
  
  -- Status and priority
  is_active BOOLEAN DEFAULT true, -- Whether the task is active (not archived)
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  
  -- Workflow type (used for filtering)
  workflow_type TEXT DEFAULT 'task', -- 'task', 'calendar', 'outreach'
  
  -- JIRA integration fields
  external_id TEXT, -- JIRA issue ID
  external_key TEXT, -- JIRA issue key (e.g., PROJ-123)
  external_url TEXT, -- Link to JIRA issue
  external_source TEXT, -- 'jira', 'manual'
  jira_deleted BOOLEAN DEFAULT false, -- Track if deleted in JIRA
  
  -- Workflow metadata (stores all JIRA-specific data)
  workflow_metadata JSONB DEFAULT '{}'::jsonb,
  -- Structure: {
  --   "jira_status": "In Progress",
  --   "jira_issue_type": "Story",
  --   "jira_priority": "High",
  --   "story_points": 5,
  --   "sprint": "Sprint 23",
  --   "labels": ["backend", "api"],
  --   "assignee": "John Doe",
  --   "assignor": "Jane Smith",
  --   "mentioned_users": ["user1", "user2"],
  --   "description": "Full description",
  --   "priority": "high",
  --   "tags": ["urgent"],
  --   "due_date": "2025-12-31",
  --   "work_type": "task",
  --   "route_to": "tasks"
  -- }
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for conversation_sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.conversation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON public.conversation_sessions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sessions_completed ON public.conversation_sessions(is_completed);
CREATE INDEX IF NOT EXISTS idx_sessions_workflow_type ON public.conversation_sessions(workflow_type);
CREATE INDEX IF NOT EXISTS idx_sessions_external ON public.conversation_sessions(external_source, external_id);
CREATE INDEX IF NOT EXISTS idx_sessions_external_key ON public.conversation_sessions(external_key);
CREATE INDEX IF NOT EXISTS idx_sessions_jira_deleted ON public.conversation_sessions(jira_deleted) WHERE jira_deleted = false;
CREATE INDEX IF NOT EXISTS idx_sessions_created ON public.conversation_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_updated ON public.conversation_sessions(updated_at DESC);

-- =====================================================
-- CONVERSATION MESSAGES TABLE
-- Stores AI chat messages for each task
-- =====================================================

CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Relationship to session (task)
  session_id UUID NOT NULL REFERENCES public.conversation_sessions(id) ON DELETE CASCADE,
  
  -- Message details
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  
  -- AI metadata
  model TEXT, -- e.g., 'claude-3-sonnet-20240229'
  tokens_used INTEGER,
  
  -- Message metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for conversation_messages
CREATE INDEX IF NOT EXISTS idx_messages_session ON public.conversation_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.conversation_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_role ON public.conversation_messages(role);

-- =====================================================
-- REPORTS TABLE
-- Stores generated reports (Feature/Epic reports)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Ownership
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Report details
  report_type TEXT NOT NULL CHECK (report_type IN ('feature', 'person', 'team', 'unit')),
  entity_id TEXT NOT NULL, -- Epic key for feature reports
  title TEXT NOT NULL,
  
  -- Report content
  content JSONB NOT NULL,
  -- Structure: {
  --   "summary": "...",
  --   "metrics": { "total_tasks": 10, "completed": 5, "in_progress": 3, "todo": 2 },
  --   "tasks": [...],
  --   "timeline": [...],
  --   "insights": [...]
  -- }
  
  -- Status
  status TEXT DEFAULT 'completed' CHECK (status IN ('generating', 'completed', 'failed')),
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for reports
CREATE INDEX IF NOT EXISTS idx_reports_user ON public.reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_type ON public.reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_entity ON public.reports(entity_id);
CREATE INDEX IF NOT EXISTS idx_reports_created ON public.reports(created_at DESC);

-- =====================================================
-- USER ACTIVITY TABLE
-- Tracks user actions for analytics
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Activity details
  activity_type TEXT NOT NULL, -- 'task_created', 'task_completed', 'jira_synced', 'report_generated', etc.
  activity_data JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for user_activity
CREATE INDEX IF NOT EXISTS idx_activity_user ON public.user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_type ON public.user_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_created ON public.user_activity(created_at DESC);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to users table
CREATE TRIGGER users_updated_at_trigger
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply to conversation_sessions table
CREATE TRIGGER sessions_updated_at_trigger
  BEFORE UPDATE ON public.conversation_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply to reports table
CREATE TRIGGER reports_updated_at_trigger
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-set completed_at when task is marked complete
CREATE OR REPLACE FUNCTION set_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_completed = true AND OLD.is_completed = false THEN
    NEW.completed_at = NOW();
  ELSIF NEW.is_completed = false AND OLD.is_completed = true THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sessions_completed_at_trigger
  BEFORE UPDATE ON public.conversation_sessions
  FOR EACH ROW
  EXECUTE FUNCTION set_completed_at();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

-- Users: Can only see their own profile
CREATE POLICY users_select_own ON public.users
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY users_update_own ON public.users
  FOR UPDATE
  USING (auth.uid() = id);

-- Conversation Sessions: Users can only access their own tasks
CREATE POLICY sessions_select_own ON public.conversation_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY sessions_insert_own ON public.conversation_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY sessions_update_own ON public.conversation_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY sessions_delete_own ON public.conversation_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Conversation Messages: Users can only access messages for their own tasks
CREATE POLICY messages_select_own ON public.conversation_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_sessions
      WHERE conversation_sessions.id = conversation_messages.session_id
      AND conversation_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY messages_insert_own ON public.conversation_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversation_sessions
      WHERE conversation_sessions.id = conversation_messages.session_id
      AND conversation_sessions.user_id = auth.uid()
    )
  );

-- Reports: Users can only access their own reports
CREATE POLICY reports_select_own ON public.reports
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY reports_insert_own ON public.reports
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY reports_update_own ON public.reports
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY reports_delete_own ON public.reports
  FOR DELETE
  USING (auth.uid() = user_id);

-- User Activity: Users can only see their own activity
CREATE POLICY activity_select_own ON public.user_activity
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY activity_insert_own ON public.user_activity
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to create user profile after signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url, primary_auth_provider)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'provider', 'email')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create user profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================

-- Note: Uncomment below to insert sample data for testing

/*
-- Sample user (you'll need to create this via Supabase Auth first)
-- Then update integration_settings manually:

UPDATE public.users
SET integration_settings = '{
  "jira": {
    "site_url": "https://your-domain.atlassian.net",
    "cloud_id": "your-cloud-id",
    "access_token": "your-access-token",
    "refresh_token": "your-refresh-token"
  }
}'::jsonb
WHERE email = 'your-email@example.com';

-- Sample task
INSERT INTO public.conversation_sessions (
  user_id,
  session_title,
  session_type,
  external_source,
  external_key,
  workflow_metadata
) VALUES (
  'your-user-id-here',
  'Sample JIRA Task',
  'jira',
  'jira',
  'PROJ-123',
  '{
    "jira_status": "In Progress",
    "jira_issue_type": "Story",
    "jira_priority": "High",
    "story_points": 5,
    "description": "This is a sample task"
  }'::jsonb
);
*/

-- =====================================================
-- GRANTS (for service role)
-- =====================================================

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- =====================================================
-- SETUP COMPLETE
-- =====================================================

-- To use this schema:
-- 1. Create a new Supabase project
-- 2. Go to SQL Editor in Supabase Dashboard
-- 3. Paste this entire file and run it
-- 4. Enable Email Auth in Authentication > Providers
-- 5. Update your .env file with new SUPABASE_URL and SUPABASE_ANON_KEY
-- 6. Test by signing up with email/password in your app

