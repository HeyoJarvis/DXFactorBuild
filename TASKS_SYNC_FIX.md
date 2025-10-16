# Tasks Database Sync Fix

## Problem
Tasks created from Slack and task chat messages weren't syncing properly to the database because they were using a hardcoded `'desktop-user'` ID instead of the authenticated user's ID.

## Root Cause
Two places had hardcoded user IDs:
1. **Task Creation from Slack** (Fixed previously in `desktop2/main/index.js`)
2. **Task Chat Sessions** (Fixed now in `desktop2/main/ipc/task-chat-handlers.js`)

## Solution

### Task Chat Handler Fix
**File:** `desktop2/main/ipc/task-chat-handlers.js`

**BEFORE:**
```javascript
function registerTaskChatHandlers(services, logger) {
  const { dbAdapter, ai } = services;
  const userId = 'desktop-user'; // ❌ Hardcoded!
  
  ipcMain.handle('tasks:sendChatMessage', async (event, taskId, message, requestContext) => {
    // ... creates session with hardcoded userId
    const sessionResult = await dbAdapter.getOrCreateActiveSession(userId, {
      workflow_type: 'task_chat',
      // ...
    });
  });
}
```

**AFTER:**
```javascript
function registerTaskChatHandlers(services, logger) {
  const { dbAdapter, ai } = services;
  // ✅ No hardcoded userId!
  
  ipcMain.handle('tasks:sendChatMessage', async (event, taskId, message, requestContext) => {
    // Get current authenticated user ID
    const userId = services.auth?.currentUser?.id;
    
    if (!userId) {
      logger.error('Task chat: No authenticated user');
      return {
        success: false,
        error: 'User not authenticated'
      };
    }
    
    logger.info('Task chat message received', { taskId, userId });
    
    // ... creates session with real userId
    const sessionResult = await dbAdapter.getOrCreateActiveSession(userId, {
      workflow_type: 'task_chat',
      // ...
    });
  });
}
```

## How Task Syncing Works

### Task Lifecycle

#### 1. Task Creation
**From Slack:**
```
Slack message → SlackService detects task → Emits 'task-detected' event
→ index.js listener → dbAdapter.createTask(userId, taskData)
→ Saved to conversation_sessions table with workflow_type='task'
→ UI notified via 'task:created' event
```

**Manually:**
```
UI → tasks:create IPC → task-handlers.js → dbAdapter.createTask(userId, taskData)
→ Saved to conversation_sessions table
→ Returns success to UI
```

#### 2. Task Display
```
Tasks.jsx loads → useTasks hook → window.electronAPI.tasks.getAll()
→ tasks:getAll IPC → dbAdapter.getUserTasks(userId, filters)
→ Query: SELECT * FROM conversation_sessions WHERE user_id = ? AND workflow_type = 'task'
→ Returns tasks array → UI renders
```

#### 3. Task Updates
```
UI changes task → window.electronAPI.tasks.update({taskId, updates})
→ tasks:update IPC → dbAdapter.updateTask(taskId, updates)
→ UPDATE conversation_sessions SET ... WHERE id = taskId
→ Returns updated task → UI refreshes
```

#### 4. Task Chat
```
User sends chat message → window.electronAPI.tasks.sendChatMessage(taskId, message, context)
→ tasks:sendChatMessage IPC → Gets/creates task_chat session
→ AI generates response with context
→ dbAdapter.saveMessageToSession() saves both user and AI messages
→ Returns AI response → UI displays
```

### Database Schema

**Table:** `conversation_sessions`

```sql
CREATE TABLE conversation_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  workflow_type TEXT NOT NULL, -- 'task' or 'task_chat'
  workflow_id TEXT, -- e.g., 'task_abc123'
  session_title TEXT,
  workflow_metadata JSONB, -- Contains priority, tags, assignor, etc.
  is_completed BOOLEAN DEFAULT false,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  last_activity_at TIMESTAMP
);
```

**Table:** `conversation_messages`

```sql
CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES conversation_sessions(id),
  role TEXT NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP
);
```

## Task Data Flow

### Creating a Task from Slack

```javascript
// 1. Slack Service detects task
SlackService.detectAndCreateTask(message) {
  const taskData = {
    title: extractTaskTitle(message.text),
    priority: 'medium',
    description: message.text,
    tags: ['slack-auto', 'calendar'],
    workType: 'calendar',
    routeTo: 'mission-control',
    mentionedUsers: extractMentions(message.text)
  };
  
  this.emit('task-detected', taskData);
}

// 2. Main process handles event
appState.services.slack.on('task-detected', async (taskData) => {
  const userId = appState.services.auth?.currentUser?.id;
  const result = await appState.services.dbAdapter.createTask(userId, taskData);
  
  // 3. Notify UI
  mainWindow.webContents.send('task:created', result.task);
});

// 4. UI listens and refreshes
window.electronAPI.onTaskCreated(() => {
  loadTasks(); // Refresh task list
});
```

### Task Chat Conversation

```javascript
// 1. User sends message
const response = await window.electronAPI.tasks.sendChatMessage(
  taskId,
  "How do I complete this task?",
  { task: currentTask }
);

// 2. IPC handler processes
ipcMain.handle('tasks:sendChatMessage', async (event, taskId, message, requestContext) => {
  const userId = services.auth.currentUser.id;
  
  // Get or create task-specific chat session
  const sessionResult = await dbAdapter.getOrCreateActiveSession(userId, {
    workflow_type: 'task_chat',
    workflow_id: `task_${taskId}`,
    task_id: taskId
  });
  
  // Build context from Slack, CRM, etc.
  const aiContext = { taskContext: task, slackData, crmData };
  
  // Get AI response
  const aiResponse = await ai.sendMessage(message, { systemPrompt, ...aiContext });
  
  // Save to database
  await dbAdapter.saveMessageToSession(sessionId, message, 'user');
  await dbAdapter.saveMessageToSession(sessionId, aiResponse, 'assistant');
  
  return { success: true, message: aiResponse };
});
```

## Testing Task Sync

### 1. Verify Task Creation
```javascript
// Browser console
const result = await window.electronAPI.tasks.create({
  title: 'Test Task',
  priority: 'high',
  description: 'Testing sync',
  tags: ['test']
});
console.log('Created:', result);

// Should appear in UI immediately
```

### 2. Verify Task Update
```javascript
// Update a task
await window.electronAPI.tasks.update({
  taskId: 'your-task-id',
  updates: { priority: 'urgent', status: 'completed' }
});

// Check database
```

### 3. Verify Task Chat
```javascript
// Send chat message
const chat = await window.electronAPI.tasks.sendChatMessage(
  'task-id',
  'Help me with this',
  { task: { title: 'My Task', priority: 'high' } }
);
console.log('AI Response:', chat.message);

// Get history
const history = await window.electronAPI.tasks.getChatHistory('task-id');
console.log('Chat History:', history.messages);
```

### 4. Check Database Directly
```sql
-- View all tasks for user
SELECT id, session_title, workflow_type, workflow_metadata, is_completed, started_at
FROM conversation_sessions
WHERE user_id = 'your-user-id' AND workflow_type = 'task'
ORDER BY started_at DESC;

-- View task chat sessions
SELECT id, session_title, workflow_type, workflow_id
FROM conversation_sessions
WHERE workflow_type = 'task_chat'
ORDER BY started_at DESC;

-- View chat messages for a task
SELECT m.role, m.content, m.created_at
FROM conversation_messages m
JOIN conversation_sessions s ON m.session_id = s.id
WHERE s.workflow_id = 'task_abc123'
ORDER BY m.created_at ASC;
```

## Common Issues & Solutions

### Issue: Tasks not appearing in UI
**Solution:**
1. Check if user is authenticated: `services.auth?.currentUser?.id`
2. Verify tasks are being created with correct user_id
3. Check logs: `tail -f desktop2/logs/*.log | grep -i task`
4. Verify query in browser console: `await window.electronAPI.tasks.getAll()`

### Issue: Task chat not saving
**Solution:**
1. Ensure authenticated before sending messages
2. Check task chat session is created: Look for "Creating new chat session" in logs
3. Verify messages are being saved: Check `saveMessageToSession` logs
4. Query database for task_chat sessions

### Issue: Tasks appearing for wrong user
**Solution:**
1. Verify `services.auth.currentUser.id` is correct
2. Check that no hardcoded 'desktop-user' strings remain
3. Verify database has correct user_id values

## Files Changed

1. **`desktop2/main/ipc/task-chat-handlers.js`**
   - Removed hardcoded `'desktop-user'`
   - Added authentication check
   - Uses `services.auth.currentUser.id` dynamically

2. **`desktop2/main/index.js`** (Previously fixed)
   - Task creation from Slack uses authenticated user ID

3. **`desktop2/main/ipc/task-handlers.js`**
   - Already using authenticated user ID correctly

## Verification Steps

After restarting the app:

1. **Login** - Ensure you're authenticated
2. **Check User ID** - Browser console: `await window.electronAPI.auth.getCurrentUser()`
3. **Create Task** - Via UI or Slack message
4. **Verify in UI** - Task should appear in Tasks page
5. **Send Chat** - Open task chat and send a message
6. **Check History** - Chat history should persist and reload

## Architecture Summary

```
┌─────────────────┐
│   Slack/UI      │
│   (Task Input)  │
└────────┬────────┘
         │
         v
┌─────────────────┐
│  IPC Handlers   │
│  (Auth Check)   │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ SupabaseAdapter │
│  (DB Operations)│
└────────┬────────┘
         │
         v
┌─────────────────────────────────┐
│      Supabase Database          │
│                                 │
│  conversation_sessions          │
│  ├─ user_id (UUID)             │
│  ├─ workflow_type ('task')     │
│  └─ workflow_metadata (JSON)   │
│                                 │
│  conversation_messages          │
│  ├─ session_id (FK)            │
│  ├─ role (user/assistant)      │
│  └─ content (TEXT)             │
└─────────────────────────────────┘
```

## Next Steps

1. ✅ Task creation uses authenticated user ID
2. ✅ Task chat uses authenticated user ID
3. ✅ Enhanced logging for debugging
4. 🔲 Add real-time task sync (Supabase subscriptions)
5. 🔲 Implement task notifications
6. 🔲 Add task collaboration features
7. 🔲 Build task analytics dashboard

