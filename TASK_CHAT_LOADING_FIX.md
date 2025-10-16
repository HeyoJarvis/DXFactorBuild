# Task Chat Loading Fix - Sales Mode

## Problem Identified

Task chats for sales mode tasks weren't loading properly because:

1. **Missing Route Metadata in Task Context**: When TaskChat component sent messages, it wasn't including `route_to` and `work_type` fields
2. **No Role-Based Filtering**: Both Sales and Developer task pages were loading ALL tasks instead of filtering by role
3. **Missing Hook Separation**: Need separate hooks for sales vs developer tasks

## Solutions Implemented

### 1. Fixed TaskChat Component Context
**File**: `desktop2/renderer2/src/components/Tasks/TaskChat.jsx`

Added `route_to` and `work_type` to the task context when sending messages:

```javascript
const response = await window.electronAPI.tasks.sendChatMessage(task.id, userMessage, {
  task: {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    created_at: task.created_at,
    route_to: task.route_to || 'tasks-sales',    // NEW
    work_type: task.work_type || 'task'          // NEW
  }
});
```

**Impact**: Task chat sessions now properly inherit routing metadata from parent tasks.

### 2. Created Sales Tasks Hook
**File**: `desktop2/renderer2/src/hooks/useSalesTasks.js`

New hook that filters for sales tasks only:

```javascript
const response = await window.electronAPI.tasks.getAll({
  routeTo: 'tasks-sales'  // Only get sales tasks
});
```

**Features**:
- Loads only tasks with `route_to: 'tasks-sales'`
- Creates new tasks with sales routing by default
- Logs task count and details for debugging
- Auto-refreshes on task creation events

### 3. Created Developer Tasks Hook
**File**: `desktop2/renderer2/src/hooks/useDeveloperTasks.js`

Similar hook for developer tasks:

```javascript
const response = await window.electronAPI.tasks.getAll({
  routeTo: 'mission-control'  // Only get developer tasks
});
```

**Features**:
- Loads only tasks with `route_to: 'mission-control'`
- Creates new tasks with mission-control routing
- Supports JIRA-synced tasks
- Independent from sales tasks

### 4. Updated Sales Tasks Page
**File**: `desktop2/renderer2/src/pages/Tasks.jsx`

Changed from generic hook to sales-specific:

```javascript
// BEFORE
import { useTasks } from '../hooks/useTasks';

// AFTER
import { useSalesTasks } from '../hooks/useSalesTasks';
```

**Impact**: Sales page now shows ONLY sales tasks, not developer tasks.

## How Task Filtering Works Now

### Sales Mode Flow

```
User opens Sales Tasks page
  ↓
useSalesTasks() hook initializes
  ↓
Calls window.electronAPI.tasks.getAll({ routeTo: 'tasks-sales' })
  ↓
IPC handler: tasks:getAll with filters
  ↓
dbAdapter.getUserTasks(userId, { routeTo: 'tasks-sales' })
  ↓
Supabase query with filtering:
  SELECT * FROM conversation_sessions
  WHERE user_id = ?
  AND workflow_type = 'task'
  AND workflow_metadata @> '{"route_to": "tasks-sales"}'
  ↓
Returns ONLY sales tasks → UI displays filtered list
```

### Developer Mode Flow

```
User opens Developer Tasks page
  ↓
TasksDeveloper component loads
  ↓
Displays JIRA issues directly (mock or real)
  ↓
User clicks "Sync JIRA" button
  ↓
window.electronAPI.jira.syncTasks()
  ↓
JIRA issues → Created as tasks with route_to: 'mission-control'
  ↓
useDeveloperTasks() would filter these
  (if integrated into TasksDeveloper component)
```

### Task Chat Flow

```
User opens chat for a sales task
  ↓
TaskChat component mounts
  ↓
Calls loadChatHistory()
  ↓
window.electronAPI.tasks.getChatHistory(task.id)
  ↓
Backend verifies task belongs to user
  ↓
Looks up task_chat session for this task
  ↓
Returns messages → UI displays chat history
  ↓
User sends message
  ↓
sendChatMessage(taskId, message, { task })
  ↓
task object includes route_to and work_type
  ↓
Creates/updates session with metadata
  ↓
Saves messages → Chat syncs properly
```

## Task Structure

### Sales Task Example

```javascript
{
  id: 'abc-123',
  user_id: 'user-456',
  title: 'Follow up with prospect',
  description: 'Customer interested in enterprise plan',
  status: 'todo',
  priority: 'high',
  tags: ['sales', 'slack-auto', 'outreach'],
  route_to: 'tasks-sales',        // Routes to Sales mode
  work_type: 'outreach',          // Type of sales work
  assignor: 'U12345',
  assignee: 'U67890',
  mentioned_users: ['U67890'],
  created_at: '2025-10-16T...',
  updated_at: '2025-10-16T...'
}
```

### Developer Task Example

```javascript
{
  id: 'def-789',
  user_id: 'user-456',
  title: 'Fix API authentication bug',
  description: 'Users reporting 401 errors',
  status: 'in_progress',
  priority: 'urgent',
  tags: ['backend', 'bug', 'jira'],
  route_to: 'mission-control',   // Routes to Developer mode
  work_type: 'task',              // Type of dev work
  external_id: 'jira_10001',      // JIRA integration
  external_key: 'PROJ-123',
  external_url: 'https://...',
  external_source: 'jira',
  jira_status: 'In Progress',
  story_points: 5,
  created_at: '2025-10-16T...',
  updated_at: '2025-10-16T...'
}
```

## Testing

### Test 1: Sales Tasks Load Correctly
```bash
1. Open app in Sales mode
2. Navigate to Tasks page
3. Check console: "📋 Sales tasks loaded: { count: X }"
4. Verify only sales tasks are shown (no JIRA/developer tasks)
```

### Test 2: Task Chat Loads History
```bash
1. Open a sales task
2. Click chat icon
3. Chat history should load (if any)
4. Check console logs for "Task verified for chat access"
5. Verify routeTo is logged
```

### Test 3: Task Chat Syncs Messages
```bash
1. Open a sales task chat
2. Send a message: "test"
3. Message should save and appear immediately
4. Reload the chat
5. Message should still be there (persisted in Supabase)
```

### Test 4: Role Switching
```bash
1. In Sales mode, note which tasks are visible
2. Switch to Developer mode
3. Verify different tasks are shown (JIRA issues)
4. Switch back to Sales mode
5. Original sales tasks should reappear
```

## Console Debugging

Look for these log messages:

### Sales Tasks Loading
```
📋 Sales tasks loaded: { count: 3, tasks: [...] }
```

### Task Chat Verification
```
{"level":"info","message":"Task verified for chat access","taskId":"...","userId":"...","routeTo":"tasks-sales","workType":"outreach"}
```

### Chat Session Creation
```
{"level":"info","message":"Task chat session created","taskId":"...","sessionId":"...","routeTo":"tasks-sales","workType":"outreach"}
```

### Messages Saved
```
Message saved to session { session_id: '...', role: 'user', message_length: 10 }
Message saved to session { session_id: '...', role: 'assistant', message_length: 250 }
```

### History Loaded
```
{"level":"info","message":"Loaded chat history","taskId":"...","messageCount":8,"routeTo":"tasks-sales"}
```

## Files Modified

1. ✅ `desktop2/renderer2/src/components/Tasks/TaskChat.jsx` - Added route_to and work_type to context
2. ✅ `desktop2/renderer2/src/pages/Tasks.jsx` - Switched to useSalesTasks hook
3. ✅ `desktop2/renderer2/src/hooks/useSalesTasks.js` - New sales-specific hook (created)
4. ✅ `desktop2/renderer2/src/hooks/useDeveloperTasks.js` - New developer-specific hook (created)

## Backward Compatibility

- Existing tasks without `route_to` default to `'tasks-sales'`
- TaskChat component provides defaults if fields are missing
- Original `useTasks` hook still works for unfiltered task lists

## Benefits

1. **Proper Isolation**: Sales and developer tasks are separated
2. **Chat Syncing**: Task chats now properly save and load with routing metadata
3. **Better UX**: Users only see relevant tasks for their current role
4. **Debugging**: Enhanced logging makes troubleshooting easier
5. **Scalability**: Easy to add more role types (e.g., 'marketing', 'support')

## Next Steps

1. **Verify in Production**: Test with real Slack-generated tasks
2. **Monitor Logs**: Check that route_to is consistently set
3. **Consider Migration**: Optionally update old tasks to have route_to
4. **Integrate Developer Hook**: Update TasksDeveloper to use useDeveloperTasks if needed
5. **Add Role Badge**: Show task role in UI for clarity

---

**Implementation Date**: October 16, 2025  
**Status**: ✅ Complete  
**Ready for Testing**: Yes

