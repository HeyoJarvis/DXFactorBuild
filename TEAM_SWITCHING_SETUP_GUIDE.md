# Team Switching Feature - Setup Guide

## ✅ Current Status

The team switching feature is **FULLY IMPLEMENTED** in the desktop2 app. All components, IPC handlers, and database queries are in place.

## 🏗️ Architecture

### Frontend Components

1. **ModeToggle** (`desktop2/renderer2/src/components/MissionControl/ModeToggle.jsx`)
   - Toggles between Personal and Team modes
   - Displays team selector dropdown in Team mode
   - Shows all available teams for the current user

2. **MissionControl** (`desktop2/renderer2/src/pages/MissionControl.jsx`)
   - Manages mode state (personal/team)
   - Loads teams when switching to team mode
   - Persists selection in localStorage and URL params
   - Auto-selects first team if none selected

3. **TeamChat** (`desktop2/renderer2/src/pages/TeamChat.jsx`)
   - Receives selectedTeam prop
   - Loads chat history for selected team
   - Sends messages with team context

4. **TeamContext** (`desktop2/renderer2/src/components/Teams/TeamContext.jsx`)
   - Displays team meetings, tasks, and code repos
   - Shows in left panel when in Team mode

### Backend (Main Process)

1. **IPC Handlers** (`desktop2/main/ipc/team-chat-handlers.js`)
   - `team-chat:load-teams` - Loads user's teams from database
   - `team-chat:get-history` - Gets chat history for team
   - `team-chat:send-message` - Sends message with team context
   - `team-chat:save-context-settings` - Saves user preferences

2. **Preload Script** (`desktop2/bridge/preload.js`)
   - Exposes `window.electronAPI.teamChat` namespace
   - All IPC calls properly bridged to main process

### Database

Tables used:
- `teams` - Team information
- `team_members` - User-team memberships
- `conversation_sessions` - Chat sessions per team
- `conversation_messages` - Chat messages
- `team_chat_context_settings` - User context preferences

## 🚀 How to Use

### For Users

1. Open Mission Control (`/mission-control` route)
2. Click "Switch to Team" button
3. Select a team from the dropdown
4. Chat with AI using team context (meetings, tasks, code)
5. Use Cmd+T / Ctrl+T to toggle between Personal and Team modes

### For Developers

#### Debug Panel

Press **Cmd+D / Ctrl+D** in Mission Control to show the debug panel. It displays:
- API availability status
- Current teams loaded
- Selected team
- Diagnostic test results

#### Console Logging

The app logs all team switching activity:
```
🔄 MissionControl: Loading teams...
📦 MissionControl: Load teams result: { success: true, teams: [...] }
✅ MissionControl: Loaded 3 teams
📌 Auto-selecting first team: { id: '...', name: '...' }
🔄 MissionControl: Mode changed from personal to team
```

## 🔧 Testing

### Run Database Test

```bash
node test-team-switching.js
```

This verifies:
- Teams table has data
- Team members table is populated
- Users have team memberships
- Sample queries work correctly

### Manual Testing Checklist

- [ ] Click "Switch to Team" button
- [ ] Team dropdown appears and shows teams
- [ ] Select different teams from dropdown
- [ ] Chat loads for selected team
- [ ] Team context (meetings/tasks) shows in left panel
- [ ] Switch back to Personal mode
- [ ] Team selection persists on page refresh

## 🐛 Troubleshooting

### No Teams Show Up

**Symptom:** Dropdown shows "No teams available"

**Solution:**
1. Check console for errors
2. Verify user is member of at least one team in database:
   ```sql
   SELECT * FROM team_members WHERE user_id = 'your_user_id' AND is_active = true;
   ```
3. If no teams, add user to a team or create one during onboarding

### API Not Available Error

**Symptom:** "Team Chat API not available" alert

**Solution:**
1. Check `desktop2/bridge/preload.js` has teamChat namespace
2. Verify `registerTeamChatHandlers()` is called in `desktop2/main/index.js`
3. Restart the app completely

### Teams Load But Chat Doesn't Work

**Symptom:** Team selector works, but chat is empty or errors

**Solution:**
1. Check `conversation_sessions` table has entries
2. Verify AI service is initialized
3. Check console for IPC errors
4. Ensure `team-chat:get-history` handler is registered

## 📝 Implementation Details

### State Management

```javascript
// Mode: 'personal' | 'team'
const [mode, setMode] = useState('personal');

// Teams array from database
const [teams, setTeams] = useState([]);

// Currently selected team
const [selectedTeam, setSelectedTeam] = useState(null);

// Loading state
const [teamsLoading, setTeamsLoading] = useState(false);
```

### Data Flow

1. User clicks "Switch to Team"
2. `handleModeChange()` sets mode to 'team'
3. `useEffect` triggers `loadTeams()`
4. `loadTeams()` calls IPC: `window.electronAPI.teamChat.loadTeams()`
5. Main process queries database for user's teams
6. Teams returned to renderer
7. First team auto-selected
8. TeamChat component loads chat history for selected team

### Persistence

- **Mode**: Saved in localStorage as `missionControlMode`
- **Selected Team**: Saved in localStorage as `missionControlTeamId`
- **URL Params**: `?mode=team&teamId=xxx` for shareable links

## 🎨 UI/UX Features

- **Keyboard Shortcut**: Cmd+T / Ctrl+T to toggle modes
- **Visual Indicator**: Different badges for Personal vs Team mode
- **Loading States**: Shows "Loading teams..." while fetching
- **Empty States**: Helpful messages when no teams available
- **Auto-selection**: First team selected automatically
- **Persistence**: Returns to last selected team on refresh

## ✅ Verification

Run this in the browser console to verify setup:

```javascript
// Check API availability
console.log({
  hasElectronAPI: !!window.electronAPI,
  hasTeamChat: !!window.electronAPI?.teamChat,
  hasLoadTeams: !!window.electronAPI?.teamChat?.loadTeams
});

// Try loading teams
window.electronAPI.teamChat.loadTeams().then(result => {
  console.log('Load teams result:', result);
});
```

Expected output:
```javascript
{
  hasElectronAPI: true,
  hasTeamChat: true,
  hasLoadTeams: true
}

// Then:
{
  success: true,
  teams: [
    { id: '...', name: 'Team Name', slug: 'team-slug', description: '...' },
    // ... more teams
  ]
}
```

## 📚 Related Files

### Frontend
- `desktop2/renderer2/src/components/MissionControl/ModeToggle.jsx`
- `desktop2/renderer2/src/components/MissionControl/ModeToggle.css`
- `desktop2/renderer2/src/pages/MissionControl.jsx`
- `desktop2/renderer2/src/pages/TeamChat.jsx`
- `desktop2/renderer2/src/components/Teams/TeamContext.jsx`
- `desktop2/renderer2/src/components/Debug/TeamSwitchDebug.jsx`

### Backend
- `desktop2/main/ipc/team-chat-handlers.js`
- `desktop2/bridge/preload.js`
- `desktop2/main/index.js` (handler registration)

### Database
- Schema: `data/storage/schema.sql` (teams, team_members tables)
- Queries in `team-chat-handlers.js`

## 🎯 Next Steps

The feature is complete. To enhance it further:

1. **Add Team Creation UI** - Allow users to create teams from the app
2. **Team Invitations** - Invite other users to join teams
3. **Team Settings** - Manage team name, description, members
4. **Team Permissions** - Role-based access (admin, member, viewer)
5. **Team Analytics** - Track team activity and engagement


