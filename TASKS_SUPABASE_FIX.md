# Tasks (Sales) Supabase Connection Fix

## Problem
Tasks created from Slack were not appearing in the Tasks (Sales) UI, even though they were being logged as created successfully.

## Root Cause
**User ID Mismatch:**
- When Slack detected tasks and auto-created them, it used the hardcoded string `'desktop-user'` as the user ID
- When the UI fetched tasks, it used the actual authenticated user's ID from `services.auth.currentUser.id`
- Because these IDs didn't match, the query returned no tasks

```javascript
// BEFORE - Slack task creation (index.js:100)
const result = await appState.services.dbAdapter.createTask('desktop-user', taskData);
//                                                             ^^^^^^^^^^^^^^ Hardcoded!

// Task fetching (task-handlers.js:62)
const userId = services.auth?.currentUser?.id;  // Real UUID
const result = await dbAdapter.getUserTasks(userId, ...);
```

## Solution

### 1. Use Authenticated User ID for Task Creation
**File:** `desktop2/main/index.js`

```javascript
// Setup Slack task auto-creation
appState.services.slack.on('task-detected', async (taskData) => {
  try {
    logger.info('Auto-creating task from Slack', { title: taskData.title });
    
    // Get current authenticated user ID
    const userId = appState.services.auth?.currentUser?.id;
    if (!userId) {
      logger.error('Cannot create task: No authenticated user');
      return;
    }
    
    const result = await appState.services.dbAdapter.createTask(userId, taskData);
    // ... rest of the code
  }
});
```

### 2. Enhanced Logging for Debugging
**File:** `desktop2/main/ipc/task-handlers.js`

Added detailed logging to help debug future issues:

```javascript
ipcMain.handle('tasks:getAll', async (event, filters = {}) => {
  try {
    const userId = services.auth?.currentUser?.id;
    
    logger.info('Fetching tasks', { 
      userId,
      isAuthenticated: !!userId,
      filters 
    });
    
    if (!userId) {
      logger.warn('Cannot fetch tasks: No authenticated user');
      return { success: false, error: 'User not authenticated', tasks: [] };
    }
    
    const result = await dbAdapter.getUserTasks(userId, { 
      includeCompleted: false,
      ...filters
    });
    
    logger.info('Tasks fetched successfully', { 
      count: result.tasks.length,
      userId 
    });
    
    return { success: true, tasks: result.tasks };
  }
});
```

## How Tasks Flow

### Task Creation from Slack
1. **Slack message detected** → `SlackService.detectAndCreateTask()`
2. **Routing decision** → Determines `routeTo: 'mission-control'` or `'tasks-sales'`
3. **Event emitted** → `slack.emit('task-detected', taskData)`
4. **Task created in DB** → `dbAdapter.createTask(userId, taskData)`
5. **UI notified** → `mainWindow.webContents.send('task:created', task)`
6. **UI refreshes** → `useTasks` hook calls `loadTasks()`

### Task Fetching in UI
1. **Component mounts** → `useTasks()` hook initializes
2. **Load tasks** → `window.electronAPI.tasks.getAll()`
3. **IPC call** → `tasks:getAll` handler
4. **Query DB** → `dbAdapter.getUserTasks(userId, filters)`
5. **Return data** → Tasks array sent back to UI
6. **Render** → Tasks displayed in `Tasks.jsx`

## Database Schema

Tasks are stored in the `conversation_sessions` table with:
- `user_id`: UUID of the task owner (must match authenticated user)
- `workflow_type`: 'task' (filter to get only tasks)
- `session_title`: Task title
- `workflow_metadata`: JSON containing:
  - `priority`: 'low' | 'medium' | 'high' | 'urgent'
  - `tags`: Array of tags (e.g., ['slack-auto', 'calendar'])
  - `workType`: 'task' | 'calendar' | 'outreach'
  - `routeTo`: 'mission-control' | 'tasks-sales'
  - `assignor`: User who assigned the task
  - `assignee`: User assigned to the task
  - `mentioned_users`: Array of mentioned users

## Testing

### Verify Fix Works
1. **Restart desktop2 app**
   ```bash
   cd desktop2
   npm start
   ```

2. **Check authentication**
   - Login to the app
   - Verify you see your user info in the header

3. **Send Slack message**
   - Send a message like: "Can you finish the MVP?"
   - Check logs for: `"Auto-creating task from Slack"`
   - Check logs for: `"Task auto-created from Slack"`

4. **Verify task appears**
   - Navigate to Tasks (Sales) page
   - Task should appear in the list
   - Check browser console for any errors

### Debug if Tasks Still Don't Appear

1. **Check Authentication**
   ```bash
   # In browser console
   console.log(await window.electronAPI.auth.getCurrentUser());
   ```
   Should show your user object with `id` field

2. **Check Task Creation**
   ```bash
   # Check logs
   tail -f desktop2/logs/*.log | grep -i "task"
   ```
   Look for:
   - `"Auto-creating task from Slack"`
   - `"Task auto-created from Slack"` with taskId
   - User ID in the logs

3. **Check Task Fetching**
   ```bash
   # In browser console
   const result = await window.electronAPI.tasks.getAll();
   console.log(result);
   ```
   Should show `{ success: true, tasks: [...] }`

4. **Check Supabase Directly**
   ```sql
   SELECT id, user_id, session_title, workflow_type, workflow_metadata
   FROM conversation_sessions
   WHERE workflow_type = 'task'
   ORDER BY started_at DESC
   LIMIT 10;
   ```

## Files Changed

1. `desktop2/main/index.js`
   - Fixed Slack task creation to use authenticated user ID
   - Added authentication check before creating tasks

2. `desktop2/main/ipc/task-handlers.js`
   - Enhanced logging for task fetching
   - Added detailed error messages

## Next Steps

1. **Monitor logs** after restart to see if tasks are being created with correct user IDs
2. **Test Slack integration** by sending task-creating messages
3. **Verify UI updates** by checking Tasks page for new items
4. **Check routing** to ensure calendar/outreach items go to Mission Control

---

## Quick Reference

### Check User ID in Logs
```bash
tail -f desktop2/logs/*.log | grep -E "(userId|user_id)"
```

### Force Refresh Tasks in UI
```javascript
// In browser console
await window.electronAPI.tasks.getAll();
```

### Create Test Task Manually
```javascript
// In browser console
await window.electronAPI.tasks.create({
  title: 'Test Task',
  priority: 'medium',
  description: 'This is a test',
  tags: ['manual-test']
});
```

