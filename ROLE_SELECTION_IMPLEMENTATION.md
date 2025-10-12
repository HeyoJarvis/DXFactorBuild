# Role Selection Implementation

## ✅ Implementation Complete

Users now choose between **Developer** and **Sales/Functional** roles after sign-in, with role-specific features and UI.

## What Was Implemented

### 1. Database Schema (`data/migrations/add-user-role.sql`)
- Added `user_role` column to `users` table
- Supports values: `'developer'` or `'sales'`
- Indexed for performance
- Existing users default to `NULL` (will be prompted to choose)

### 2. Role Selection UI (`desktop/renderer/role-selection.html`)
- Beautiful, modern interface with two role cards
- Developer role: JIRA, GitHub, code indexing features
- Sales role: CRM, Slack, task management features
- Smooth animations and hover effects
- Keyboard support (Enter to continue)

### 3. Authentication Service Updates (`desktop/services/auth-service.js`)
Added new methods:
- `saveUserRole(role)` - Save user's selected role to database
- `getUserRole()` - Get current user's role
- `needsRoleSelection()` - Check if user needs to choose role

### 4. Desktop App Integration (`desktop/main.js`)
- Created `createRoleSelectionWindow()` function
- Updated `initializeApp()` to check for role selection need
- Added `roleSelectionWindow` variable
- Updated sign-in flow to show role selection if needed
- Added IPC handlers:
  - `auth:save-user-role` - Save role selection
  - `auth:complete-role-selection` - Close role window, open main app

### 5. IPC Bridge Updates (`desktop/bridge/preload.js`)
Exposed new auth methods:
- `saveUserRole(role)`
- `completeRoleSelection()`

### 6. Role-Based UI (`desktop/renderer/unified.html`)
Added role-based feature control:
- `initializeRoleBasedUI()` - Initialize UI based on user role
- `showDeveloperFeatures()` - Enable dev-specific features
- `showJiraPlaceholder()` - Show JIRA integration placeholder for developers

**For Developers:**
- Tasks section shows "JIRA Integration Coming Soon" placeholder
- Task input is disabled
- GitHub connection button visible
- Future: JIRA button, Code Indexer button

**For Sales:**
- Full task management functionality
- CRM features
- Slack integration
- Microsoft 365 integration

## User Flow

```
1. User signs in with Slack
        ↓
2. Check if user.user_role exists
        ↓
   No ───────→ Show role selection window
   Yes ──────→ Show main app with role-specific features
        ↓
3. User chooses Developer or Sales
        ↓
4. Role saved to database
        ↓
5. Role selection window closes
        ↓
6. Main app opens with appropriate features
```

## Database Migration

**Run this SQL in your Supabase SQL Editor:**

```sql
-- Copy contents of data/migrations/add-user-role.sql
```

Or via Supabase CLI:
```bash
supabase migration new add_user_role
# Copy contents from data/migrations/add-user-role.sql
supabase db push
```

## Testing

### Test New User Flow
1. Sign in with a new user
2. Should see role selection screen
3. Choose Developer or Sales
4. Main app should open with appropriate features

### Test Existing User
1. Sign in with existing user (user_role = NULL)
2. Should see role selection screen
3. Choose role
4. On next sign-in, should go directly to main app

### Test Role-Specific Features

**Developer Role:**
```javascript
// In unified.html console:
window.electronAPI.auth.getUser()
// Should show: { ..., user_role: 'developer' }

// Tasks section should show JIRA placeholder
// Task input should be disabled
```

**Sales Role:**
```javascript
// In unified.html console:
window.electronAPI.auth.getUser()
// Should show: { ..., user_role: 'sales' }

// Tasks section should be fully functional
// Can create and manage tasks
```

## Future Enhancements

### For Developers
- [ ] Add JIRA OAuth button to top bar
- [ ] Add Code Indexer button to query repositories
- [ ] Show GitHub PR/Issue notifications
- [ ] Add CI/CD pipeline status
- [ ] Sprint velocity analytics

### For Sales
- [ ] CRM deal pipeline view
- [ ] Sales leaderboard
- [ ] Quote/proposal generator
- [ ] Email campaign insights

## Files Modified/Created

### Created (3 files)
- `desktop/renderer/role-selection.html` - Role selection UI
- `data/migrations/add-user-role.sql` - Database migration
- `ROLE_SELECTION_IMPLEMENTATION.md` - This file

### Modified (4 files)
- `desktop/services/auth-service.js` - Added role management methods
- `desktop/main.js` - Integrated role selection flow
- `desktop/bridge/preload.js` - Exposed auth methods
- `desktop/renderer/unified.html` - Role-based UI logic

## Notes

- Existing users with `NULL` role will be prompted to choose on next sign-in
- Role can be changed later (future feature: settings page)
- Role determines which features are shown/enabled
- Developer tasks are placeholder until JIRA integration is complete
- Sales users retain full existing functionality

## GitHub Connection Status

The GitHub connection status is checked via `engineering:healthCheck` IPC handler, which calls `engineeringIntelligence.healthCheck()`. The health check returns:

```javascript
{
  status: 'healthy' | 'unhealthy',
  github: 'connected' | 'disconnected',
  authType: 'GitHub App',
  appId: '...',
  repoCount: 6
}
```

The UI checks for `result.status === 'healthy' && result.github === 'connected'` to show the GitHub button as connected.

**If GitHub shows as not connected:**
1. Check console logs in the app for health check results
2. Verify GitHub App credentials in `.env`
3. Ensure GitHub App is installed on your repositories
4. Check that `GITHUB_APP_PRIVATE_KEY_PATH` points to correct file
5. Restart the app after updating `.env`

## Success! 🎉

Users can now:
✅ Choose their role after sign-in (one-time)
✅ See role-appropriate features
✅ Developers see JIRA placeholder (ready for integration)
✅ Sales users have full task management
✅ GitHub integration works for both roles

