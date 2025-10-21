-- Create ONLY the team helper functions
-- Run this if you already have the team_members table

-- ============================================
-- Function to add user to team
-- ============================================
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

-- ============================================
-- Function to get user's teams
-- ============================================
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

-- ============================================
-- Function to get available teams
-- ============================================
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
-- Grant permissions
-- ============================================
GRANT EXECUTE ON FUNCTION add_user_to_team(UUID, UUID, VARCHAR, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_teams(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_teams() TO authenticated;

-- ============================================
-- Test the functions
-- ============================================
SELECT 'Functions created successfully!' as status;
SELECT * FROM get_available_teams() LIMIT 5;

