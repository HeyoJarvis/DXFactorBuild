# 🎯 Slack ID-Based Task Assignment System

## Overview

HeyJarvis now uses **Slack user IDs** for task assignment and filtering, ensuring reliable and unambiguous task management across the system.

---

## 🔑 Key Changes

### Why Slack IDs?

**Before (Name-based):**
- ❌ Ambiguous: Multiple people can have the same name
- ❌ Fragile: Names can change
- ❌ Unreliable: Name parsing is error-prone

**After (Slack ID-based):**
- ✅ Unique: Each Slack user has a unique ID (e.g., `U09GJSJLDNW`)
- ✅ Stable: IDs never change
- ✅ Reliable: Direct ID comparison

---

## 📊 How It Works

### 1. Task Creation

When a Slack message mentions a user:
```javascript
// Message: "@Avi can you build the dashboard?"
// System extracts: slackUserId = "U09GJSJLDNW"

const taskData = {
  title: "can you build the dashboard?",
  assignor: message.user,        // Slack ID of sender
  assignee: "U09GJSJLDNW",       // Slack ID of Avi
  ...
};
```

### 2. Task Storage

Tasks are stored in `conversation_sessions` table with:
```javascript
workflow_metadata: {
  assignor: "U01EVR49DDX",  // Slack ID (who created/assigned)
  assignee: "U09GJSJLDNW",  // Slack ID (who it's assigned to)
  mentioned_users: ["U09GJSJLDNW", "U12345678"],  // All mentioned Slack IDs
  ...
}
```

### 3. Task Filtering

**"Assigned to Me"** view:
```javascript
// Show tasks where:
- task.assignee === currentUser.slack_user_id  // Explicitly assigned to me
- task.assignor === currentUser.slack_user_id && task.assignee === currentUser.slack_user_id  // Self-assigned
- task.assignor === currentUser.slack_user_id && !task.assignee  // Personal task (no assignee)
```

**"Assigned by Me"** view:
```javascript
// Show tasks where:
- task.assignor === currentUser.slack_user_id  // I created it
- task.assignee !== currentUser.slack_user_id || !task.assignee  // Delegated to someone else
```

---

## 🔍 Implementation Details

### File: `desktop/main/supabase-adapter.js`

**Key Method: `getUserTasks(userId, filters)`**

```javascript
async getUserTasks(userId, filters = {}) {
  // 1. Get user's Slack ID from Supabase
  const { data: userData } = await this.supabase
    .from('users')
    .select('slack_user_id')
    .eq('id', userId)
    .single();
  
  const userSlackId = userData?.slack_user_id;
  
  // 2. Fetch ALL tasks (not filtered by user_id)
  let query = this.supabase
    .from('conversation_sessions')
    .select('*')
    .eq('workflow_type', 'task');
  
  // 3. Filter by Slack IDs in metadata
  if (assignmentView === 'assigned_to_me') {
    tasks = tasks.filter(task => {
      const isAssignee = task.assignee === userSlackId;
      const isSelfAssigned = task.assignor === userSlackId && task.assignee === userSlackId;
      const isPersonalTask = task.assignor === userSlackId && !task.assignee;
      
      return isAssignee || isSelfAssigned || isPersonalTask;
    });
  }
}
```

---

## 🎯 Benefits

### 1. **Accurate Task Assignment**
- Tasks are assigned to the correct person based on Slack mentions
- No confusion from similar names

### 2. **Cross-User Visibility**
- Users can see tasks assigned to them by others
- Delegation tracking works correctly

### 3. **Reliable Filtering**
- "Assigned to Me" shows tasks where your Slack ID is the assignee
- "Assigned by Me" shows tasks you created for others

### 4. **Scalable**
- Works across multiple workspaces
- Handles team growth without name conflicts

---

## 📋 Example Flow

### Scenario: Task Assignment via Slack

1. **Slack Message:**
   ```
   @Avi can you collaborate on building the new user dashboard feature?
   ```

2. **System Processing:**
   ```javascript
   {
     sender: "U01EVR49DDX",  // John's Slack ID
     mentioned: ["U09GJSJLDNW"],  // Avi's Slack ID
     message: "can you collaborate on building the new user dashboard feature?"
   }
   ```

3. **Task Creation:**
   ```javascript
   {
     title: "can you collaborate on building the new user dashboard feature?",
     assignor: "U01EVR49DDX",  // John (sender)
     assignee: "U09GJSJLDNW",  // Avi (mentioned)
     user_id: "avi-supabase-uuid",  // Avi's Supabase user ID
     workflow_type: "task"
   }
   ```

4. **Avi's View ("Assigned to Me"):**
   ```
   ✅ Shows task because:
   - task.assignee === "U09GJSJLDNW" (Avi's Slack ID)
   ```

5. **John's View ("Assigned by Me"):**
   ```
   ✅ Shows task because:
   - task.assignor === "U01EVR49DDX" (John's Slack ID)
   - task.assignee !== "U01EVR49DDX" (delegated to Avi)
   ```

---

## 🔧 Technical Notes

### Slack User ID Format
- Format: `U` + alphanumeric (e.g., `U09GJSJLDNW`, `U01EVR49DDX`)
- Length: Typically 11 characters
- Case-sensitive: Always uppercase

### Database Schema
```sql
-- users table
CREATE TABLE users (
  id UUID PRIMARY KEY,
  slack_user_id TEXT UNIQUE,  -- Slack ID stored here
  name TEXT,
  email TEXT
);

-- conversation_sessions table (stores tasks)
CREATE TABLE conversation_sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  workflow_type TEXT,
  workflow_metadata JSONB  -- Contains assignor, assignee, mentioned_users
);
```

### Lookup Helper
```javascript
// Helper to find Supabase user by Slack ID
async function getSupabaseUserBySlackId(slackUserId) {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('slack_user_id', slackUserId)
    .single();
  
  return data;
}
```

---

## ✅ Testing Checklist

- [x] Tasks created with Slack IDs in metadata
- [x] "Assigned to Me" filters by assignee Slack ID
- [x] "Assigned by Me" filters by assignor Slack ID
- [x] Personal tasks (no assignee) show in "Assigned to Me"
- [x] Delegated tasks show in "Assigned by Me"
- [x] Slack user names resolved for display
- [x] Cross-user task visibility works

---

## 🚀 Future Enhancements

1. **Team Views**: Show all tasks for a team/channel
2. **Bulk Assignment**: Assign tasks to multiple users
3. **Task Reassignment**: Change assignee while preserving history
4. **Slack Notifications**: Notify users when assigned a task
5. **Task Comments**: Thread-based task discussions

---

**Last Updated:** October 7, 2025  
**Status:** ✅ Implemented and tested


