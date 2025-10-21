-- Add Missing Team Members Table and Pre-populated Teams
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. Create team_members junction table
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
-- 2. Create indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role);
CREATE INDEX IF NOT EXISTS idx_team_members_is_active ON team_members(is_active);

-- ============================================
-- 3. Add pre-populated teams
-- ============================================
INSERT INTO teams (id, name, slug, description, subscription_tier, subscription_status)
VALUES 
  (
    '00000000-0000-0000-0000-000000000001',
    'Engineering',
    'engineering',
    'Software development and technical operations',
    'team',
    'active'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'Sales',
    'sales',
    'Sales team tracking competitors and market opportunities',
    'team',
    'active'
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'Product',
    'product',
    'Product management and strategy',
    'team',
    'active'
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    'Marketing',
    'marketing',
    'Marketing campaigns and brand management',
    'team',
    'active'
  ),
  (
    '00000000-0000-0000-0000-000000000005',
    'Executive',
    'executive',
    'C-suite and executive leadership',
    'enterprise',
    'active'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 4. Enable Row Level Security
-- ============================================
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their team memberships" ON team_members;
DROP POLICY IF EXISTS "Team owners and admins can manage members" ON team_members;

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
-- 5. Create updated_at trigger
-- ============================================
DROP TRIGGER IF EXISTS update_team_members_updated_at ON team_members;
CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. Grant permissions
-- ============================================
GRANT SELECT ON team_members TO authenticated;

-- ============================================
-- Done! ✅
-- ============================================
SELECT 
  '✅ team_members table created' as status,
  COUNT(*) as team_count
FROM teams;

