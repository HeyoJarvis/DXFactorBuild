-- Team/Workspace Setup for HeyJarvis
-- This creates the team selection functionality for the login flow

-- ============================================
-- 1. Ensure teams table exists (from main schema)
-- ============================================
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  company_id UUID REFERENCES companies(id),
  department VARCHAR(50),
  description TEXT,
  
  -- Subscription
  subscription_tier VARCHAR(20) DEFAULT 'trial',
  subscription_status VARCHAR(20) DEFAULT 'active',
  trial_ends_at TIMESTAMPTZ,
  max_members INTEGER DEFAULT 50,
  
  -- Competitive context
  competitive_context JSONB DEFAULT '{}',
  signal_preferences JSONB DEFAULT '{}',
  
  -- Settings
  shared_learning BOOLEAN DEFAULT true,
  knowledge_base BOOLEAN DEFAULT true,
  signal_retention_days INTEGER DEFAULT 90,
  
  -- Metadata
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- ============================================
-- 2. Create team_members junction table
-- ============================================
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Role in this team
  role VARCHAR(20) DEFAULT 'member', -- owner, admin, manager, member, viewer
  
  -- Access control
  can_invite_members BOOLEAN DEFAULT false,
  can_manage_settings BOOLEAN DEFAULT false,
  can_manage_sources BOOLEAN DEFAULT false,
  
  -- Activity tracking
  last_active_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  invited_by UUID REFERENCES users(id),
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure a user can only be in a team once
  UNIQUE(team_id, user_id)
);

-- ============================================
-- 3. Create indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_teams_slug ON teams(slug);
CREATE INDEX IF NOT EXISTS idx_teams_company_id ON teams(company_id);
CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by);
CREATE INDEX IF NOT EXISTS idx_teams_is_active ON teams(is_active);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role);
CREATE INDEX IF NOT EXISTS idx_team_members_is_active ON team_members(is_active);

-- ============================================
-- 4. Add sample teams for testing
-- ============================================

-- Insert sample teams (only if they don't exist)
INSERT INTO teams (id, name, slug, description, subscription_tier, subscription_status, avatar_url)
VALUES 
  (
    '00000000-0000-0000-0000-000000000001',
    'Engineering',
    'engineering',
    'Software development and technical operations',
    'team',
    'active',
    '🛠️'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'Sales',
    'sales',
    'Sales team tracking competitors and market opportunities',
    'team',
    'active',
    '💼'
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'Product',
    'product',
    'Product management and strategy',
    'team',
    'active',
    '🎯'
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    'Marketing',
    'marketing',
    'Marketing campaigns and brand management',
    'team',
    'active',
    '📢'
  ),
  (
    '00000000-0000-0000-0000-000000000005',
    'Executive',
    'executive',
    'C-suite and executive leadership',
    'enterprise',
    'active',
    '👔'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 5. Enable Row Level Security
-- ============================================
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view teams they are members of" ON teams;
DROP POLICY IF EXISTS "Users can view their team memberships" ON team_members;
DROP POLICY IF EXISTS "Team owners and admins can update team" ON teams;
DROP POLICY IF EXISTS "Team owners and admins can manage members" ON team_members;

-- Teams: Users can view teams they are members of
CREATE POLICY "Users can view teams they are members of"
ON teams FOR SELECT
USING (
  id IN (
    SELECT team_id FROM team_members 
    WHERE user_id = auth.uid() AND is_active = true
  )
  OR is_active = true -- Allow viewing active teams for team selection
);

-- Teams: Team owners and admins can update
CREATE POLICY "Team owners and admins can update team"
ON teams FOR UPDATE
USING (
  id IN (
    SELECT team_id FROM team_members 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
    AND is_active = true
  )
);

-- Team Members: Users can view their own memberships
CREATE POLICY "Users can view their team memberships"
ON team_members FOR SELECT
USING (
  user_id = auth.uid()
  OR team_id IN (
    SELECT team_id FROM team_members 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
    AND is_active = true
  )
);

-- Team Members: Owners and admins can manage members
CREATE POLICY "Team owners and admins can manage members"
ON team_members FOR ALL
USING (
  team_id IN (
    SELECT team_id FROM team_members 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
    AND is_active = true
  )
);

-- ============================================
-- 6. Create helper functions
-- ============================================

-- Function to get user's teams
CREATE OR REPLACE FUNCTION get_user_teams(user_uuid UUID)
RETURNS TABLE (
  team_id UUID,
  team_name VARCHAR,
  team_slug VARCHAR,
  team_description TEXT,
  team_avatar_url TEXT,
  user_role VARCHAR,
  last_active TIMESTAMPTZ,
  member_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.slug,
    t.description,
    t.avatar_url,
    tm.role,
    tm.last_active_at,
    (SELECT COUNT(*) FROM team_members WHERE team_id = t.id AND is_active = true) as member_count
  FROM teams t
  INNER JOIN team_members tm ON t.id = tm.team_id
  WHERE tm.user_id = user_uuid 
    AND tm.is_active = true
    AND t.is_active = true
  ORDER BY tm.last_active_at DESC NULLS LAST, tm.joined_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add user to team
CREATE OR REPLACE FUNCTION add_user_to_team(
  p_user_id UUID,
  p_team_id UUID,
  p_role VARCHAR DEFAULT 'member',
  p_invited_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_member_id UUID;
BEGIN
  INSERT INTO team_members (user_id, team_id, role, invited_by)
  VALUES (p_user_id, p_team_id, p_role, p_invited_by)
  ON CONFLICT (team_id, user_id) 
  DO UPDATE SET 
    is_active = true,
    role = EXCLUDED.role,
    updated_at = NOW()
  RETURNING id INTO v_member_id;
  
  -- Update user's team_id
  UPDATE users SET team_id = p_team_id WHERE id = p_user_id;
  
  RETURN v_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get available teams (for team selection during onboarding)
CREATE OR REPLACE FUNCTION get_available_teams()
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  slug VARCHAR,
  description TEXT,
  avatar_url TEXT,
  member_count BIGINT,
  can_join BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.slug,
    t.description,
    t.avatar_url,
    (SELECT COUNT(*) FROM team_members WHERE team_id = t.id AND is_active = true) as member_count,
    true as can_join -- For now, anyone can join any team
  FROM teams t
  WHERE t.is_active = true
  ORDER BY t.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. Create updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_team_members_updated_at ON team_members;
CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. Grant permissions
-- ============================================
GRANT SELECT ON teams TO authenticated;
GRANT SELECT ON team_members TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_teams(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION add_user_to_team(UUID, UUID, VARCHAR, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_teams() TO authenticated;

-- ============================================
-- Done!
-- ============================================
-- You can now:
-- 1. Call get_available_teams() to show team options during login
-- 2. Call add_user_to_team(user_id, team_id, 'member') to assign user to team
-- 3. Call get_user_teams(user_id) to get user's teams

