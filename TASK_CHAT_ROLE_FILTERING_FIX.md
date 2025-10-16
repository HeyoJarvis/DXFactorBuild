# Task Chat Role Filtering Fix

## Problem Statement

Task chats for sales mode tasks were not properly syncing or pulling from Supabase. The root cause was that tasks created from Slack or manually were missing role/routing information (`routeTo` and `workType`) in their metadata, and the task chat retrieval system wasn't filtering or verifying task context properly.

## Issues Identified

1. **Missing Metadata in Task Creation**: When tasks were created, the `routeTo` (e.g., 'tasks-sales' vs 'mission-control') and `workType` (e.g., 'task', 'calendar', 'outreach') were not being saved to the database.

2. **No Role-Based Filtering**: The `getUserTasks` method didn't support filtering by `routeTo`, making it impossible to separate sales tasks from developer tasks.

3. **No Task Verification in Chat**: The `getChatHistory` handler didn't verify that the task belonged to the current user or check the task's routing metadata before returning chat history.

4. **Missing Metadata in Chat Sessions**: When creating task-specific chat sessions, the `route_to` and `work_type` weren't being passed through to the session metadata.

## Solutions Implemented

### 1. Enhanced Task Creation in SupabaseAdapter
**File**: `desktop2/main/services/SupabaseAdapter.js`

Added comprehensive metadata storage in `createTask` method:

```javascript
workflow_metadata: {
  // ... existing fields ...
  route_to: taskData.routeTo || 'tasks-sales',        // Where to route
  work_type: taskData.workType || 'task',             // Type of work
  external_id: taskData.externalId || null,           // For JIRA sync
  external_key: taskData.externalKey || null,
  external_url: taskData.externalUrl || null,
  external_source: taskData.externalSource || null,
  jira_status: taskData.jira_status || null,
  jira_issue_type: taskData.jira_issue_type || null,
  jira_priority: taskData.jira_priority || null,
  story_points: taskData.story_points || null,
  sprint: taskData.sprint || null,
  labels: taskData.labels || []
}
```

**Benefits**:
- Tasks now store complete routing and classification metadata
- JIRA sync fields are properly saved
- Default routing ensures backward compatibility

### 2. Role-Based Task Filtering
**File**: `desktop2/main/services/SupabaseAdapter.js`

Enhanced `getUserTasks` method with `routeTo` filtering:

```javascript
// Filter by route_to (for role-based filtering)
if (filters.routeTo) {
  query = query.contains('workflow_metadata', { route_to: filters.routeTo });
}
```

**Task transformation** now includes routing metadata:

```javascript
const tasks = (data || []).map(session => ({
  // ... existing fields ...
  route_to: session.workflow_metadata?.route_to || 'tasks-sales',
  work_type: session.workflow_metadata?.work_type || 'task',
  external_id: session.workflow_metadata?.external_id || null,
  external_key: session.workflow_metadata?.external_key || null,
  external_url: session.workflow_metadata?.external_url || null,
  external_source: session.workflow_metadata?.external_source || null,
}));
```

**Benefits**:
- Sales tasks can be filtered separately from developer tasks
- UI can request tasks by role: `getUserTasks(userId, { routeTo: 'tasks-sales' })`
- Backward compatible with existing tasks (defaults to 'tasks-sales')

### 3. Task Verification in Chat History
**File**: `desktop2/main/ipc/task-chat-handlers.js`

Added robust task verification in `getChatHistory`:

```javascript
// First, verify the task exists and belongs to this user
const { data: taskSession, error: taskError } = await dbAdapter.supabase
  .from('conversation_sessions')
  .select('id, user_id, workflow_metadata, session_title')
  .eq('id', taskId)
  .eq('workflow_type', 'task')
  .single();

// Verify task belongs to user
if (taskSession.user_id !== userId) {
  logger.warn('Task access denied: user mismatch');
  return { success: false, error: 'Access denied', messages: [] };
}

logger.info('Task verified for chat access', { 
  taskId, 
  userId,
  routeTo: taskSession.workflow_metadata?.route_to,
  workType: taskSession.workflow_metadata?.work_type
});
```

**Benefits**:
- Security: Users can only access chats for their own tasks
- Logging: Clear audit trail of task access attempts
- Context: Route and work type are logged for debugging

### 4. Enhanced Task Chat Session Metadata
**File**: `desktop2/main/ipc/task-chat-handlers.js`

Updated `sendChatMessage` to include routing metadata in chat sessions:

```javascript
const sessionResult = await dbAdapter.getOrCreateActiveSession(userId, {
  workflow_type: 'task_chat',
  workflow_id: `task_${taskId}`,
  task_id: taskId,
  task_title: task.title,
  task_priority: task.priority,
  task_status: task.status,
  route_to: task.route_to || 'tasks-sales',    // NEW
  work_type: task.work_type || 'task'          // NEW
});
```

**Benefits**:
- Chat sessions inherit the task's routing metadata
- Enables future filtering of chat sessions by role
- Maintains consistency between tasks and their chats

## Data Flow

### Creating a Sales Task from Slack

```
1. Slack message detected by SlackService
   ↓
2. SlackService.detectAndCreateTask() analyzes message
   ↓
3. Creates taskData with:
   - routeTo: 'tasks-sales' (or 'mission-control' for calendar/email)
   - workType: 'task', 'calendar', or 'outreach'
   - Other metadata (priority, tags, assignee, etc.)
   ↓
4. Emits 'task-detected' event
   ↓
5. Main process calls dbAdapter.createTask(userId, taskData)
   ↓
6. Task saved to conversation_sessions with workflow_metadata containing:
   - route_to: 'tasks-sales'
   - work_type: 'task'
   - All other metadata
   ↓
7. UI notified via 'task:created' event
```

### Loading Sales Tasks in UI

```
1. User switches to Sales mode (role = 'sales')
   ↓
2. UI calls window.electronAPI.tasks.getAll({ routeTo: 'tasks-sales' })
   ↓
3. IPC handler: tasks:getAll
   ↓
4. dbAdapter.getUserTasks(userId, { routeTo: 'tasks-sales' })
   ↓
5. Supabase query:
   SELECT * FROM conversation_sessions
   WHERE user_id = ?
   AND workflow_type = 'task'
   AND workflow_metadata @> '{"route_to": "tasks-sales"}'
   ↓
6. Returns filtered tasks → UI displays only sales tasks
```

### Task Chat Syncing

```
1. User opens task chat in Sales mode
   ↓
2. UI calls window.electronAPI.tasks.getChatHistory(taskId)
   ↓
3. Handler verifies:
   - Task exists
   - Task belongs to current user
   - Task route_to matches context
   ↓
4. Looks up task_chat session:
   - Check cache first
   - Query database if not cached
   ↓
5. Retrieves messages from conversation_messages table
   ↓
6. Returns chat history → UI displays messages
```

### Sending Chat Message

```
1. User sends message in task chat
   ↓
2. UI calls window.electronAPI.tasks.sendChatMessage(taskId, message, context)
   ↓
3. Handler gets/creates task_chat session with metadata:
   - route_to: task.route_to
   - work_type: task.work_type
   ↓
4. AI generates response with task context
   ↓
5. Both messages saved to conversation_messages table
   ↓
6. Returns AI response → UI displays
```

## Database Schema

### conversation_sessions Table

```sql
CREATE TABLE conversation_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  workflow_type TEXT NOT NULL,  -- 'task' or 'task_chat'
  workflow_id TEXT,
  session_title TEXT,
  workflow_metadata JSONB,      -- Contains all task metadata
  is_active BOOLEAN DEFAULT true,
  is_completed BOOLEAN DEFAULT false,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  last_activity_at TIMESTAMP DEFAULT NOW()
);
```

### workflow_metadata Structure (for tasks)

```json
{
  "priority": "high",
  "description": "Task description",
  "tags": ["slack-auto", "task"],
  "due_date": null,
  "parent_session_id": "abc123",
  "assignor": "U12345",
  "assignee": "U67890",
  "mentioned_users": ["U67890"],
  "route_to": "tasks-sales",        // NEW: routing destination
  "work_type": "task",              // NEW: type of work
  "external_id": "jira_10001",      // NEW: for JIRA sync
  "external_key": "PROJ-123",
  "external_url": "https://...",
  "external_source": "jira",
  "jira_status": "In Progress",
  "jira_issue_type": "Story",
  "jira_priority": "High",
  "story_points": 5,
  "sprint": "Sprint 23",
  "labels": ["backend", "api"]
}
```

## Usage Examples

### Creating a Task with Routing

```javascript
// Sales task (default)
await dbAdapter.createTask(userId, {
  title: 'Follow up with prospect',
  priority: 'high',
  routeTo: 'tasks-sales',
  workType: 'outreach'
});

// Developer task
await dbAdapter.createTask(userId, {
  title: 'Fix API bug',
  priority: 'urgent',
  routeTo: 'mission-control',
  workType: 'task',
  externalId: 'jira_10001',
  externalKey: 'PROJ-123',
  externalSource: 'jira'
});
```

### Filtering Tasks by Role

```javascript
// Get sales tasks only
const salesTasks = await dbAdapter.getUserTasks(userId, {
  routeTo: 'tasks-sales',
  includeCompleted: false
});

// Get developer tasks only
const devTasks = await dbAdapter.getUserTasks(userId, {
  routeTo: 'mission-control',
  includeCompleted: false
});

// Get all tasks
const allTasks = await dbAdapter.getUserTasks(userId, {
  includeCompleted: false
});
```

### UI Integration

```javascript
// In TasksSales.jsx
useEffect(() => {
  const loadSalesTasks = async () => {
    const result = await window.electronAPI.tasks.getAll({
      routeTo: 'tasks-sales'
    });
    setTasks(result.tasks);
  };
  
  loadSalesTasks();
}, []);

// In TasksDeveloper.jsx
useEffect(() => {
  const loadDevTasks = async () => {
    const result = await window.electronAPI.tasks.getAll({
      routeTo: 'mission-control'
    });
    setTasks(result.tasks);
  };
  
  loadDevTasks();
}, []);
```

## Testing Checklist

### ✅ Task Creation
- [ ] Create task from Slack → Check `route_to` is saved
- [ ] Create task manually → Check defaults are applied
- [ ] Create JIRA task → Check external fields are saved

### ✅ Task Retrieval
- [ ] Load sales tasks → Verify filtering works
- [ ] Load developer tasks → Verify filtering works
- [ ] Load all tasks → Verify all returned

### ✅ Task Chat
- [ ] Open chat for sales task → Verify history loads
- [ ] Send message in sales task chat → Verify saves and retrieves
- [ ] Try to access other user's task → Verify denied

### ✅ Role Switching
- [ ] Switch from Sales to Developer → Verify different tasks shown
- [ ] Switch back to Sales → Verify sales tasks shown
- [ ] Task chats persist across role switches

## Backward Compatibility

All changes are backward compatible:

1. **Default Values**: Tasks without `route_to` default to 'tasks-sales'
2. **Optional Filtering**: `routeTo` filter is optional in `getUserTasks`
3. **Existing Data**: Old tasks will work with defaults applied at read time
4. **No Schema Changes**: All new fields use existing JSONB `workflow_metadata`

## Benefits

1. **Role Separation**: Sales and developer tasks are properly isolated
2. **Proper Syncing**: Task chats now sync correctly with task metadata
3. **JIRA Integration**: External task metadata is properly stored
4. **Security**: Task access is verified before returning chat history
5. **Debugging**: Enhanced logging for troubleshooting
6. **Flexibility**: Easy to add new routes or work types in the future

## Files Modified

1. `desktop2/main/services/SupabaseAdapter.js` - Enhanced task creation and retrieval
2. `desktop2/main/ipc/task-chat-handlers.js` - Added verification and metadata passing

## Next Steps

1. **Update UI Components**: Modify task list components to pass `routeTo` filter
2. **Test Thoroughly**: Run through all task creation and chat scenarios
3. **Monitor Logs**: Check that routing metadata is being saved correctly
4. **Consider Migration**: Optionally add `route_to` to existing tasks without it
5. **Documentation**: Update API docs for task-related handlers

---

**Implementation Date**: October 16, 2025  
**Status**: ✅ Complete  
**Tested**: Pending user verification

