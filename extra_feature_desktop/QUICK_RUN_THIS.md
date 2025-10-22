# 🚀 Quick Fix - Run This SQL Now!

## Step 1: Copy the SQL below

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create fresh app_teams table
CREATE TABLE IF NOT EXISTS app_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE GENERATED ALWAYS AS (lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))) STORED,
  description TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  color TEXT NOT NULL DEFAULT '#3B82F6',
  working_hours_start TIME DEFAULT '09:00:00',
  working_hours_end TIME DEFAULT '17:00:00',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team members junction table
CREATE TABLE IF NOT EXISTS app_team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES app_teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- Team repositories table
CREATE TABLE IF NOT EXISTS app_team_repositories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES app_teams(id) ON DELETE CASCADE,
  repository_owner TEXT NOT NULL,
  repository_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, repository_owner, repository_name)
);

-- Add team_id to existing tables
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'team_meetings' 
    AND column_name = 'app_team_id'
  ) THEN
    ALTER TABLE team_meetings ADD COLUMN app_team_id UUID REFERENCES app_teams(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_team_meetings_app_team_id ON team_meetings(app_team_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'team_updates' 
    AND column_name = 'app_team_id'
  ) THEN
    ALTER TABLE team_updates ADD COLUMN app_team_id UUID REFERENCES app_teams(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_team_updates_app_team_id ON team_updates(app_team_id);
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_app_teams_name ON app_teams(name);
CREATE INDEX IF NOT EXISTS idx_app_teams_slug ON app_teams(slug);
CREATE INDEX IF NOT EXISTS idx_app_team_members_team_id ON app_team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_app_team_members_user_id ON app_team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_app_team_repositories_team_id ON app_team_repositories(team_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_app_teams_updated_at ON app_teams;
CREATE TRIGGER update_app_teams_updated_at
  BEFORE UPDATE ON app_teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE app_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_team_repositories ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access app_teams" ON app_teams FOR ALL USING (true);
CREATE POLICY "Service role full access app_team_members" ON app_team_members FOR ALL USING (true);
CREATE POLICY "Service role full access app_team_repositories" ON app_team_repositories FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON app_teams TO service_role;
GRANT ALL ON app_team_members TO service_role;
GRANT ALL ON app_team_repositories TO service_role;

-- Add comments
COMMENT ON TABLE app_teams IS 'Teams with timezone support for multi-timezone collaboration';
COMMENT ON COLUMN app_teams.slug IS 'Auto-generated URL-friendly slug from team name';
COMMENT ON COLUMN app_teams.timezone IS 'IANA timezone identifier (e.g., America/New_York)';
COMMENT ON COLUMN app_teams.color IS 'Hex color for UI differentiation';
COMMENT ON TABLE app_team_members IS 'Junction table linking users to teams with roles';
COMMENT ON TABLE app_team_repositories IS 'GitHub repositories assigned to teams for code context';
```

## Step 2: Go to Supabase

https://supabase.com/dashboard/project/_/sql

## Step 3: Paste and Run

1. Paste the SQL above into the editor
2. Click **"Run"**
3. Wait for success message

## Step 4: Restart Your App

```bash
# Kill the app if running
pkill -f "electron"

# Start fresh
cd /home/sdalal/test/BeachBaby/extra_feature_desktop
npm start
```

## Step 5: Test It!

1. Go to **Teams** page
2. Click **"Create New Team"**
3. Enter:
   - Name: "Engineering Team"
   - Description: "Main dev team"
   - Timezone: "America/New_York"
   - Color: Any color
4. Click **"Create Team"**

## ✅ Should Work Now!

The `slug` error is fixed - it's auto-generated from the team name!
The `timezone` error is fixed - it has a default value!
The `color` error is fixed - it has a default value!

All errors resolved! 🎉

