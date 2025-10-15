# JIRA Integration for Developer Tasks

## Overview
The HeyJarvis desktop2 app now includes real JIRA integration, allowing developers to view and manage their assigned issues directly within the Tasks page.

## Features Implemented

### ✅ Backend Integration
- **JIRA Service** (`desktop2/main/services/JIRAService.js`)
  - Initialize with user tokens from Supabase
  - Fetch assigned issues with JQL queries
  - Sync tasks to Supabase database
  - Update and transition issues
  - Token refresh handling
  - Auto-sync every 10 minutes

- **JIRA IPC Handlers** (`desktop2/main/ipc/jira-handlers.js`)
  - `jira:checkConnection` - Check if JIRA is connected
  - `jira:authenticate` - OAuth flow for authentication
  - `jira:disconnect` - Disconnect JIRA integration
  - `jira:getMyIssues` - Fetch user's assigned issues
  - `jira:syncTasks` - Sync JIRA issues to Supabase
  - `jira:updateIssue` - Update JIRA issue fields
  - `jira:transitionIssue` - Change issue status
  - `jira:healthCheck` - Check JIRA service health

- **OAuth Handler** (`oauth/jira-oauth-handler.js`)
  - PKCE OAuth 2.0 flow
  - Token management and refresh
  - Cloud ID detection
  - Browser-based authentication

### ✅ Frontend Integration
- **TasksDeveloper Component** (`desktop2/renderer2/src/pages/TasksDeveloper.jsx`)
  - Real JIRA data fetching
  - JIRA authentication UI
  - Connection status indicator
  - Sync button with status feedback
  - Transform JIRA issues to action item format
  - Parse user stories and acceptance criteria
  - Calculate progress and confidence levels
  - Mock data fallback when not connected

- **Preload Bridge** (`desktop2/bridge/preload.js`)
  - Exposes JIRA APIs to renderer via `window.electronAPI.jira`
  - Secure IPC communication

### ✅ UI Features
- **Connection Status Badge**
  - Shows JIRA logo when connected
  - Animated green dot indicates active connection
  - Displays site URL on hover

- **Connect Button**
  - Visible when JIRA not connected
  - Triggers OAuth flow in browser
  - Shows connection progress

- **Sync Button**
  - Manual sync trigger
  - Refresh icon with hover effects
  - Shows sync status messages

- **Status Messages**
  - Success: "Loaded X issues"
  - Progress: "Syncing with JIRA..."
  - Error: Warning icon with error details

### ✅ Data Transformation
The integration transforms JIRA issues into the action item format with:
- Epic name from JIRA epic or labels
- User story parsing from description
- Acceptance criteria extraction
- Priority and status mapping
- Progress calculation based on status
- Story points tracking
- Task breakdown (todo/in progress/done)
- Repository and branch extraction
- Relative time formatting
- Cycle time calculation
- Block reason for blocked issues

## Setup Instructions

### 1. Environment Variables
Add to your `.env` file:
```bash
# JIRA OAuth Credentials
JIRA_CLIENT_ID=your_client_id
JIRA_CLIENT_SECRET=your_client_secret
JIRA_REDIRECT_URI=http://localhost:8890/auth/jira/callback
```

### 2. Create JIRA OAuth App
1. Go to https://developer.atlassian.com/console/myapps/
2. Create a new OAuth 2.0 (3LO) app
3. Set redirect URI to `http://localhost:8890/auth/jira/callback`
4. Add scopes:
   - `read:jira-work`
   - `write:jira-work`
   - `read:jira-user`
   - `offline_access`
5. Copy Client ID and Secret to `.env`

### 3. Supabase Schema
The integration uses the existing `users` table with `integration_settings` JSONB column:
```sql
-- JIRA tokens are stored here
users.integration_settings = {
  "jira": {
    "access_token": "...",
    "refresh_token": "...",
    "token_expiry": "2024-01-01T00:00:00Z",
    "cloud_id": "...",
    "site_url": "https://your-domain.atlassian.net"
  }
}
```

## Usage

### For Users

#### First Time Setup
1. Open the Developer Tasks page
2. Click the "Connect" button in the header
3. Browser will open with JIRA OAuth page
4. Authorize HeyJarvis to access your JIRA
5. Return to the app - issues will load automatically

#### Daily Use
- **View Issues**: All assigned issues appear as action items
- **Manual Sync**: Click the refresh icon to sync latest changes
- **Auto Sync**: Issues sync automatically every 10 minutes
- **Task Details**: Click any card to see full JIRA details
- **Chat**: Use the chat icon to discuss tasks with AI

### For Developers

#### Fetching Issues
```javascript
const result = await window.electronAPI.jira.getMyIssues({
  status: 'In Progress,To Do,Code Review'
});
```

#### Syncing Tasks
```javascript
const result = await window.electronAPI.jira.syncTasks();
console.log(`Created: ${result.tasksCreated}, Updated: ${result.tasksUpdated}`);
```

#### Updating Issues
```javascript
await window.electronAPI.jira.updateIssue('PROJ-123', {
  summary: 'New title',
  description: 'New description',
  priority: { name: 'High' }
});
```

#### Transitioning Status
```javascript
await window.electronAPI.jira.transitionIssue('PROJ-123', 'In Progress');
```

## JIRA Issue Format

### API Response Structure
```javascript
{
  id: '10001',
  key: 'PROJ-123',
  summary: 'Implement OAuth 2.0',
  description: 'As a user\nWhen I...\nSo that...',
  status: { name: 'In Progress' },
  priority: { name: 'High' },
  assignee: { name: 'John Doe', email: '...' },
  created: '2024-01-01T00:00:00Z',
  updated: '2024-01-02T00:00:00Z',
  story_points: 5,
  sprint: 'Sprint 48',
  labels: ['backend', 'security'],
  epic: { name: 'User Authentication' },
  url: 'https://your-domain.atlassian.net/browse/PROJ-123'
}
```

### Transformed Action Item
```javascript
{
  id: 'PROJ-123',
  epicName: 'User Authentication',
  title: 'Implement OAuth 2.0',
  userStory: {
    asA: 'User',
    whenI: 'Sign in with GitHub',
    soThat: 'I can access the platform'
  },
  acceptanceCriteria: ['OAuth flow implemented', '...'],
  assignees: ['John Doe'],
  priority: 'High',
  status: 'In Progress',
  confidence: 'on-track',
  progress: 40,
  storyPoints: { completed: 2, total: 5 },
  taskBreakdown: { todo: 2, inProgress: 3, done: 8 },
  repository: 'heyjarvis/backend',
  branch: 'feature/proj-123',
  lastUpdated: '2 hours ago',
  cycleTime: '2.1 days',
  sprint: 'Sprint 48',
  jiraUrl: '...'
}
```

## Progress Calculation Logic

### Status-Based Progress
- **Done**: 100%
- **Testing**: 80%
- **Code Review**: 70%
- **In Progress**: 40%
- **To Do**: 10%

### Confidence Level
- **off-track**: Status is "Blocked"
- **at-risk**: Highest priority but < 50% progress
- **on-track**: All other cases

## Troubleshooting

### Connection Issues
1. Check `.env` has correct JIRA credentials
2. Verify OAuth redirect URI matches exactly
3. Check network connectivity
4. View logs: `desktop2/main/logs/main.log`

### Token Expiry
- Tokens auto-refresh when expired
- If refresh fails, disconnect and reconnect JIRA
- Check `users.integration_settings.jira.token_expiry`

### Missing Issues
- Ensure JQL query includes your status values
- Default: `assignee = currentUser() AND status IN (...)`
- Modify in `JIRAService.getMyIssues()` if needed

### Parse Errors
- User story format must be:
  ```
  As a [role]
  When I [action]
  So that [benefit]
  ```
- Acceptance criteria should be:
  ```
  Acceptance Criteria:
  • Criterion 1
  • Criterion 2
  ```

## Future Enhancements

### Planned Features
- [ ] Inline editing of JIRA fields
- [ ] Create new JIRA issues from app
- [ ] Real-time webhook updates
- [ ] Comment on issues
- [ ] Attach files
- [ ] Link to GitHub PRs
- [ ] Sprint planning view
- [ ] Burndown charts
- [ ] Velocity tracking

### GitHub Integration
- [ ] Auto-detect repository from JIRA issue
- [ ] Link PRs to JIRA issues
- [ ] Show PR status in cards
- [ ] Commit activity tracking
- [ ] Branch status

## Architecture

### Data Flow
```
User Action (Frontend)
  ↓
IPC Handler (Main Process)
  ↓
JIRA Service
  ↓
JIRA API (Atlassian)
  ↓
Transform & Store (Supabase)
  ↓
Display (Frontend)
```

### State Management
- **Frontend State**: React hooks (`useState`, `useEffect`)
- **Backend State**: JIRA Service instance with tokens
- **Persistence**: Supabase `users.integration_settings`
- **Cache**: In-memory for active session

### Security
- OAuth 2.0 with PKCE
- Tokens stored in Supabase (encrypted at rest)
- Auto token refresh
- No sensitive data in renderer
- Secure IPC with contextBridge

## Testing

### Manual Testing
1. Connect JIRA account
2. Verify issues load
3. Test manual sync
4. Check status updates
5. Verify auto-sync (wait 10 minutes)
6. Disconnect and reconnect

### Debug Mode
Enable debug logging in `.env`:
```bash
NODE_ENV=development
LOG_LEVEL=debug
```

View logs:
```bash
tail -f ~/Library/Application\ Support/heyjarvis-desktop2/logs/main.log
```

## Support

For issues or questions:
1. Check logs for error messages
2. Verify JIRA credentials in `.env`
3. Test JIRA API connection separately
4. Review Supabase `integration_settings`

## Credits

Built using:
- `core/integrations/jira-service.js` - Core JIRA integration
- `oauth/jira-oauth-handler.js` - OAuth flow
- Atlassian REST API v3
- React 18 with hooks
- Electron IPC

