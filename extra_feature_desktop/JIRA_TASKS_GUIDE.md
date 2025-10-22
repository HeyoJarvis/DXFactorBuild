# 📋 JIRA Tasks - User Guide

## Overview

The **JIRA Tasks** tab provides a comprehensive view of all your JIRA issues and tasks directly within Team Sync Intelligence. View, filter, search, and manage your work items without leaving the app.

## 🚀 Features

### 1. Connection Management
- **Connect JIRA** - One-click OAuth integration
- **Connection Status** - Visual indicator of JIRA connectivity
- **Sync Now** - Manual sync to fetch latest tasks from JIRA
- **Auto-sync** - Automatically syncs data in the background

### 2. Task Statistics Dashboard
- **Total Tasks** - Overall count of all tasks
- **Open** - Tasks that haven't been started (📋)
- **In Progress** - Tasks actively being worked on (🔄)
- **Done** - Completed tasks (✅)
- **Color-coded cards** for quick visual reference

### 3. Filtering & Search
- **Filter by Status:**
  - All - Show all tasks
  - Open - Only open tasks
  - In Progress - Tasks being worked on
  - Done - Completed tasks
- **Search Box** - Find tasks by title or description
- **Real-time filtering** - Results update as you type

### 4. Task List View
Each task card shows:
- **Status badge** with icon (📋 Open, 🔄 In Progress, ✅ Done)
- **Priority badge** (Critical, High, Medium, Low)
- **Type badge** (New Issue, Updated, Comment)
- **Task title** and truncated description
- **Assignee** with avatar
- **Creation date**
- **Hover effects** for better UX

### 5. Task Detail Panel
Click any task to see:
- **Full description** with formatting preserved
- **Status and priority** badges
- **Creation date**
- **Assignee** information
- **Project** name
- **JIRA ID** (external ID)
- **Additional metadata** in formatted JSON
- **Close button** to return to list view

## 🎨 UI Design

### Layout
- **Two-panel design:**
  - Left: Scrollable task list
  - Right: Task detail panel
- **Responsive** - Adapts to different screen sizes
- **Mobile-friendly** - Task detail becomes fullscreen modal on small screens

### Color Coding
- **Status Colors:**
  - Open: Blue (#3b82f6)
  - In Progress: Orange (#f59e0b)
  - Done: Green (#10b981)
- **Priority Colors:**
  - Critical: Red (#ef4444)
  - High: Orange (#f59e0b)
  - Medium: Purple (#6366f1)
  - Low: Gray (#6b7280)

### Visual Hierarchy
1. Connection banner at top (green if connected, yellow if not)
2. Statistics cards for quick overview
3. Toolbar with filters and search
4. Task list with detail panel

## 📖 How to Use

### First Time Setup

1. **Click "JIRA Tasks"** in the left sidebar
2. You'll see a connection banner
3. **Click "Connect JIRA"** button
4. Follow the OAuth flow in your browser
5. Grant permissions to your JIRA account
6. Return to the app - you're connected!

### Viewing Tasks

1. **Connection Status** shown at top
2. **Stats overview** shows task distribution
3. **Task list** displays all recent tasks (30 days)
4. **Click any task** to see full details

### Filtering Tasks

1. **Use filter buttons** to show specific statuses:
   - Click "Open" to see only open tasks
   - Click "In Progress" for active work
   - Click "Done" for completed tasks
   - Click "All" to see everything

2. **Use search box** to find specific tasks:
   - Type any keyword
   - Searches title and description
   - Results update instantly

### Syncing Data

**Automatic Sync:**
- Background service syncs periodically
- Shows "Last synced" timestamp
- Data cached locally for fast access

**Manual Sync:**
- Click "🔄 Sync Now" button
- Fetches latest data from JIRA API
- Shows success message with count
- Updates display automatically

### Task Details

1. **Click any task card** in the list
2. Detail panel shows on the right
3. View full information:
   - Complete description
   - All metadata
   - JIRA reference ID
   - Assignee details
4. **Click "✕ Close"** to return to list view

## 💡 Tips & Best Practices

### For Daily Use
- ✅ Check "Open" filter to see pending work
- ✅ Use "In Progress" to track active tasks
- ✅ Search by project name or ticket number
- ✅ Sync manually before important meetings

### Performance
- ✅ Tasks are cached locally (fast loading)
- ✅ Sync only when needed (API rate limits)
- ✅ Filter reduces visual clutter
- ✅ Search helps find tasks quickly

### Organization
- ✅ Keep task list filtered by status
- ✅ Use search for specific items
- ✅ Check stats for quick overview
- ✅ Monitor open tasks count

## 🔧 Technical Details

### Data Sources
- **Database cache** - Fast, local Supabase storage
- **JIRA API** - Live data from your JIRA instance
- **OAuth tokens** - Secure authentication

### Update Types
The system tracks several JIRA update types:
- `jira_issue_created` - New issues
- `jira_issue_updated` - Changed issues
- `jira_comment` - New comments

### Status Detection
Status is determined from:
1. Metadata `status` field (if available)
2. Content text parsing (fallback)
3. Default to "open" if unclear

### Priority Detection
Priority is extracted from:
1. Metadata `priority` field (if available)
2. Content keywords (Critical, High, Medium, Low)
3. Default to "Medium" if unclear

## 🐛 Troubleshooting

### "JIRA Not Connected"
**Solution:**
1. Click "Connect JIRA" button
2. Complete OAuth flow
3. Check permissions granted
4. Try refreshing the page

### "No tasks found"
**Solution:**
1. Click "Sync Now" to fetch from JIRA
2. Check filter settings (try "All")
3. Clear search box
4. Verify JIRA has issues in last 30 days

### "Sync Failed"
**Solution:**
1. Check internet connection
2. Verify JIRA OAuth token is valid
3. Check JIRA instance is accessible
4. Try disconnecting and reconnecting

### Tasks not updating
**Solution:**
1. Click "Sync Now" manually
2. Check "Last synced" timestamp
3. Verify background sync is running
4. Restart the app if needed

## 📱 Keyboard Shortcuts

- **Ctrl+F** - Focus search box (when implemented)
- **Escape** - Close task detail panel
- **Click** - Select task

## 🎯 Use Cases

### Daily Standup Preparation
1. Filter by "In Progress"
2. Review your active tasks
3. Check for blockers
4. Note updates for team

### Sprint Planning
1. View "All" tasks
2. Check stats dashboard
3. Review open items
4. Assign priorities

### Status Updates
1. Filter by assignee (future feature)
2. Check task progress
3. Update stakeholders
4. Track completion rate

### Project Management
1. View all project tasks
2. Monitor status distribution
3. Identify bottlenecks
4. Track team velocity

## 🚀 Future Enhancements

Planned features:
- [ ] Filter by assignee
- [ ] Filter by project
- [ ] Filter by date range
- [ ] Bulk actions
- [ ] Task creation
- [ ] Status updates
- [ ] Comment addition
- [ ] Export to CSV
- [ ] Custom views
- [ ] Saved filters

## 📊 Data Privacy

- **OAuth authentication** - Secure, industry-standard
- **Local caching** - Data stored in your Supabase
- **No third-party sharing** - Your data stays private
- **Token refresh** - Automatic, secure token renewal

---

**Status**: ✅ Fully Functional
**Last Updated**: October 21, 2025

Enjoy managing your JIRA tasks seamlessly! 🎉

