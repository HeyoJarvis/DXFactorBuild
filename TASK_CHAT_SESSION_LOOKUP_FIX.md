# Task Chat Session Lookup Fix

## 🐛 Critical Bug Fixed

**Issue:** Task chat history was not loading properly from Supabase due to a session type mismatch in the lookup logic.

**Date:** October 16, 2025  
**Component:** `desktop2/main/ipc/task-chat-handlers.js`  
**Handler:** `tasks:getChatHistory`

---

## 📋 Root Cause Analysis

### The Problem

The `tasks:getChatHistory` handler was conflating two different session types:

1. **Task Sessions** (`workflow_type: 'task'`)
   - Represent the task itself
   - Stored with task metadata (priority, description, etc.)
   - Created when a task is created

2. **Task Chat Sessions** (`workflow_type: 'task_chat'`)
   - Represent the chat conversation about a task
   - Linked to a task via `workflow_id: 'task_{taskId}'`
   - Created when the first message is sent

### The Bug

The handler was verifying the task existed correctly but then trying to load chat messages from the task session instead of the task chat session:

```javascript
// ❌ WRONG: Looking for task itself
const { data: taskSession } = await dbAdapter.supabase
  .from('conversation_sessions')
  .select('*')
  .eq('id', taskId)
  .eq('workflow_type', 'task')  // This is the task, not its chat
  .single();

// Then trying to get messages from the same session
// But messages are in a DIFFERENT session with workflow_type='task_chat'
```

### Why It Failed

1. **Session Type Confusion**: The code was looking for messages in the task session, but messages are stored in a separate task_chat session
2. **ID Mismatch**: The task session ID (`taskId`) is different from the task chat session ID
3. **workflow_id Construction**: Task chat sessions use `workflow_id: 'task_{taskId}'` to link back to the task

---

## ✅ The Solution

### Two-Step Verification Process

1. **Step 1: Verify the Task**
   - Check that the task exists (`workflow_type: 'task'`)
   - Verify the user owns the task
   - Extract task metadata for logging

2. **Step 2: Find the Chat Session**
   - Construct the chat workflow ID: `task_${taskId}`
   - Search for a session with:
     - `workflow_type: 'task_chat'` ✅
     - `workflow_id: 'task_{taskId}'` ✅
     - `user_id: {userId}` ✅
   - Load messages from the chat session, not the task session

### Fixed Code

```javascript
ipcMain.handle('tasks:getChatHistory', async (event, taskId) => {
  try {
    const userId = services.auth?.currentUser?.id;
    
    // STEP 1: Verify the TASK exists and belongs to this user
    const { data: taskSession, error: taskError } = await dbAdapter.supabase
      .from('conversation_sessions')
      .select('id, user_id, workflow_metadata, session_title')
      .eq('id', taskId)
      .eq('workflow_type', 'task')  // ✅ Verify the task itself
      .single();
    
    if (taskError || !taskSession) {
      return { success: false, error: 'Task not found', messages: [] };
    }
    
    if (taskSession.user_id !== userId) {
      return { success: false, error: 'Access denied', messages: [] };
    }
    
    // STEP 2: Find the CHAT session (workflow_type='task_chat')
    let taskSessionId = taskSessionIds[taskId];
    
    if (!taskSessionId) {
      const workflowId = `task_${taskId}`;  // ✅ Construct chat workflow ID
      
      // Query for task_chat session, NOT task session
      const { data: sessions } = await dbAdapter.supabase
        .from('conversation_sessions')
        .select('id, workflow_id, workflow_type, started_at')
        .eq('user_id', userId)
        .eq('workflow_type', 'task_chat')  // ✅ Look for chat session
        .eq('workflow_id', workflowId)      // ✅ Use constructed workflow ID
        .order('started_at', { ascending: false })
        .limit(1);
      
      if (sessions && sessions.length > 0) {
        taskSessionId = sessions[0].id;
        taskSessionIds[taskId] = taskSessionId;  // Cache for future use
      } else {
        // No chat session exists yet - will be created on first message
        return { success: true, messages: [] };
      }
    }
    
    // STEP 3: Get messages from the chat session
    const historyResult = await dbAdapter.getSessionMessages(taskSessionId);
    
    if (historyResult.success) {
      return {
        success: true,
        messages: historyResult.messages.map(msg => ({
          role: msg.role,
          content: msg.message_text || msg.content || '',
          timestamp: msg.created_at || msg.timestamp
        }))
      };
    }
    
    return { success: true, messages: [] };
  } catch (error) {
    logger.error('Failed to get chat history:', error);
    return { success: false, error: error.message, messages: [] };
  }
});
```

---

## 🎯 Key Improvements

### 1. Clear Separation of Concerns
- **Task verification** is separate from **chat session lookup**
- Each step has clear logging to track what's happening

### 2. Correct Session Types
- Tasks: `workflow_type: 'task'`
- Task Chats: `workflow_type: 'task_chat'`

### 3. Proper workflow_id Usage
- Task sessions: `workflow_id: '{userId}_task_{timestamp}'`
- Task chat sessions: `workflow_id: 'task_{taskId}'`

### 4. Enhanced Logging
```javascript
logger.info('Task verified for chat access', { 
  taskId, 
  userId,
  routeTo: taskSession.workflow_metadata?.route_to,
  workType: taskSession.workflow_metadata?.work_type
});

logger.info('Task chat session not in cache, looking up in database', { 
  taskId, 
  userId,
  workflowId,
  lookingFor: {
    user_id: userId,
    workflow_type: 'task_chat',
    workflow_id: workflowId
  }
});

logger.info('Found task chat session in database', { 
  taskId, 
  sessionId: taskSessionId,
  workflowId: sessions[0].workflow_id,
  startedAt: sessions[0].started_at
});
```

---

## 📊 Database Schema Reference

### conversation_sessions Table

**Task Entry:**
```json
{
  "id": "abc-123",
  "user_id": "user-456",
  "workflow_id": "user-456_task_1729123456789",
  "workflow_type": "task",
  "session_title": "Complete project documentation",
  "workflow_metadata": {
    "priority": "high",
    "route_to": "tasks-sales",
    "work_type": "task"
  }
}
```

**Task Chat Entry:**
```json
{
  "id": "xyz-789",
  "user_id": "user-456",
  "workflow_id": "task_abc-123",
  "workflow_type": "task_chat",
  "session_title": "Task: Complete project documentation",
  "workflow_metadata": {
    "task_id": "abc-123",
    "route_to": "tasks-sales",
    "work_type": "task"
  }
}
```

### conversation_messages Table

```json
{
  "id": "msg-001",
  "session_id": "xyz-789",  // Points to task_chat session
  "role": "user",
  "message_text": "How should I approach this task?",
  "created_at": "2025-10-16T10:30:00Z"
}
```

---

## ✨ Expected Behavior

### Before Fix
- ❌ Chat history would not load on first open
- ❌ Previous conversations were "lost"
- ❌ Empty chat interface every time

### After Fix
- ✅ Chat history loads immediately when opening a task
- ✅ Previous conversations persist across sessions
- ✅ Seamless chat experience with full context

---

## 🧪 Testing

### Test Scenario 1: First Time Opening Task Chat
1. User creates a task
2. User opens task chat (no messages yet)
3. Handler verifies task exists
4. Handler finds no chat session
5. Returns empty message array
6. User sends first message → chat session created

### Test Scenario 2: Reopening Task Chat
1. User opens task chat for existing task
2. Handler verifies task exists
3. Handler finds existing chat session via `workflow_id: 'task_{taskId}'`
4. Handler loads messages from chat session
5. Returns full conversation history

### Test Scenario 3: Cross-Session Persistence
1. User has conversation with task chat
2. User closes app
3. User reopens app and navigates to task
4. User opens task chat
5. Full conversation history is displayed ✅

---

## 🔧 Related Components

This fix works in conjunction with:

1. **`task-chat-handlers.js::tasks:sendChatMessage`**
   - Creates chat sessions with correct `workflow_type: 'task_chat'`
   - Uses `workflow_id: 'task_{taskId}'` for linking

2. **`SupabaseAdapter.js::getOrCreateActiveSession`**
   - Searches for sessions by `workflow_id` and `workflow_type`
   - Creates sessions with proper column structure

3. **`SupabaseAdapter.js::createConversationSession`**
   - Extracts `workflow_id`, `workflow_type` to top-level columns
   - Stores remaining metadata in JSONB column

4. **`TaskChat.jsx::loadChatHistory`**
   - Calls `getChatHistory` on mount
   - Displays loaded messages in UI

---

## 📝 Lessons Learned

1. **Session Types Matter**: Different workflow types represent different entities
2. **ID Relationships**: Use `workflow_id` to link related sessions
3. **Two-Phase Lookup**: Verify ownership, then find related data
4. **Logging is Critical**: Detailed logs helped identify the root cause
5. **Test Both Paths**: Empty state and populated state need different handling

---

## 🎉 Impact

This fix resolves the core issue of task chat persistence and enables:
- ✅ Proper conversation continuity
- ✅ Multi-session task collaboration
- ✅ Accurate chat history retrieval
- ✅ Better user experience with persistent context
- ✅ Correct role-based task routing (sales vs developer)

**Status:** ✅ **FIXED** - Task chat history now loads correctly from Supabase

