-- Production Onboarding Schema
-- Adds fields and tables needed for production-grade onboarding

-- ============================================================================
-- STEP 1: Update users table with missing fields
-- ============================================================================

-- Add Slack-specific fields if they don't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS slack_user_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS slack_team_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS slack_team_name TEXT;

-- Add integration settings storage
ALTER TABLE users ADD COLUMN IF NOT EXISTS integration_settings JSONB DEFAULT '{}';

-- Add onboarding tracking fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_step VARCHAR(50) DEFAULT 'welcome';
ALTER TABLE users ADD COLUMN IF NOT EXISTS selected_integrations TEXT[] DEFAULT '{}';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_slack_user_id ON users(slack_user_id);
CREATE INDEX IF NOT EXISTS idx_users_slack_team_id ON users(slack_team_id);
CREATE INDEX IF NOT EXISTS idx_users_onboarding_completed ON users(onboarding_completed);

-- ============================================================================
-- STEP 2: Create onboarding_progress table
-- ============================================================================

CREATE TABLE IF NOT EXISTS onboarding_progress (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_step VARCHAR(50) DEFAULT 'welcome',
  completed_steps TEXT[] DEFAULT '{}',
  skipped_steps TEXT[] DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Store step-specific data
  data JSONB DEFAULT '{}'::jsonb,

  -- Track which integrations user selected
  selected_integrations TEXT[] DEFAULT '{}',
  connected_integrations TEXT[] DEFAULT '{}',

  -- Track team setup
  created_team BOOLEAN DEFAULT false,
  joined_team BOOLEAN DEFAULT false,

  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for querying incomplete onboarding
CREATE INDEX IF NOT EXISTS idx_onboarding_incomplete
ON onboarding_progress(user_id)
WHERE completed_at IS NULL;

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_onboarding_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_onboarding_updated_at
BEFORE UPDATE ON onboarding_progress
FOR EACH ROW
EXECUTE FUNCTION update_onboarding_updated_at();

-- ============================================================================
-- STEP 3: Create team invitations table
-- ============================================================================

CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES users(id),
  email VARCHAR(255) NOT NULL,
  role team_role DEFAULT 'member',

  -- Invitation status
  status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, expired, revoked
  token VARCHAR(100) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),

  -- Tracking
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES users(id),

  -- Metadata
  message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_status ON team_invitations(status);

-- ============================================================================
-- STEP 4: Create integration_connections table
-- ============================================================================

CREATE TABLE IF NOT EXISTS integration_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  integration_name VARCHAR(50) NOT NULL, -- slack, microsoft, google, github, jira, hubspot, website

  -- Connection status
  status VARCHAR(20) DEFAULT 'active', -- active, disconnected, error, expired
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,

  -- OAuth/Auth data (encrypted in application layer)
  auth_data JSONB DEFAULT '{}'::jsonb,

  -- Connection metadata
  scopes TEXT[],
  permissions JSONB DEFAULT '{}'::jsonb,
  external_account_id TEXT,
  external_account_name TEXT,

  -- Health monitoring
  sync_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  last_health_check TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, integration_name)
);

CREATE INDEX IF NOT EXISTS idx_integration_connections_user ON integration_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_connections_status ON integration_connections(status);

-- ============================================================================
-- STEP 5: Add helpful views
-- ============================================================================

-- View to see users who need onboarding
CREATE OR REPLACE VIEW users_needing_onboarding AS
SELECT
  u.id,
  u.email,
  u.name,
  u.created_at,
  u.onboarding_completed,
  u.user_role,
  u.team_id,
  op.current_step,
  op.started_at as onboarding_started_at,
  COALESCE(array_length(op.completed_steps, 1), 0) as steps_completed
FROM users u
LEFT JOIN onboarding_progress op ON u.id = op.user_id
WHERE u.onboarding_completed = false
  AND u.is_active = true
ORDER BY u.created_at DESC;

-- View to see team onboarding statistics
CREATE OR REPLACE VIEW team_onboarding_stats AS
SELECT
  t.id as team_id,
  t.name as team_name,
  COUNT(DISTINCT tm.user_id) as total_members,
  COUNT(DISTINCT CASE WHEN u.onboarding_completed THEN tm.user_id END) as completed_onboarding,
  COUNT(DISTINCT CASE WHEN NOT u.onboarding_completed THEN tm.user_id END) as pending_onboarding,
  ROUND(
    COUNT(DISTINCT CASE WHEN u.onboarding_completed THEN tm.user_id END)::numeric /
    NULLIF(COUNT(DISTINCT tm.user_id), 0) * 100,
    2
  ) as completion_percentage
FROM teams t
LEFT JOIN team_members tm ON t.id = tm.team_id AND tm.is_active = true
LEFT JOIN users u ON tm.user_id = u.id
GROUP BY t.id, t.name;

-- ============================================================================
-- STEP 6: Add sample data (optional, for testing)
-- ============================================================================

-- Function to initialize onboarding progress for a user
CREATE OR REPLACE FUNCTION initialize_onboarding(p_user_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO onboarding_progress (user_id, current_step, started_at)
  VALUES (p_user_id, 'welcome', NOW())
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically create onboarding progress when user is created
CREATE OR REPLACE FUNCTION auto_initialize_onboarding()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.onboarding_completed = false THEN
    INSERT INTO onboarding_progress (user_id, current_step, started_at)
    VALUES (NEW.id, 'welcome', NOW())
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_initialize_onboarding
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION auto_initialize_onboarding();

-- ============================================================================
-- STEP 7: Grant permissions (adjust for your setup)
-- ============================================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON onboarding_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE ON integration_connections TO authenticated;
GRANT SELECT, INSERT ON team_invitations TO authenticated;
GRANT SELECT ON users_needing_onboarding TO authenticated;
GRANT SELECT ON team_onboarding_stats TO authenticated;

-- ============================================================================
-- Migration complete!
-- ============================================================================

-- Verify the schema
SELECT 'Production onboarding schema created successfully!' as status;
