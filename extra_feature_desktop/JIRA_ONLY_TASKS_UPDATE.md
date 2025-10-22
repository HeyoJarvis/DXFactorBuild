# JIRA-Only Tasks Filter Update

## Changes Made

The Teams data assignment interface now shows **only JIRA issues** in the Tasks tab, filtering out GitHub PRs and commits.

## Updated Files

### 1. Backend - `TeamSyncSupabaseAdapter.js`
**Method:** `getUnassignedTasks(userId)`

**Before:**
```javascript
.from('team_updates')
.select('*')
.eq('user_id', userId)
.is('app_team_id', null)
```

**After:**
```javascript
.from('team_updates')
.select('*')
.eq('user_id', userId)
.eq('update_type', 'jira_issue')  // ✅ Only JIRA issues
.is('app_team_id', null)
```

### 2. Frontend - `TeamDataAssignment.jsx`

**Changes:**
- ✅ Tab label: "📋 Tasks" → "📋 JIRA Issues"
- ✅ Header: "Unassigned Tasks" → "Unassigned JIRA Issues"
- ✅ Empty state: Updated to mention JIRA issues specifically
- ✅ Metadata display: Simplified to show only JIRA-relevant info (status, author)

## What's Filtered Out

The Tasks tab will **no longer show**:
- ❌ GitHub Pull Requests (`github_pr`)
- ❌ GitHub Commits (`github_commit`)

## What's Shown

The Tasks tab will **only show**:
- ✅ JIRA Issues (`jira_issue`)

## User Experience

When users click "Assign Data" → "JIRA Issues" tab, they will see:
- JIRA issue key (e.g., PROJ-123)
- Issue title
- Status (e.g., "In Progress", "Done")
- Assignee name (if available)

## Testing

After restarting the app:
1. Go to Teams page
2. Select a team
3. Click "Assign Data"
4. Navigate to "JIRA Issues" tab
5. Should only see JIRA issues, no GitHub PRs or commits

## No Database Changes Required

This is a pure code change - just restart the app to apply!

```bash
# Restart to see changes
pkill -f "electron"
cd /home/sdalal/test/BeachBaby/extra_feature_desktop
npm start
```

