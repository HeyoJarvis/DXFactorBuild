-- =====================================================
-- SAFE MIGRATION: Existing Schema → Production Auth
-- This migrates your current setup without breaking existing data
-- =====================================================

-- =====================================================
-- STEP 1: Add missing columns to existing users table
-- =====================================================

-- Add role-specific columns (safe, won't break existing data)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS user_role user_role DEFAULT 'sales';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS primary_auth_provider TEXT DEFAULT 'slack';

-- Add Microsoft identity columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS microsoft_user_id TEXT UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS microsoft_tenant_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS microsoft_email TEXT;

-- Add Google identity columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS google_user_id TEXT UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS google_email TEXT;

-- Add feature flags
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS enabled_features TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS disabled_features TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add onboarding tracking (some fields already exist, adding missing ones)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS onboarding_step TEXT DEFAULT 'welcome';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS onboarding_started_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Add enhanced usage tracking
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_sessions INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_tasks_created INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_ai_messages INTEGER DEFAULT 0;

-- Add security features
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS allowed_ip_addresses INET[];

-- Add suspension tracking
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS suspended_reason TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- Add last_login_at (different from last_login)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Add subscription_ends_at
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(user_role);
CREATE INDEX IF NOT EXISTS idx_users_microsoft_user_id ON public.users(microsoft_user_id) WHERE microsoft_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_google_user_id ON public.users(google_user_id) WHERE google_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_subscription ON public.users(subscription_plan, subscription_ends_at);

-- =====================================================
-- STEP 2: Enhance existing tasks table
-- =====================================================

-- Add workflow routing columns (for sales vs developer views)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS route_to TEXT DEFAULT 'tasks-sales';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS work_type TEXT DEFAULT 'task';

-- Add scheduling columns
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS reminder_at TIMESTAMPTZ;

-- Add JIRA sync columns (some may already exist from source/source_id)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS external_source TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS external_url TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS jira_key TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS jira_status TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS jira_synced_at TIMESTAMPTZ;

-- Add tags and metadata
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS workflow_metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add time tracking
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS time_spent_minutes INTEGER DEFAULT 0;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_tasks_route_to ON public.tasks(route_to);
CREATE INDEX IF NOT EXISTS idx_tasks_work_type ON public.tasks(work_type);
CREATE INDEX IF NOT EXISTS idx_tasks_external ON public.tasks(external_source, external_id);

-- Migrate existing source/source_id to external_source/external_id
UPDATE public.tasks 
SET external_source = source,
    external_id = source_id
WHERE source IS NOT NULL AND external_source IS NULL;

-- =====================================================
-- STEP 3: Enhance conversation_sessions table
-- =====================================================

-- Add missing columns (most already exist, just ensuring)
ALTER TABLE public.conversation_sessions ADD COLUMN IF NOT EXISTS context_summary TEXT;
ALTER TABLE public.conversation_sessions ADD COLUMN IF NOT EXISTS key_entities JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.conversation_sessions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE public.conversation_sessions ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE public.conversation_sessions ADD COLUMN IF NOT EXISTS total_tokens_used INTEGER DEFAULT 0;
ALTER TABLE public.conversation_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.conversation_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Rename last_activity_at to last_message_at for consistency
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversation_sessions' 
    AND column_name = 'last_activity_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversation_sessions' 
    AND column_name = 'last_message_at'
  ) THEN
    ALTER TABLE public.conversation_sessions RENAME COLUMN last_activity_at TO last_message_at;
  END IF;
END $$;

-- Create missing indexes
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_recent ON public.conversation_sessions(user_id, last_message_at DESC);

-- =====================================================
-- STEP 4: Enhance conversation_messages table
-- =====================================================

-- Add AI metadata columns
ALTER TABLE public.conversation_messages ADD COLUMN IF NOT EXISTS model_name TEXT;
ALTER TABLE public.conversation_messages ADD COLUMN IF NOT EXISTS tokens_used INTEGER;
ALTER TABLE public.conversation_messages ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;
ALTER TABLE public.conversation_messages ADD COLUMN IF NOT EXISTS temperature DECIMAL(3, 2);

-- Add context tracking
ALTER TABLE public.conversation_messages ADD COLUMN IF NOT EXISTS context_used JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.conversation_messages ADD COLUMN IF NOT EXISTS message_references JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.conversation_messages ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- Add message state tracking
ALTER TABLE public.conversation_messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;
ALTER TABLE public.conversation_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE public.conversation_messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE public.conversation_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add feedback columns
ALTER TABLE public.conversation_messages ADD COLUMN IF NOT EXISTS user_feedback TEXT;
ALTER TABLE public.conversation_messages ADD COLUMN IF NOT EXISTS user_feedback_note TEXT;

-- Add updated_at
ALTER TABLE public.conversation_messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add created_at if missing
ALTER TABLE public.conversation_messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Migrate timestamp to created_at if needed
UPDATE public.conversation_messages 
SET created_at = timestamp 
WHERE created_at IS NULL AND timestamp IS NOT NULL;

-- Create missing indexes
CREATE INDEX IF NOT EXISTS idx_conversation_messages_role ON public.conversation_messages(session_id, role);

-- =====================================================
-- STEP 5: Create NEW tables (won't conflict)
-- =====================================================

-- Integration connections table (completely new)
CREATE TABLE IF NOT EXISTS public.integration_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Integration details
  integration_name TEXT NOT NULL,
  integration_type TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'expired', 'error')),
  
  -- OAuth data (encrypted in app layer)
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  
  -- Provider-specific IDs
  external_user_id TEXT,
  external_account_name TEXT,
  external_email TEXT,
  external_tenant_id TEXT,
  
  -- Permissions & Scopes
  granted_scopes TEXT[],
  requested_permissions JSONB DEFAULT '{}'::jsonb,
  
  -- Connection metadata
  connection_metadata JSONB DEFAULT '{}'::jsonb,
  
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
  
  UNIQUE(user_id, integration_name)
);

CREATE INDEX IF NOT EXISTS idx_integration_connections_user ON public.integration_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_connections_status ON public.integration_connections(status);
CREATE INDEX IF NOT EXISTS idx_integration_connections_integration ON public.integration_connections(integration_name, status);

-- Audit logs table (completely new)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Who & What
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  actor_role TEXT,
  
  -- Action details
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  
  -- Context
  description TEXT,
  changes JSONB DEFAULT '{}'::jsonb,
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
-- STEP 6: Enhance user_sessions table
-- =====================================================

-- Add device tracking columns
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS device_name TEXT;
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS device_type TEXT;
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS os_name TEXT;
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS os_version TEXT;
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS app_version TEXT;
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS location_data JSONB;

-- Add session lifecycle columns
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS terminated_reason TEXT;
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS refresh_token TEXT;

-- Migrate created_at to started_at if needed
UPDATE public.user_sessions 
SET started_at = created_at 
WHERE started_at IS NULL AND created_at IS NOT NULL;

-- Create missing indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON public.user_sessions(user_id, is_active) WHERE is_active = true;

-- =====================================================
-- STEP 7: Enable RLS on new tables
-- =====================================================

ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for integration_connections
DROP POLICY IF EXISTS "Users can manage own integrations" ON public.integration_connections;
CREATE POLICY "Users can manage own integrations" ON public.integration_connections
  FOR ALL
  USING (auth.uid() = user_id);

-- RLS Policies for audit_logs
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
-- STEP 8: Create/Update Functions
-- =====================================================

-- Update updated_at function (with version increment)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF TG_TABLE_NAME = 'users' AND OLD.version IS NOT NULL THEN
    NEW.version = OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure triggers exist
DROP TRIGGER IF EXISTS update_integration_connections_updated_at ON public.integration_connections;
CREATE TRIGGER update_integration_connections_updated_at
  BEFORE UPDATE ON public.integration_connections
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

-- Function to get user role-specific features
CREATE OR REPLACE FUNCTION get_user_features(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user RECORD;
  v_features JSONB;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  
  IF v_user.user_role IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;
  
  -- Base features by role
  IF v_user.user_role = 'sales' THEN
    v_features := '{"chat": true, "tasks": true, "crm": true, "email": true, "calendar": true}'::jsonb;
  ELSIF v_user.user_role = 'developer' THEN
    v_features := '{"chat": true, "tasks": true, "jira": true, "github": true, "code": true, "architecture": true}'::jsonb;
  ELSIF v_user.user_role = 'admin' THEN
    v_features := '{"chat": true, "tasks": true, "crm": true, "jira": true, "github": true, "code": true, "architecture": true, "admin": true}'::jsonb;
  ELSE
    v_features := '{"chat": true}'::jsonb;
  END IF;
  
  RETURN v_features;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 9: Grant Permissions
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_connections TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT EXECUTE ON FUNCTION log_audit_event TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_features TO authenticated;

-- =====================================================
-- STEP 10: Data Migration
-- =====================================================

-- Set default user roles based on existing data patterns
-- (You may want to customize this based on your business logic)
UPDATE public.users 
SET user_role = 'sales'
WHERE user_role IS NULL 
  AND (slack_user_id IS NOT NULL OR email LIKE '%sales%');

UPDATE public.users 
SET user_role = 'developer'
WHERE user_role IS NULL 
  AND email LIKE '%dev%' OR email LIKE '%eng%';

-- Set remaining users to sales by default
UPDATE public.users 
SET user_role = 'sales'
WHERE user_role IS NULL;

-- Migrate existing integration_settings to integration_connections
INSERT INTO public.integration_connections (
  user_id,
  integration_name,
  integration_type,
  status,
  connection_metadata,
  connected_at
)
SELECT 
  id as user_id,
  integration_key as integration_name,
  'oauth' as integration_type,
  CASE 
    WHEN integration_value->>'authenticated' = 'true' THEN 'active'
    ELSE 'disconnected'
  END as status,
  integration_value as connection_metadata,
  COALESCE(
    (integration_value->>'connected_at')::timestamptz,
    NOW()
  ) as connected_at
FROM public.users,
LATERAL jsonb_each(integration_settings) AS settings(integration_key, integration_value)
WHERE integration_settings IS NOT NULL 
  AND jsonb_typeof(integration_settings) = 'object'
ON CONFLICT (user_id, integration_name) DO NOTHING;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Production Auth Migration Complete!';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes Applied:';
  RAISE NOTICE '  ✓ Enhanced users table with multi-provider support';
  RAISE NOTICE '  ✓ Enhanced tasks table with workflow routing';
  RAISE NOTICE '  ✓ Enhanced conversation tables with AI metadata';
  RAISE NOTICE '  ✓ Created integration_connections table';
  RAISE NOTICE '  ✓ Created audit_logs table';
  RAISE NOTICE '  ✓ Migrated existing integration_settings';
  RAISE NOTICE '  ✓ Applied RLS policies';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Review migrated user roles';
  RAISE NOTICE '  2. Test authentication flows';
  RAISE NOTICE '  3. Update app code to use new columns';
  RAISE NOTICE '  4. Configure OAuth providers';
END $$;

