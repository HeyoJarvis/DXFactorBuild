# Team-Specific Codebase Context Setup

## Overview

Each team now has its own set of pre-configured repositories that automatically load when you select that team. When you ask questions in Team Chat, the AI uses only that team's specific codebase context.

## 🎯 How It Works

```
Team A → Repo1, Repo2 → AI uses only these repos for Team A
Team B → Repo3, Repo4 → AI uses only these repos for Team B
```

## 📋 Setup Instructions

### Step 1: Create the Database Table

Run this SQL script in your Supabase SQL Editor:

```sql
-- Create the team_repositories table
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
CREATE INDEX IF NOT EXISTS idx_team_repos_team_id
  ON public.team_repositories(team_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_team_repos_repo
  ON public.team_repositories(repository_owner, repository_name);
```

Or simply run:
```bash
psql <your-database-url> -f data/storage/team-repositories.sql
```

### Step 2: Restart Your Desktop App

```bash
cd /Users/jarvis/Code/HeyJarvis/desktop2
npm run dev
```

### Step 3: Index Repositories for Your Teams

1. **Switch to Team Mode** in Mission Control
2. **Select a team** from the dropdown
3. **Open Team Context** panel (left side)
4. **Click "Connected Repositories"** dropdown
5. **Click "Add Repository"** or "Index Your First Repository"
6. **Select a repository** from the list
7. **Click "Index"** button

The repository will:
- ✅ Be indexed in the code_embeddings table
- ✅ Be associated with your selected team
- ✅ Automatically appear in Team Context
- ✅ Be used for AI queries in Team Chat

## 🔄 How Team Context Loads

### Team A Context:
```json
{
  "meetings": ["Meeting 1", "Meeting 2"],
  "tasks": ["JIRA-123", "Slack Task"],
  "code_repos": [
    {
      "path": "HeyoJarvis/demo-repository",
      "name": "demo-repository",
      "owner": "HeyoJarvis",
      "branch": "main",
      "file_count": 150,
      "source": "github"
    }
  ]
}
```

### Team B Context:
```json
{
  "meetings": ["Different Meeting"],
  "tasks": ["PROJ-456"],
  "code_repos": [
    {
      "path": "HeyoJarvis/Mark-I",
      "name": "Mark-I",
      "owner": "HeyoJarvis",
      "branch": "main",
      "file_count": 250,
      "source": "github"
    }
  ]
}
```

## 📊 Backend Logic

### Loading Team Repositories

1. **Check team_repositories table** for team-specific repos
2. **If found**: Load only those repositories
3. **If not found**: Fallback to showing all indexed repos (old behavior)

### Code Reference

**Backend:** [team-chat-handlers.js:494-578](desktop2/main/ipc/team-chat-handlers.js#L494-L578)
```javascript
// Get team-specific repositories
const { data: teamRepos } = await dbAdapter.supabase
  .from('team_repositories')
  .select('repository_owner, repository_name, repository_branch')
  .eq('team_id', teamId)
  .eq('is_active', true);
```

**Frontend:** [TeamContext.jsx:93-143](desktop2/renderer2/src/components/Teams/TeamContext.jsx#L93-L143)
```javascript
// When indexing, add repo to team
await window.electronAPI.teamChat.addRepositoryToTeam(
  selectedTeam.id,
  owner,
  name,
  branch,
  url
);
```

## 🎨 UI Updates

### Before:
- Repositories shown were all indexed repos (not team-specific)
- No way to configure which repos belong to which team

### After:
- Each team has its own repository list
- When you select Team A, you see Team A's repos
- When you select Team B, you see Team B's repos
- Indexing a repo adds it to the currently selected team

## 🔍 Verification

### Check Team's Repositories in Database:

```sql
SELECT
  t.name as team_name,
  tr.repository_owner,
  tr.repository_name,
  tr.repository_branch,
  tr.indexed_at,
  tr.is_active
FROM team_repositories tr
JOIN teams t ON t.id = tr.team_id
WHERE tr.is_active = true
ORDER BY t.name, tr.created_at DESC;
```

### Check in UI:

1. Switch to Team A
2. Look at "Connected Repositories" in Team Context
3. You should see only Team A's indexed repos

4. Switch to Team B
5. Look at "Connected Repositories"
6. You should see only Team B's indexed repos

## 🛠️ Manual Database Setup (Optional)

If you want to manually add repositories to a team:

```sql
-- Find your team ID
SELECT id, name FROM teams;

-- Add a repository to a team
INSERT INTO team_repositories (
  team_id,
  repository_owner,
  repository_name,
  repository_branch,
  repository_url,
  indexed_at,
  is_active
) VALUES (
  'YOUR_TEAM_UUID',
  'HeyoJarvis',
  'demo-repository',
  'main',
  'https://github.com/HeyoJarvis/demo-repository',
  NOW(),
  true
);
```

## 🚀 Benefits

✅ **Isolated Context** - Each team only sees their relevant codebases
✅ **Better AI Responses** - AI uses only relevant context for each team
✅ **Automatic Loading** - Switch teams = context switches automatically
✅ **Scalable** - Add unlimited repos per team
✅ **Flexible** - Same repo can be used by multiple teams if needed

## 📝 Example Workflow

### Engineering Team Setup:
1. Select "Engineering Team"
2. Index: `HeyoJarvis/backend-api`, `HeyoJarvis/frontend-app`
3. AI now knows about your backend and frontend code

### Data Science Team Setup:
1. Select "Data Science Team"
2. Index: `HeyoJarvis/ml-models`, `HeyoJarvis/data-pipelines`
3. AI now knows about your ML models and data pipelines

### Marketing Team Setup:
1. Select "Marketing Team"
2. Index: `HeyoJarvis/website`, `HeyoJarvis/campaigns`
3. AI now knows about your marketing codebase

## 🔧 Troubleshooting

### "No repositories found"
- Make sure you've indexed repositories first
- Check that API server is running (`node server.js`)
- Verify team_repositories table exists in database

### "Repository not showing for team"
- Check database: `SELECT * FROM team_repositories WHERE team_id = 'YOUR_TEAM_ID'`
- Verify `is_active = true`
- Restart desktop app to reload

### "All teams see same repos"
- This means no team-specific repos are configured yet
- Index repos through Team Context to associate them with teams

## 📚 Database Schema

```sql
team_repositories
├── id (UUID, Primary Key)
├── team_id (UUID, Foreign Key → teams.id)
├── repository_owner (VARCHAR)
├── repository_name (VARCHAR)
├── repository_branch (VARCHAR)
├── repository_url (TEXT)
├── is_active (BOOLEAN)
├── indexed_at (TIMESTAMPTZ)
├── created_at (TIMESTAMPTZ)
├── created_by (UUID)
└── updated_at (TIMESTAMPTZ)
```

## 🎯 Next Steps

1. ✅ Run SQL migration to create table
2. ✅ Restart desktop app
3. ✅ Select your first team
4. ✅ Click "Add Repository"
5. ✅ Index repositories for that team
6. ✅ Switch to another team
7. ✅ Index different repositories
8. ✅ Test Team Chat with team-specific context!

Each team now has its own knowledge base! 🎉
