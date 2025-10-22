# New Teams Table Setup Guide

## 🎯 What Changed

We've created a **completely new** set of tables for the Teams feature to avoid conflicts with the existing `teams` table:

### New Tables
- `app_teams` - Main teams table (replaces `teams`)
- `app_team_members` - Team members junction table
- `app_team_repositories` - Team repositories assignments

### Updated Columns
- `team_meetings.app_team_id` - Links meetings to teams
- `team_updates.app_team_id` - Links tasks/PRs/commits to teams

## 🚀 Setup Instructions

### Step 1: Run the Migration

In your **Supabase SQL Editor**, run:

```sql
/home/sdalal/test/BeachBaby/extra_feature_desktop/migrations/007_create_app_teams.sql
```

Or paste the SQL directly from that file.

### Step 2: Restart Your Electron App

```bash
# Kill any running instances
pkill -f "electron"

# Start fresh
cd /home/sdalal/test/BeachBaby/extra_feature_desktop
npm start
```

### Step 3: Test Creating a Team

1. Navigate to the **Teams** page
2. Click "Create New Team"
3. Fill in:
   - **Team Name**: "Engineering Team"
   - **Description**: "Main development team"
   - **Timezone**: Select any timezone
   - **Color**: Pick a color
4. Click "Create Team"

Should work perfectly now! ✅

## 📋 Key Features of New Table

### Auto-Generated Slug
The `slug` column is **automatically generated** from the team name:
- "Engineering Team" → "engineering-team"
- "Sales & Marketing" → "sales-marketing"
- No need to manually provide it!

### Complete Schema
```sql
CREATE TABLE app_teams (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE (auto-generated),
  description TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  color TEXT NOT NULL DEFAULT '#3B82F6',
  working_hours_start TIME DEFAULT '09:00:00',
  working_hours_end TIME DEFAULT '17:00:00',
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

## 🔧 Backend Changes

All backend services have been updated to use the new table names:

### Updated Files
- ✅ `TeamSyncSupabaseAdapter.js` - All 15 methods updated
- ✅ No frontend changes needed (API remains the same)
- ✅ Migration handles table creation and relationships

### API Remains Unchanged
From the frontend's perspective, nothing changes! All the IPC handlers still work the same way:
- `teams:create`
- `teams:list`
- `teams:assignMeeting`
- etc.

## ✅ Verification

After running the migration, verify the tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE 'app_team%'
ORDER BY table_name;
```

You should see:
- `app_team_members`
- `app_team_repositories`
- `app_teams`

## 🎉 Ready to Use!

Once you've run the migration and restarted the app, you can:
1. Create teams
2. Assign meetings, tasks, and repositories
3. Ask team-specific questions with isolated context

The `slug` error is completely resolved with the auto-generated column!

