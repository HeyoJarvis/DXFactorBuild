# Task Chat Persistence Fix

## Problem
Task chat messages were being saved to Supabase correctly, but when reopening a task chat, the history wasn't loading. The conversation appeared empty even though messages existed in the database.

## Root Cause
The `getChatHistory` handler relied on an in-memory cache (`taskSessionIds`) that gets cleared when the app restarts or the page refreshes. The session lookup logic was:

1. ✅ **Save:** Creates session in DB → Caches session ID in memory → Saves messages
2. ❌ **Load:** Checks memory cache → Not found → Returns empty (never checked DB)

## Solution
Updated `getChatHistory` to fall back to database lookup when the session isn't in the memory cache.

### Before
```javascript
ipcMain.handle('tasks:getChatHistory', async (event, taskId) => {
  const taskSessionId = taskSessionIds[taskId]; // ❌ Only checks memory
  
  if (!taskSessionId) {
    return { success: true, messages: [] }; // ❌ Returns empty
  }
  
  const historyResult = await dbAdapter.getSessionMessages(taskSessionId);
  return { success: true, messages: historyResult.messages };
});
```

### After
```javascript
ipcMain.handle('tasks:getChatHistory', async (event, taskId) => {
  const userId = services.auth?.currentUser?.id;
  
  // Check in-memory cache first
  let taskSessionId = taskSessionIds[taskId];
  
  // ✅ If not in memory, look up in database
  if (!taskSessionId) {
    const { data: sessions } = await dbAdapter.supabase
      .from('conversation_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('workflow_type', 'task_chat')
      .eq('workflow_id', `task_${taskId}`)
      .order('started_at', { ascending: false })
      .limit(1);
    
    if (sessions && sessions.length > 0) {
      taskSessionId = sessions[0].id;
      // ✅ Cache it for future use
      taskSessionIds[taskId] = taskSessionId;
    }
  }
  
  if (!taskSessionId) {
    return { success: true, messages: [] };
  }
  
  const historyResult = await dbAdapter.getSessionMessages(taskSessionId);
  return { success: true, messages: historyResult.messages };
});
```

## How It Works Now

### First Message (Session Creation)
1. User opens task chat for the first time
2. Sends a message
3. `sendChatMessage` handler:
   - Creates new session in DB with `workflow_id: 'task_abc123'`
   - Caches session ID in memory: `taskSessionIds['abc123'] = 'session-uuid'`
   - Saves user message to `conversation_messages`
   - Saves AI response to `conversation_messages`

### Loading Existing Chat (After Restart)
1. User opens task chat
2. `getChatHistory` is called
3. Handler checks memory cache → Not found
4. **NEW:** Queries database for session:
   ```sql
   SELECT id FROM conversation_sessions
   WHERE user_id = ? 
     AND workflow_type = 'task_chat'
     AND workflow_id = 'task_abc123'
   ORDER BY started_at DESC
   LIMIT 1
   ```
5. Finds session → Caches it in memory
6. Loads messages from `conversation_messages` table
7. Returns full chat history

### Subsequent Messages (Same Session)
1. User sends another message
2. Session ID found in cache
3. Messages appended to existing session
4. Chat history persists

## Database Query Details

### Session Lookup Query
```sql
SELECT id
FROM conversation_sessions
WHERE user_id = 'authenticated-user-uuid'
  AND workflow_type = 'task_chat'
  AND workflow_id = 'task_abc123'
ORDER BY started_at DESC
LIMIT 1;
```

**Key Points:**
- Uses authenticated user ID (not hardcoded)
- Filters by `workflow_type = 'task_chat'` (not 'task')
- Matches `workflow_id` which is `'task_' + taskId`
- Orders by most recent to handle edge cases
- Caches result to avoid repeated DB queries

### Message Retrieval
Once session ID is found, messages are loaded via:
```sql
SELECT role, content, created_at
FROM conversation_messages
WHERE session_id = 'session-uuid'
ORDER BY created_at ASC;
```

## Testing

### 1. Create New Chat
```javascript
// Browser console - Open task chat
const taskId = 'your-task-id';
const response = await window.electronAPI.tasks.sendChatMessage(
  taskId,
  'Hello, can you help me?',
  { task: { title: 'My Task', priority: 'high' } }
);
console.log('AI Response:', response.message);
```

### 2. Verify Save to Database
```sql
-- Check session was created
SELECT id, workflow_id, workflow_type, started_at
FROM conversation_sessions
WHERE workflow_type = 'task_chat'
ORDER BY started_at DESC
LIMIT 5;

-- Check messages were saved
SELECT m.role, m.content, m.created_at
FROM conversation_messages m
JOIN conversation_sessions s ON m.session_id = s.id
WHERE s.workflow_type = 'task_chat'
ORDER BY m.created_at DESC
LIMIT 10;
```

### 3. Verify Load After Restart
```javascript
// Restart app, then in browser console
const taskId = 'your-task-id';
const history = await window.electronAPI.tasks.getChatHistory(taskId);
console.log('Chat History:', history.messages);
// Should show previous messages!
```

### 4. Check Logs
```bash
tail -f desktop2/logs/*.log | grep -i "task.*chat"
```

Look for:
- "Task session not in cache, looking up in database"
- "Found task session in database"
- "Loaded chat history"

## Memory Cache vs Database

### In-Memory Cache (`taskSessionIds`)
- **Pros:** Fast lookup, no DB query
- **Cons:** Cleared on restart, not shared across processes
- **Usage:** Performance optimization for active sessions

### Database
- **Pros:** Persistent, survives restarts, single source of truth
- **Cons:** Requires query, slight latency
- **Usage:** Fallback when cache misses

### Strategy
1. Always check memory first (fast path)
2. Fall back to database on miss (reliability)
3. Cache DB result for future lookups (optimization)

## Edge Cases Handled

### Multiple Sessions Per Task
- Query orders by `started_at DESC` and takes `LIMIT 1`
- Always gets most recent session
- Historical sessions remain in DB for audit trail

### User Not Authenticated
- Returns empty array gracefully
- Logs warning for debugging
- Doesn't crash the UI

### Database Error
- Logs error with context
- Returns empty array
- UI shows "No conversation yet"

### Session Exists But No Messages
- Session found in DB
- `getSessionMessages` returns empty array
- UI prompts user to start conversation

## Files Changed

**File:** `desktop2/main/ipc/task-chat-handlers.js`

### Changes:
1. Added user authentication check
2. Added database lookup when session not in cache
3. Added session caching after DB lookup
4. Enhanced logging for debugging
5. Improved error handling

## Verification Checklist

After restarting the app:

- [ ] Login and authenticate
- [ ] Open a task from Tasks page
- [ ] Click on task chat
- [ ] Send a message
- [ ] Verify AI response appears
- [ ] Close the task
- [ ] Reopen the same task
- [ ] **Chat history should load** ✅
- [ ] Send another message
- [ ] Both messages should be visible

## Common Issues

### Issue: History still not loading
**Debug Steps:**
1. Check if user is authenticated
2. Verify task ID is correct
3. Query database directly to confirm session exists
4. Check logs for "Found task session" message
5. Verify `workflow_id` format is `'task_' + taskId`

### Issue: Multiple conversations for same task
**Cause:** Session creation logic creating duplicates
**Solution:** `getOrCreateActiveSession` should check for existing session first

### Issue: Messages out of order
**Cause:** Timestamp not being set correctly
**Solution:** Ensure `created_at` is set by database with `DEFAULT NOW()`

## Architecture Diagram

```
┌────────────────────────────────────────────────┐
│                 Task Chat UI                   │
│  (Opens task → Requests chat history)          │
└─────────────────┬──────────────────────────────┘
                  │
                  │ getChatHistory(taskId)
                  ▼
┌────────────────────────────────────────────────┐
│           IPC Handler (Main Process)           │
│                                                │
│  1. Check taskSessionIds[taskId] (Memory)      │
│     ├─ Found? → Use session ID                 │
│     └─ Not found? → Query database ↓           │
│                                                │
│  2. Query Supabase:                           │
│     SELECT id FROM conversation_sessions       │
│     WHERE workflow_id = 'task_{taskId}'        │
│                                                │
│  3. Cache result: taskSessionIds[taskId] = id  │
│                                                │
│  4. Load messages: getSessionMessages(id)      │
└─────────────────┬──────────────────────────────┘
                  │
                  │ Return messages array
                  ▼
┌────────────────────────────────────────────────┐
│              Supabase Database                 │
│                                                │
│  conversation_sessions                         │
│  ├─ id: session-uuid                          │
│  ├─ user_id: authenticated-user-uuid          │
│  ├─ workflow_type: 'task_chat'                │
│  └─ workflow_id: 'task_abc123'                │
│                                                │
│  conversation_messages                         │
│  ├─ session_id: session-uuid (FK)             │
│  ├─ role: 'user' | 'assistant'                │
│  ├─ content: message text                     │
│  └─ created_at: timestamp                     │
└────────────────────────────────────────────────┘
```

## Summary

The fix ensures task chat persistence by:
1. ✅ Maintaining memory cache for performance
2. ✅ Falling back to database when cache misses
3. ✅ Using authenticated user ID consistently
4. ✅ Caching DB results for future use
5. ✅ Enhanced logging for troubleshooting

Task chats now persist across app restarts! 🎉

