-- Fix Team Members Table
-- This will drop and recreate the team_members table properly

-- ============================================
-- 1. Drop existing team_members table if it has issues
-- ============================================
DROP TABLE IF EXISTS team_members CASCADE;

-- ============================================
-- 2. Create team_members table with correct schema
-- ============================================
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Role in this team
  role VARCHAR(20) DEFAULT 'member',
  
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
-- 3. Create indexes
-- ============================================
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_role ON team_members(role);
CREATE INDEX idx_team_members_is_active ON team_members(is_active);

-- ============================================
-- 4. Enable Row Level Security
-- ============================================
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their team memberships" ON team_members;
DROP POLICY IF EXISTS "Team owners and admins can manage members" ON team_members;
DROP POLICY IF EXISTS "Users can insert themselves into teams" ON team_members;

-- Users can view their own memberships
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

-- Users can insert themselves into teams (for joining)
CREATE POLICY "Users can insert themselves into teams"
ON team_members FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Owners and admins can manage members
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
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_team_members_updated_at ON team_members;
CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. Recreate helper functions
-- ============================================

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
  -- Insert or update team membership
  INSERT INTO team_members (user_id, team_id, role, invited_by)
  VALUES (p_user_id, p_team_id, p_role, p_invited_by)
  ON CONFLICT (team_id, user_id) 
  DO UPDATE SET 
    is_active = true,
    role = EXCLUDED.role,
    updated_at = NOW()
  RETURNING id INTO v_member_id;
  
  -- Update user's active team_id
  UPDATE users SET team_id = p_team_id WHERE id = p_user_id;
  
  RETURN v_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's teams
CREATE OR REPLACE FUNCTION get_user_teams(user_uuid UUID)
RETURNS TABLE (
  team_id UUID,
  team_name VARCHAR,
  team_slug VARCHAR,
  team_description TEXT,
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
    tm.role,
    tm.last_active_at,
    (SELECT COUNT(*) FROM team_members WHERE team_id = t.id AND is_active = true) as member_count
  FROM teams t
  INNER JOIN team_members tm ON t.id = tm.team_id
  WHERE tm.user_id = user_uuid 
    AND tm.is_active = true
    AND (t.deleted_at IS NULL OR t.deleted_at > NOW())
  ORDER BY tm.last_active_at DESC NULLS LAST, tm.joined_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get available teams
CREATE OR REPLACE FUNCTION get_available_teams()
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  slug VARCHAR,
  description TEXT,
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
    (SELECT COUNT(*) FROM team_members WHERE team_id = t.id AND is_active = true) as member_count,
    true as can_join
  FROM teams t
  WHERE (t.deleted_at IS NULL OR t.deleted_at > NOW())
  ORDER BY t.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. Grant permissions
-- ============================================
GRANT SELECT, INSERT ON team_members TO authenticated;
GRANT EXECUTE ON FUNCTION add_user_to_team(UUID, UUID, VARCHAR, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_teams(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_teams() TO authenticated;

-- ============================================
-- 8. Verify setup
-- ============================================
SELECT 
  '✅ team_members table created with ' || COUNT(*) || ' columns' as status
FROM information_schema.columns 
WHERE table_name = 'team_members';

SELECT '✅ Available teams:' as status;
SELECT id, name, slug FROM teams WHERE deleted_at IS NULL LIMIT 5;

