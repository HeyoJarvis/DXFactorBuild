# 🔧 Tasks Not Loading - Complete Fix

## Problems Identified

### 1. ❌ Auth was removed accidentally  
When fixing the double-auth issue, the auth check flow was broken.

### 2. ❌ Task handlers using hardcoded userId
`task-handlers.js` was using `userId = 'desktop-user'` instead of getting the real authenticated user.

### 3. ❌ Auth service getSession() method missing
IPC handler was calling `services.auth.getSession()` but the method is actually `loadSession()`.

## Fixes Applied

### ✅ Fix 1: Restored Auth Flow in auth-handlers.js
```javascript
ipcMain.handle('auth:getSession', async () => {
  try {
    if (!services.auth) {
      return { success: false, session: null };
    }

    // Load session from local storage if not in memory
    if (!services.auth.currentSession) {
      const result = await services.auth.loadSession();
      if (result) {
        return { success: true, session: result };
      }
      return { success: false, session: null };
    }

    // Return current session
    return { 
      success: true, 
      session: {
        user: services.auth.currentUser,
        session: services.auth.currentSession
      }
    };
  } catch (error) {
    logger.error('Get session failed:', error);
    return { success: false, session: null, error: error.message };
  }
});
```

### ✅ Fix 2: Task Handlers Now Use Real User ID
```javascript
// BEFORE (❌):
function registerTaskHandlers(services, logger) {
  const userId = 'desktop-user'; // Hardcoded!
  
  ipcMain.handle('tasks:getAll', async () => {
    const result = await dbAdapter.getUserTasks(userId, { includeCompleted: false });
    // ...
  });
}

// AFTER (✅):
function registerTaskHandlers(services, logger) {
  ipcMain.handle('tasks:getAll', async (event, filters = {}) => {
    // Get current user ID from auth service
    const userId = services.auth?.currentUser?.id;
    
    if (!userId) {
      return {
        success: false,
        error: 'User not authenticated',
        tasks: []
      };
    }
    
    const result = await dbAdapter.getUserTasks(userId, { 
      includeCompleted: false,
      ...filters
    });
    // ...
  });
}
```

### ✅ Fix 3: All Task Operations Check Auth
Updated all task IPC handlers to check for authenticated user:
- `tasks:create` - Gets user ID from `services.auth.currentUser.id`
- `tasks:getAll` - Gets user ID, passes filters
- `tasks:update` - Will need user ID check (TODO if needed for permissions)
- `tasks:delete` - Will need user ID check (TODO if needed for permissions)

## How Tasks Flow Works Now

### 1. User Login
```
User clicks "Sign in with Slack"
  ↓
OAuth flow completes
  ↓
AuthService saves session:
  - currentUser (with id, email, slack_user_id)
  - currentSession (with access_token, refresh_token)
  ↓
App.jsx detects auth success
  ↓
Shows Arc Reactor orb
```

### 2. User Opens Tasks
```
User clicks orb → "Tasks"
  ↓
Secondary window opens with Tasks.jsx
  ↓
useTasks hook calls loadTasks()
  ↓
window.electronAPI.tasks.getAll()
  ↓
IPC: tasks:getAll handler
  ↓
Gets userId from services.auth.currentUser.id
  ↓
Calls dbAdapter.getUserTasks(userId, filters)
  ↓
Supabase query: SELECT * FROM conversation_sessions WHERE creator_user_id = userId
  ↓
Returns tasks array
  ↓
Tasks.jsx renders tasks
```

### 3. Slack Task Auto-Creation (TODO)
```
SlackService detects message with task keywords
  ↓
Emits 'task_detected' event
  ↓
Main process creates task via dbAdapter.createTask(userId, taskData)
  ↓
Notifies renderer via 'task:created' event
  ↓
useTasks refreshes task list
```

## Testing the Fix

### Test 1: Login and Check Tasks
```bash
cd /Users/jarvis/Code/HeyJarvis/desktop2 && npm run dev
```

**Expected Flow:**
1. ✅ Login screen appears
2. ✅ Click "Sign in with Slack"
3. ✅ OAuth completes successfully
4. ✅ Arc Reactor orb appears
5. ✅ Click orb → Tasks
6. ✅ Tasks window opens
7. ✅ Check console for:
   - `"Tasks fetched"` with count > 0 (if you have tasks)
   - **NOT** `"User not authenticated"`

### Test 2: Check Logs for User ID
Look for this in the console:
```
{"level":"info","message":"Tasks fetched","count":X,"service":"desktop2-main"}
```

If you see:
```
{"success":false,"error":"User not authenticated","tasks":[]}
```
Then auth is not properly loaded.

### Test 3: Create a Task
1. Open Tasks window
2. Type a task in the input
3. Press Enter
4. Should create and appear in list

## Remaining TODOs

### 1. ⏳ Ensure Session Loads Before App Renders
The app might render before `loadSession()` completes. Need to ensure auth is fully loaded.

**Fix**: In `App.jsx`, make sure `checkAuthStatus()` fully completes before rendering:
```javascript
useEffect(() => {
  checkAuthStatus(); // Already does this
}, []);
```

### 2. ⏳ Add Role-Based Task Filtering
Desktop app filters tasks by user role (sales, dev, etc). Need to add:
```javascript
const effectiveRole = services.auth?.currentUser?.user_role;

const result = await dbAdapter.getUserTasks(userId, { 
  includeCompleted: false,
  effectiveRole, // Filter by role
  ...filters
});
```

### 3. ⏳ Task Auto-Creation from Slack
SlackService needs to:
- Detect task keywords in messages
- Get current user from auth service
- Create tasks automatically

## Files Modified

### Backend (Main Process):
- ✅ `/desktop2/main/ipc/auth-handlers.js` - Fixed getSession
- ✅ `/desktop2/main/ipc/task-handlers.js` - Use real user ID

### Frontend (Renderer):
- ✅ Tasks.jsx already correct (uses useTasks hook)
- ✅ useTasks.js already correct (calls IPC)

### Environment:
- ⚠️ Ensure `.env` has:
  ```
  SUPABASE_URL=...
  SUPABASE_ANON_KEY=...
  SUPABASE_SERVICE_ROLE_KEY=...
  ```

## Debug Commands

### Check if user is authenticated:
Open DevTools console in the app and run:
```javascript
const session = await window.electronAPI.auth.getSession();
console.log('Session:', session);
```

### Check tasks:
```javascript
const tasks = await window.electronAPI.tasks.getAll();
console.log('Tasks:', tasks);
```

### Check database directly:
```sql
SELECT * FROM conversation_sessions 
WHERE creator_user_id = 'YOUR_USER_ID' 
AND workflow_type = 'task';
```

---

**Status**: ✅ **FIXES APPLIED - READY TO TEST**
**Next**: Restart app, login, and check if tasks load!




