-- =====================================================
-- TEAM REPOSITORIES TABLE
-- Links teams to their indexed GitHub repositories
-- =====================================================

CREATE TABLE IF NOT EXISTS public.team_repositories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,

  -- Repository Information
  repository_owner VARCHAR(255) NOT NULL,
  repository_name VARCHAR(255) NOT NULL,
  repository_branch VARCHAR(255) DEFAULT 'main',
  repository_url TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,
  indexed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique team-repo combinations
  UNIQUE(team_id, repository_owner, repository_name, repository_branch)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_repos_team_id ON public.team_repositories(team_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_team_repos_repo ON public.team_repositories(repository_owner, repository_name);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Get repositories for a team
CREATE OR REPLACE FUNCTION get_team_repositories(team_uuid UUID)
RETURNS TABLE (
  id UUID,
  repository_owner VARCHAR,
  repository_name VARCHAR,
  repository_branch VARCHAR,
  repository_url TEXT,
  indexed_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    tr.id,
    tr.repository_owner,
    tr.repository_name,
    tr.repository_branch,
    tr.repository_url,
    tr.indexed_at
  FROM team_repositories tr
  WHERE tr.team_id = team_uuid
    AND tr.is_active = true
  ORDER BY tr.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Add repository to team
CREATE OR REPLACE FUNCTION add_repository_to_team(
  team_uuid UUID,
  repo_owner VARCHAR,
  repo_name VARCHAR,
  repo_branch VARCHAR DEFAULT 'main',
  repo_url TEXT DEFAULT NULL,
  user_uuid UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  repo_id UUID;
BEGIN
  INSERT INTO team_repositories (
    team_id,
    repository_owner,
    repository_name,
    repository_branch,
    repository_url,
    created_by,
    indexed_at
  )
  VALUES (
    team_uuid,
    repo_owner,
    repo_name,
    repo_branch,
    repo_url,
    user_uuid,
    NOW()
  )
  ON CONFLICT (team_id, repository_owner, repository_name, repository_branch)
  DO UPDATE SET
    is_active = true,
    updated_at = NOW(),
    indexed_at = NOW()
  RETURNING id INTO repo_id;

  RETURN repo_id;
END;
$$ LANGUAGE plpgsql;

-- Remove repository from team
CREATE OR REPLACE FUNCTION remove_repository_from_team(
  team_uuid UUID,
  repo_owner VARCHAR,
  repo_name VARCHAR,
  repo_branch VARCHAR DEFAULT 'main'
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE team_repositories
  SET is_active = false,
      updated_at = NOW()
  WHERE team_id = team_uuid
    AND repository_owner = repo_owner
    AND repository_name = repo_name
    AND repository_branch = repo_branch;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- EXAMPLE DATA (Optional - for testing)
-- =====================================================

-- Add example repositories for a team
-- Replace 'YOUR_TEAM_ID' with actual team UUID
/*
SELECT add_repository_to_team(
  'YOUR_TEAM_ID'::UUID,
  'HeyoJarvis',
  'demo-repository',
  'main',
  'https://github.com/HeyoJarvis/demo-repository'
);
*/
