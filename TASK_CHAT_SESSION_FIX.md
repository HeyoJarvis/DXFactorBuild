# Task Chat Session Fix - Wrong Session & Title Duplication

## Problems Identified

### Problem 1: Wrong Session Being Used
`getOrCreateActiveSession()` was finding ANY active session instead of the task-specific session, causing:
- Chat messages from different tasks getting mixed together
- Task ID being used as session ID incorrectly
- Messages not loading for the correct task

### Problem 2: Title Duplication
Every time the chat session was accessed, "Task: " was prepended to the title again:
- First time: "do a competitor setup analysis for xyz corp"
- Second time: "Task: do a competitor setup analysis for xyz corp"
- Third time: "Task: Task: do a competitor setup analysis for xyz corp"
- Fourth time: "Task: Task: Task: do a competitor setup analysis for xyz corp" ❌

## Root Cause

### Issue 1: Session Lookup Logic
**File**: `desktop2/main/services/SupabaseAdapter.js` - `getOrCreateActiveSession()`

**Before (WRONG)**:
```javascript
async getOrCreateActiveSession(userId, metadata = {}) {
  // Just gets ANY active session from last 24 hours
  const { data: existingSessions } = await this.supabase
    .from('conversation_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)  // ❌ Too broad!
    .gte('last_activity_at', ...)
    .limit(1);
    
  if (existingSessions && existingSessions.length > 0) {
    return { success: true, session: existingSessions[0] }; // ❌ Wrong session!
  }
}
```

**Problem**: This returns the most recent active session regardless of `workflow_id` or `workflow_type`, so task chats would get the wrong session.

### Issue 2: Title Prefix Logic
**File**: `desktop2/main/ipc/task-chat-handlers.js` - Line 59

**Before (WRONG)**:
```javascript
await dbAdapter.updateSessionTitle(taskSessionIds[taskId], `Task: ${task.title}`);
```

**Problem**: Always adds "Task: " prefix even if it's already there.

## Solutions Implemented

### Fix 1: Proper Session Lookup
**File**: `desktop2/main/services/SupabaseAdapter.js`

Added workflow-specific session lookup:

```javascript
async getOrCreateActiveSession(userId, metadata = {}) {
  // ✅ If workflow_id is provided, look for that specific session
  if (metadata.workflow_id) {
    const { data: specificSession } = await this.supabase
      .from('conversation_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('workflow_id', metadata.workflow_id)        // ✅ Match exact workflow
      .eq('workflow_type', metadata.workflow_type)    // ✅ Match exact type
      .order('started_at', { ascending: false })
      .limit(1);

    if (specificSession && specificSession.length > 0) {
      logger.info('Using existing specific session', { 
        session_id: specificSession[0].id,
        workflow_id: metadata.workflow_id
      });
      return { success: true, session: specificSession[0], isNew: false };
    }
  }

  // ✅ For general chat only, use the old behavior
  if (!metadata.workflow_id || metadata.workflow_type === 'general') {
    const { data: existingSessions } = await this.supabase
      .from('conversation_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('workflow_type', 'general')    // ✅ Only match general chat
      .gte('last_activity_at', ...)
      .limit(1);
      
    // ... return general session
  }

  // ✅ Create new session if no match found
  return await this.createConversationSession(userId, metadata);
}
```

**Benefits**:
- Task chats get their own dedicated session
- Sessions are found by `workflow_id` (e.g., `task_e20bf9c9-8a8f-4bb8-895a-f32424196dff`)
- General chat still works as before
- No session mixing between different workflows

### Fix 2: Prevent Title Duplication
**File**: `desktop2/main/ipc/task-chat-handlers.js`

Added check before adding prefix:

```javascript
// ✅ Set session title (don't add prefix if already exists)
const sessionTitle = task.title.startsWith('Task:') 
  ? task.title 
  : `Task: ${task.title}`;
  
await dbAdapter.updateSessionTitle(taskSessionIds[taskId], sessionTitle);
```

**Benefits**:
- Only adds "Task: " prefix once
- Prevents "Task: Task: Task: ..." duplication
- Clean, readable task titles

## How It Works Now

### Task Chat Session Flow

```
User opens task chat for task ID: abc-123
  ↓
Handler calls getOrCreateActiveSession(userId, {
  workflow_id: 'task_abc-123',
  workflow_type: 'task_chat',
  task_id: 'abc-123',
  task_title: 'do competitor analysis'
})
  ↓
SupabaseAdapter looks for SPECIFIC session:
  - workflow_id = 'task_abc-123'
  - workflow_type = 'task_chat'
  - user_id = current user
  ↓
If found: Return existing session ✅
If not found: Create new session ✅
  ↓
Session ID cached in memory: taskSessionIds['abc-123'] = 'session-xyz'
  ↓
Title set once: "Task: do competitor analysis" (no duplication)
  ↓
Messages loaded from THIS specific session only
  ↓
New messages saved to THIS session
```

### Comparison: Before vs After

| Scenario | Before (WRONG) | After (CORRECT) |
|----------|----------------|-----------------|
| Open Task A chat | Gets any active session | Gets Task A session |
| Open Task B chat | Gets same session as A | Gets Task B session |
| Task A title | "Task: Task: Task: Title" | "Task: Title" |
| Messages mixing | Task A shows Task B msgs | Each task has own msgs |
| Session reuse | Wrong session reused | Correct session reused |

## Testing

### Test 1: Separate Task Chats
```bash
1. Open task A chat → Send "hello A"
2. Close chat
3. Open task B chat → Send "hello B"
4. Close chat
5. Open task A chat again
✅ Should show only "hello A" (not "hello B")
```

### Test 2: Title Consistency
```bash
1. Open task chat
2. Check title → "Task: [original title]"
3. Send a message
4. Close and reopen
✅ Title should stay "Task: [original title]" (not "Task: Task: ...")
```

### Test 3: Session Persistence
```bash
1. Open task chat
2. Send multiple messages
3. Close and reopen multiple times
✅ All messages should persist
✅ Same session should be reused (check logs for "Using existing specific session")
```

### Test 4: General Chat Isolation
```bash
1. Open general Copilot chat → Send "general message"
2. Open task chat → Send "task message"
✅ Task chat should not show general message
✅ General chat should not show task message
```

## Console Logs to Look For

### Correct Session Lookup
```json
{
  "level": "info",
  "message": "Using existing specific session",
  "session_id": "xyz-789",
  "workflow_id": "task_abc-123",
  "workflow_type": "task_chat"
}
```

### New Session Creation
```json
{
  "level": "info",
  "message": "Creating new session",
  "workflow_id": "task_abc-123",
  "workflow_type": "task_chat"
}
```

### Title Update (No Duplication)
```json
{
  "level": "info",
  "message": "Task chat session created",
  "taskId": "abc-123",
  "sessionId": "xyz-789"
}
```

## Database Structure

### Task Chat Session in Supabase

```javascript
{
  id: "session-xyz-789",
  user_id: "user-456",
  workflow_id: "task_abc-123",           // ✅ Unique per task
  workflow_type: "task_chat",            // ✅ Identifies as task chat
  session_title: "Task: do competitor analysis",  // ✅ Clean title
  workflow_metadata: {
    task_id: "abc-123",
    task_title: "do competitor analysis",
    task_priority: "medium",
    task_status: "todo",
    route_to: "tasks-sales",
    work_type: "task"
  },
  is_active: true,
  started_at: "2025-10-16T...",
  last_activity_at: "2025-10-16T..."
}
```

### Messages Linked to Session

```javascript
{
  id: "msg-123",
  session_id: "session-xyz-789",    // ✅ Links to task-specific session
  role: "user",
  content: "hello",
  metadata: {
    task_id: "abc-123",
    task_title: "do competitor analysis"
  },
  created_at: "2025-10-16T..."
}
```

## Files Modified

1. ✅ `desktop2/main/services/SupabaseAdapter.js`
   - Fixed `getOrCreateActiveSession()` to look up by workflow_id
   - Added workflow-specific session matching
   - Preserved general chat behavior

2. ✅ `desktop2/main/ipc/task-chat-handlers.js`
   - Fixed title duplication by checking for existing "Task:" prefix
   - Improved session creation logging

## Benefits

1. **Proper Isolation**: Each task has its own dedicated chat session
2. **No Message Mixing**: Task A messages don't appear in Task B chat
3. **Clean Titles**: No more "Task: Task: Task: ..." duplication
4. **Better Performance**: Correct session lookup reduces confusion
5. **Improved Logging**: Enhanced logs make debugging easier
6. **Backward Compatible**: General chat still works as before

## Migration Notes

**Existing sessions are fine** - no data migration needed:
- Old task chat sessions will be found by workflow_id
- General chat sessions continue working
- New sessions are created with correct workflow_id

**Clean up duplicate sessions** (optional):
```sql
-- Find duplicate task chat sessions
SELECT workflow_id, COUNT(*) 
FROM conversation_sessions 
WHERE workflow_type = 'task_chat' 
GROUP BY workflow_id 
HAVING COUNT(*) > 1;
```

---

**Implementation Date**: October 16, 2025  
**Status**: ✅ Complete  
**Testing**: Ready for verification

