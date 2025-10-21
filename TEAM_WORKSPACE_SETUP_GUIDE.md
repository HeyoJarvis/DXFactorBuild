# 🏢 Team/Workspace Setup Guide

## Overview

The team selection system allows users to join or create teams after logging in. This replaces the mock data with real Supabase-backed teams.

## 📋 What Was Implemented

### 1. Database Schema (`data/storage/team-workspace-setup.sql`)

**Two main tables:**

#### **Teams Table**
Stores team/workspace information:
- Basic info: name, slug, description, avatar
- Subscription: tier, status, trial dates, member limits
- Settings: competitive context, signal preferences, retention
- Metadata: active status, creator, timestamps

#### **Team Members Table** (Junction)
Links users to teams with roles and permissions:
- Relationship: user_id + team_id
- Role: owner, admin, manager, member, viewer
- Permissions: invite, manage settings, manage sources
- Activity: last active, joined date, invited by

**Pre-populated teams:**
- 🛠️ Engineering
- 💼 Sales
- 🎯 Product
- 📢 Marketing
- 👔 Executive

### 2. Database Functions

**`get_available_teams()`**
- Returns all active teams that can be joined
- Shows member count for each team
- Used during onboarding to show team options

**`get_user_teams(user_id)`**
- Returns teams the user is already a member of
- Includes role, last active date, member count
- Ordered by most recently active

**`add_user_to_team(user_id, team_id, role, invited_by)`**
- Adds user to a team with specified role
- Updates user's active team_id
- Handles conflicts (if already a member, reactivates)

### 3. IPC Handlers (`desktop2/main/ipc/team-handlers.js`)

**Available handlers:**
- `teams:getAvailable` - Fetch all teams user can join
- `teams:getUserTeams` - Get user's current teams
- `teams:join` - Join a team
- `teams:leave` - Leave a team
- `teams:create` - Create a new team

### 4. Frontend Integration (`desktop2/renderer2/src/pages/LoginFlow.jsx`)

**Updated login flow:**
1. User authenticates (Slack/Microsoft/Google)
2. System checks if user has existing teams
3. If yes → Show their teams
4. If no → Show available teams to join
5. User selects/joins team → Continues to role selection

## 🚀 How to Use

### Step 1: Run the SQL Migration

```bash
# Open Supabase SQL Editor
# Copy and paste contents of: data/storage/team-workspace-setup.sql
# Run the script
```

This will:
- Create `teams` and `team_members` tables
- Add 5 sample teams
- Create helper functions
- Set up Row Level Security policies

### Step 2: Restart the App

```bash
pkill -f "electron.*desktop2"
npm run dev:desktop
```

### Step 3: Test the Flow

1. **New User:**
   - Sign in with Slack/Microsoft/Google
   - See list of available teams
   - Click a team → Join it
   - Or create a new team

2. **Existing User:**
   - Sign in
   - See their existing teams
   - Select which team to use

## 🔧 API Usage Examples

### From Frontend (React)

```javascript
// Get available teams
const result = await window.electronAPI.teams.getAvailable();
console.log(result.teams); // Array of teams

// Get user's teams
const userTeams = await window.electronAPI.teams.getUserTeams();
console.log(userTeams.teams); // User's teams with roles

// Join a team
const joinResult = await window.electronAPI.teams.join(teamId, 'member');
if (joinResult.success) {
  console.log('Joined team:', joinResult.team);
}

// Create a team
const createResult = await window.electronAPI.teams.create({
  name: 'My Team',
  slug: 'my-team',
  description: 'Our awesome team',
  department: 'Engineering'
});
```

### From Main Process (Node.js)

```javascript
// Direct Supabase queries
const { data: teams } = await supabase
  .rpc('get_available_teams');

const { data: userTeams } = await supabase
  .rpc('get_user_teams', { user_uuid: userId });

const { data: memberId } = await supabase
  .rpc('add_user_to_team', {
    p_user_id: userId,
    p_team_id: teamId,
    p_role: 'member',
    p_invited_by: null
  });
```

## 🎯 Team Roles Explained

**Owner** (Highest)
- Created the team
- Full control over everything
- Can delete team
- Can manage all members

**Admin**
- Can manage team settings
- Can invite/remove members
- Can manage integrations
- Cannot delete team

**Manager**
- Can manage data sources
- Can view all team data
- Can invite members (if permission granted)
- Cannot change team settings

**Member** (Default)
- Standard team access
- Can use all features
- Can view team data
- Cannot manage settings

**Viewer** (Lowest)
- Read-only access
- Can view dashboards
- Cannot make changes
- Cannot manage anything

## 🔐 Security (Row Level Security)

**Policies applied:**

1. **View Teams:**
   - Can see teams you're a member of
   - Can see all active teams (for joining)

2. **Update Teams:**
   - Only owners and admins can update team settings

3. **View Members:**
   - Can see your own memberships
   - Owners/admins can see all team members

4. **Manage Members:**
   - Only owners and admins can add/remove members

## 📊 Database Relationships

```
users
  └─ team_id (current active team)
  
teams
  ├─ id (primary key)
  ├─ created_by → users.id
  └─ team_members (junction)
      ├─ team_id → teams.id
      ├─ user_id → users.id
      └─ invited_by → users.id
```

## 🎨 Frontend Display

Teams are displayed with:
- **Avatar** - Emoji or icon
- **Name** - Team name
- **Description** - What the team does
- **Member Count** - How many people
- **Role** - User's role (if already a member)
- **Last Active** - When user last used this team

## 🔄 Future Enhancements

**Admin Control:**
- Approve/deny join requests
- Set team to private (invite-only)
- Manage subscription and billing
- Set custom permissions per member

**Team Features:**
- Team-specific signal sources
- Shared dashboards and reports
- Team chat/collaboration
- Activity feed

**Enterprise Features:**
- SSO integration per team
- Compliance settings
- Audit logs
- Data retention policies

## 🐛 Troubleshooting

**"Failed to load teams"**
- Check Supabase connection
- Verify SQL migration ran successfully
- Check browser console for errors

**"Failed to join team"**
- User might not be authenticated
- Team might be at member limit
- Check RLS policies in Supabase

**Teams not showing**
- Verify `is_active = true` on teams
- Check if RLS policies allow viewing
- Ensure functions are created

## 📝 Files Modified

- ✅ `data/storage/team-workspace-setup.sql` - Database schema
- ✅ `desktop2/main/ipc/team-handlers.js` - IPC handlers
- ✅ `desktop2/main/index.js` - Register handlers
- ✅ `desktop2/bridge/preload.js` - Expose to frontend
- ✅ `desktop2/renderer2/src/pages/LoginFlow.jsx` - UI integration

## 🎉 You're Done!

Users can now:
1. Sign in with their preferred provider
2. See available teams or their existing teams
3. Join a team or create a new one
4. Start using HeyJarvis with team context

The team selection is now backed by real data and ready for admin controls!

