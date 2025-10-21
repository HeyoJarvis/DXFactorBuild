-- =====================================================
-- HEYJARVIS PRODUCTION AUTH SCHEMA
-- Multi-Role, Multi-Provider, Enterprise-Ready
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- ENUMS
-- =====================================================

-- User roles (sales and developer are essentially separate apps)
CREATE TYPE user_role AS ENUM ('sales', 'developer', 'admin');

-- Subscription tiers
CREATE TYPE subscription_tier AS ENUM ('trial', 'starter', 'professional', 'enterprise');

-- Integration status
CREATE TYPE integration_status AS ENUM ('active', 'disconnected', 'expired', 'error');

-- =====================================================
-- USERS TABLE (extends Supabase Auth)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.users (
  -- Core identity (linked to Supabase Auth)
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  
  -- Role determines which app features they see
  user_role user_role NOT NULL DEFAULT 'sales',
  
  -- Organization/Team
  company_name TEXT,
  department TEXT,
  
  -- Primary auth provider (the one they used to sign up)
  primary_auth_provider TEXT DEFAULT 'slack', -- slack, microsoft, google, email
  
  -- Slack identity
  slack_user_id TEXT UNIQUE,
  slack_team_id TEXT,
  slack_team_name TEXT,
  slack_display_name TEXT,
  
  -- Microsoft identity
  microsoft_user_id TEXT UNIQUE,
  microsoft_tenant_id TEXT,
  microsoft_email TEXT,
  
  -- Google identity
  google_user_id TEXT UNIQUE,
  google_email TEXT,
  
  -- Integration settings (OAuth tokens stored here encrypted)
  integration_settings JSONB DEFAULT '{}'::jsonb,
  
  -- Feature flags per role
  enabled_features TEXT[] DEFAULT ARRAY[]::TEXT[],
  disabled_features TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Subscription & Billing
  subscription_plan subscription_tier DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ,
  subscription_ends_at TIMESTAMPTZ,
  
  -- Onboarding tracking
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_step TEXT DEFAULT 'welcome',
  onboarding_started_at TIMESTAMPTZ,
  onboarding_completed_at TIMESTAMPTZ,
  
  -- Usage tracking
  last_active_at TIMESTAMPTZ,
  total_sessions INTEGER DEFAULT 0,
  total_tasks_created INTEGER DEFAULT 0,
  total_ai_messages INTEGER DEFAULT 0,
  
  -- Security
  two_factor_enabled BOOLEAN DEFAULT false,
  two_factor_secret TEXT,
  allowed_ip_addresses INET[],
  
  -- Account status
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  is_suspended BOOLEAN DEFAULT false,
  suspended_reason TEXT,
  suspended_until TIMESTAMPTZ,
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  
  -- Version for optimistic locking
  version INTEGER DEFAULT 1,
  
  -- Constraints
  CONSTRAINT email_lowercase CHECK (email = LOWER(email)),
  CONSTRAINT valid_role CHECK (user_role IN ('sales', 'developer', 'admin'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(user_role);
CREATE INDEX IF NOT EXISTS idx_users_slack_user_id ON public.users(slack_user_id) WHERE slack_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_microsoft_user_id ON public.users(microsoft_user_id) WHERE microsoft_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_google_user_id ON public.users(google_user_id) WHERE google_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_subscription ON public.users(subscription_plan, subscription_ends_at);
CREATE INDEX IF NOT EXISTS idx_users_active ON public.users(is_active, deleted_at) WHERE is_active = true AND deleted_at IS NULL;

-- =====================================================
-- INTEGRATION_CONNECTIONS TABLE
-- =====================================================
-- Tracks all OAuth connections per user
-- Each user can connect multiple providers

CREATE TABLE IF NOT EXISTS public.integration_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Integration details
  integration_name TEXT NOT NULL, -- slack, microsoft, google, github, jira, hubspot
  integration_type TEXT NOT NULL, -- oauth, api_key, webhook
  status integration_status DEFAULT 'active',
  
  -- OAuth data (tokens are encrypted in application layer before storage)
  access_token_encrypted TEXT, -- Encrypted in app
  refresh_token_encrypted TEXT, -- Encrypted in app
  token_expires_at TIMESTAMPTZ,
  
  -- Provider-specific IDs
  external_user_id TEXT, -- Their ID in the external system
  external_account_name TEXT,
  external_email TEXT,
  external_tenant_id TEXT, -- For Microsoft/enterprise
  
  -- Permissions & Scopes
  granted_scopes TEXT[],
  requested_permissions JSONB DEFAULT '{}'::jsonb,
  
  -- Connection metadata
  connection_metadata JSONB DEFAULT '{}'::jsonb, -- Store provider-specific data
  
  -- Health & Monitoring
  last_synced_at TIMESTAMPTZ,
  last_health_check_at TIMESTAMPTZ,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,
  sync_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  
  -- Audit
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  disconnected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one active connection per integration per user
  UNIQUE(user_id, integration_name)
);

CREATE INDEX IF NOT EXISTS idx_integration_connections_user ON public.integration_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_connections_status ON public.integration_connections(status);
CREATE INDEX IF NOT EXISTS idx_integration_connections_integration ON public.integration_connections(integration_name, status);

-- =====================================================
-- USER_SESSIONS TABLE (Login sessions tracking)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Session details
  session_token TEXT UNIQUE NOT NULL,
  refresh_token TEXT,
  
  -- Device & Location
  device_name TEXT,
  device_type TEXT, -- desktop, mobile, web
  os_name TEXT,
  os_version TEXT,
  app_version TEXT,
  ip_address INET,
  user_agent TEXT,
  location_data JSONB, -- city, country, etc from IP
  
  -- Session lifecycle
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  
  -- Session state
  is_active BOOLEAN DEFAULT true,
  terminated_reason TEXT, -- logout, timeout, security, etc
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON public.user_sessions(session_token) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON public.user_sessions(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON public.user_sessions(expires_at);

-- =====================================================
-- CONVERSATION_SESSIONS TABLE (Task/Chat sessions)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.conversation_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Session identification
  workflow_id TEXT, -- e.g., 'task_123', 'general_chat', 'mission_control'
  workflow_type TEXT NOT NULL, -- 'general', 'task', 'task_chat', 'mission_control'
  workflow_intent TEXT, -- 'create_task', 'analyze_data', 'email_draft', etc
  
  -- Session metadata
  session_title TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  workflow_metadata JSONB DEFAULT '{}'::jsonb, -- role routing, work type, etc
  
  -- Context tracking
  context_summary TEXT, -- AI-generated summary
  key_entities JSONB DEFAULT '[]'::jsonb, -- extracted people, companies, topics
  
  -- Session lifecycle
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  
  -- Session state
  is_active BOOLEAN DEFAULT true,
  is_archived BOOLEAN DEFAULT false,
  
  -- Analytics
  message_count INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_sessions_user ON public.conversation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_workflow ON public.conversation_sessions(workflow_id, workflow_type);
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_active ON public.conversation_sessions(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_recent ON public.conversation_sessions(user_id, last_message_at DESC);

-- =====================================================
-- CONVERSATION_MESSAGES TABLE (Chat messages)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.conversation_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'function')),
  message_text TEXT NOT NULL,
  
  -- AI metadata
  model_name TEXT,
  tokens_used INTEGER,
  processing_time_ms INTEGER,
  temperature DECIMAL(3, 2),
  
  -- Context & References
  context_used JSONB DEFAULT '{}'::jsonb, -- what context was provided to AI
  message_references JSONB DEFAULT '[]'::jsonb, -- referenced messages, docs, etc
  attachments JSONB DEFAULT '[]'::jsonb,
  
  -- Message state
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  
  -- Feedback
  user_feedback TEXT, -- thumbs_up, thumbs_down, null
  user_feedback_note TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_session ON public.conversation_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_user ON public.conversation_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_role ON public.conversation_messages(session_id, role);

-- =====================================================
-- TASKS TABLE (User-specific tasks)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Ownership
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- Task details
  title TEXT NOT NULL,
  description TEXT,
  
  -- Classification
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
  
  -- Workflow routing (determines which UI shows it)
  route_to TEXT DEFAULT 'tasks-sales', -- 'tasks-sales', 'mission-control', 'architecture'
  work_type TEXT DEFAULT 'task', -- 'task', 'email', 'calendar', 'code_review', 'outreach'
  
  -- Scheduling
  due_date TIMESTAMPTZ,
  reminder_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Integration sync
  external_id TEXT, -- ID in JIRA, GitHub, etc
  external_source TEXT, -- 'jira', 'github', 'slack', 'manual'
  external_url TEXT,
  jira_key TEXT,
  jira_status TEXT,
  jira_synced_at TIMESTAMPTZ,
  
  -- Metadata
  workflow_metadata JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Analytics
  time_spent_minutes INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_route_to ON public.tasks(route_to);
CREATE INDEX IF NOT EXISTS idx_tasks_work_type ON public.tasks(work_type);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_external ON public.tasks(external_source, external_id);

-- =====================================================
-- AUDIT_LOGS TABLE (Security & Compliance)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Who & What
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_email TEXT, -- Preserve email even if user deleted
  actor_role TEXT,
  
  -- Action details
  action TEXT NOT NULL, -- 'user.login', 'task.create', 'integration.connect', etc
  resource_type TEXT NOT NULL, -- 'user', 'task', 'integration', 'session', etc
  resource_id UUID,
  
  -- Context
  description TEXT,
  changes JSONB DEFAULT '{}'::jsonb, -- before/after for updates
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Request details
  ip_address INET,
  user_agent TEXT,
  device_type TEXT,
  
  -- Result
  success BOOLEAN NOT NULL,
  error_message TEXT,
  
  -- Compliance
  severity TEXT CHECK (severity IN ('info', 'warning', 'critical')) DEFAULT 'info',
  requires_review BOOLEAN DEFAULT false,
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON public.audit_logs(severity, requires_review);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Users table policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Service role full access users" ON public.users;

CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Service role full access users" ON public.users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Integration connections policies
DROP POLICY IF EXISTS "Users can manage own integrations" ON public.integration_connections;

CREATE POLICY "Users can manage own integrations" ON public.integration_connections
  FOR ALL
  USING (auth.uid() = user_id);

-- User sessions policies
DROP POLICY IF EXISTS "Users can view own sessions" ON public.user_sessions;

CREATE POLICY "Users can view own sessions" ON public.user_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Conversation sessions policies
DROP POLICY IF EXISTS "Users can manage own conversations" ON public.conversation_sessions;

CREATE POLICY "Users can manage own conversations" ON public.conversation_sessions
  FOR ALL
  USING (auth.uid() = user_id);

-- Conversation messages policies
DROP POLICY IF EXISTS "Users can manage own messages" ON public.conversation_messages;

CREATE POLICY "Users can manage own messages" ON public.conversation_messages
  FOR ALL
  USING (auth.uid() = user_id);

-- Tasks policies
DROP POLICY IF EXISTS "Users can view relevant tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update relevant tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;

CREATE POLICY "Users can view relevant tasks" ON public.tasks
  FOR SELECT
  USING (auth.uid() = created_by OR auth.uid() = assigned_to);

CREATE POLICY "Users can create tasks" ON public.tasks
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update relevant tasks" ON public.tasks
  FOR UPDATE
  USING (auth.uid() = created_by OR auth.uid() = assigned_to);

CREATE POLICY "Users can delete own tasks" ON public.tasks
  FOR DELETE
  USING (auth.uid() = created_by);

-- Audit logs policies (read-only for users)
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Service role full access audit_logs" ON public.audit_logs;

CREATE POLICY "Users can view own audit logs" ON public.audit_logs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access audit_logs" ON public.audit_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.version = OLD.version + 1; -- Optimistic locking
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_integration_connections_updated_at ON public.integration_connections;
CREATE TRIGGER update_integration_connections_updated_at
  BEFORE UPDATE ON public.integration_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversation_sessions_updated_at ON public.conversation_sessions;
CREATE TRIGGER update_conversation_sessions_updated_at
  BEFORE UPDATE ON public.conversation_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
  p_user_id UUID,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID,
  p_description TEXT DEFAULT NULL,
  p_success BOOLEAN DEFAULT true,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    description,
    success,
    metadata
  ) VALUES (
    p_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_description,
    p_success,
    p_metadata
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  UPDATE public.user_sessions
  SET is_active = false,
      ended_at = NOW(),
      terminated_reason = 'expired'
  WHERE is_active = true
    AND expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user role-specific features
CREATE OR REPLACE FUNCTION get_user_features(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user RECORD;
  v_features JSONB;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  
  -- Base features by role
  IF v_user.user_role = 'sales' THEN
    v_features := '{"chat": true, "tasks": true, "crm": true, "email": true, "calendar": true}'::jsonb;
  ELSIF v_user.user_role = 'developer' THEN
    v_features := '{"chat": true, "tasks": true, "jira": true, "github": true, "code": true, "architecture": true}'::jsonb;
  ELSIF v_user.user_role = 'admin' THEN
    v_features := '{"chat": true, "tasks": true, "crm": true, "jira": true, "github": true, "code": true, "architecture": true, "admin": true}'::jsonb;
  END IF;
  
  -- Apply custom overrides
  -- Add enabled_features
  -- Remove disabled_features
  
  RETURN v_features;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_connections TO authenticated;
GRANT SELECT ON public.user_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.conversation_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION log_audit_event TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_features TO authenticated;

-- =====================================================
-- SUCCESS
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Production Auth Schema Created Successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables Created:';
  RAISE NOTICE '  - users (multi-provider identity)';
  RAISE NOTICE '  - integration_connections (OAuth tokens)';
  RAISE NOTICE '  - user_sessions (login tracking)';
  RAISE NOTICE '  - conversation_sessions (chat/task sessions)';
  RAISE NOTICE '  - conversation_messages (AI messages)';
  RAISE NOTICE '  - tasks (role-routed tasks)';
  RAISE NOTICE '  - audit_logs (compliance & security)';
  RAISE NOTICE '';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  ✓ Multi-role support (sales/developer/admin)';
  RAISE NOTICE '  ✓ Multi-provider auth (Slack/Microsoft/Google)';
  RAISE NOTICE '  ✓ Row Level Security enabled';
  RAISE NOTICE '  ✓ Audit logging';
  RAISE NOTICE '  ✓ Session management';
  RAISE NOTICE '  ✓ Integration token storage';
  RAISE NOTICE '  ✓ Optimistic locking (version column)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Update your .env with SUPABASE_URL and SUPABASE_ANON_KEY';
  RAISE NOTICE '  2. Configure OAuth providers in Supabase Dashboard';
  RAISE NOTICE '  3. Run migration to populate existing users';
  RAISE NOTICE '  4. Implement token encryption in your app layer';
END $$;

