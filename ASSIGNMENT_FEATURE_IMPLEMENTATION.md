# Assignor/Assignee Feature Implementation

## 📋 Overview

This feature extracts **assignor** (who requested the task) and **assignee** (who it's assigned to) information from Slack messages, storing them with tasks for better accountability and tracking.

## 🎯 What Changed

### 1. Workflow Analyzer (`core/intelligence/workflow-analyzer.js`)

**Added Method: `extractAssignmentInfo()`**

This method extracts assignment information from Slack messages:

```javascript
extractAssignmentInfo(message, senderId, context = {}) {
  // Returns:
  // {
  //   assignor: { id, name, slack_user_id, email },
  //   assignee: { id, name, type, slack_user_id },
  //   mentionedUsers: [{ type, id, name }],
  //   isAssignment: boolean
  // }
}
```

**Features:**
- Extracts Slack user mentions (`<@U123456|John>` format)
- Extracts @username mentions (fallback)
- Detects assignment keywords (can you, please, assigned to, etc.)
- Identifies primary assignee (first mentioned user)
- Uses pattern matching for contextual assignment detection

**Updated Method: `captureInboundRequest()`**

Now calls `extractAssignmentInfo()` and includes assignment data in the request context:

```javascript
const assignmentInfo = this.extractAssignmentInfo(message, userId, context);

// Stores in context:
context: {
  // ... existing fields ...
  assignor: assignmentInfo.assignor,
  assignee: assignmentInfo.assignee,
  mentioned_users: assignmentInfo.mentionedUsers,
  is_assignment: assignmentInfo.isAssignment,
  ...context
}
```

### 2. Supabase Adapter (`desktop/main/supabase-adapter.js`)

**Updated: `createTask()` method**

Now stores assignor/assignee in task metadata:

```javascript
workflow_metadata: {
  priority: taskData.priority || 'medium',
  description: taskData.description || null,
  tags: taskData.tags || [],
  due_date: taskData.dueDate || null,
  parent_session_id: taskData.parentSessionId || null,
  assignor: taskData.assignor || null,        // NEW
  assignee: taskData.assignee || null,        // NEW
  mentioned_users: taskData.mentionedUsers || [] // NEW
}
```

**Updated: `getUserTasks()` method**

Returns assignor/assignee in task objects:

```javascript
const tasks = (data || []).map(session => ({
  // ... existing fields ...
  assignor: session.workflow_metadata?.assignor || null,
  assignee: session.workflow_metadata?.assignee || null,
  mentioned_users: session.workflow_metadata?.mentioned_users || []
}));
```

**Updated: `updateTask()` method**

Supports updating assignor/assignee:

```javascript
if (updates.assignor !== undefined) metadata.assignor = updates.assignor;
if (updates.assignee !== undefined) metadata.assignee = updates.assignee;
```

### 3. UI (`desktop/renderer/copilot-with-tasks.html`)

**Updated: Task Rendering**

Now displays assignor/assignee badges:

```html
<div class="task-meta">
  ${task.assignor ? `<span class="task-assignor">👤 From: ${task.assignor.name || task.assignor.id}</span>` : ''}
  ${task.assignee ? `<span class="task-assignee">👉 Assigned to: ${task.assignee.name || task.assignee.id}</span>` : ''}
  <span>Created ${formatDate(task.created_at)}</span>
</div>
```

**Added: CSS Styling**

```css
.task-assignor, .task-assignee {
  display: inline-block;
  margin-right: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
}

.task-assignor {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.task-assignee {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}
```

## 📊 Data Structure

### In Supabase (`conversation_sessions.workflow_metadata`)

```json
{
  "priority": "high",
  "description": "Review the Q3 financial report",
  "tags": ["review", "finance"],
  "due_date": "2025-10-05T17:00:00Z",
  "assignor": {
    "id": "U987654",
    "name": "Sarah Chen",
    "slack_user_id": "U987654",
    "email": "sarah@company.com"
  },
  "assignee": {
    "id": "U123456",
    "name": "John",
    "type": "slack_user",
    "slack_user_id": "U123456"
  },
  "mentioned_users": [
    {
      "type": "slack_user",
      "id": "U123456",
      "name": "John"
    }
  ]
}
```

## 🔍 How It Works

### From Slack Message to Task

1. **Slack Message Received:**
   ```
   "Hey <@U123456|John>, can you please review the Q3 report by Friday?"
   ```

2. **Workflow Analyzer Extracts:**
   - Assignor: User who sent the message (from context)
   - Assignee: `<@U123456|John>` (first mentioned user)
   - Mentioned Users: All `@mentions` in the message
   - Is Assignment: `true` (has assignment keywords + mention)

3. **Stored in Supabase:**
   - Task created in `conversation_sessions` with `workflow_type='task'`
   - Assignment info stored in `workflow_metadata` JSONB field

4. **Displayed in UI:**
   - 👤 From: Sarah Chen
   - 👉 Assigned to: John
   - Priority badge, description, etc.

## 🧪 Testing

Run the test script to create sample tasks with assignments:

```bash
node test-assignment-feature.js
```

This creates 4 test scenarios:
1. Task with explicit Slack mention
2. Task with multiple user mentions
3. General task (no specific assignee)
4. Urgent task with inferred assignee

## 📝 Assignment Detection Patterns

The system looks for these patterns:

### Assignment Keywords
- `can you`, `could you`, `please`
- `assign to`, `assigned to`
- `need you to`, `want you to`
- `handle`, `take care of`, `work on`
- `due`, `deadline`, `by [date]`

### Contextual Patterns
- `can you please [name] handle`
- `assigned to @user`
- `@user, can you`
- `for @user to work on`
- `hey @user, can you`

## 🎨 UI Display

### Assignor Badge (Blue)
- Shows who requested/created the task
- Format: "👤 From: [name]"
- Color: Blue background

### Assignee Badge (Green)
- Shows who the task is assigned to
- Format: "👉 Assigned to: [name]"
- Color: Green background

### Empty State
- If no assignor: Badge not shown
- If no assignee: Badge not shown (unassigned task)

## 🔧 Future Enhancements

Potential improvements:
1. **Assignment Reassignment**: UI to change assignee
2. **Multi-Assignee Support**: Show all mentioned users, not just first
3. **User Lookup**: Resolve Slack IDs to full user profiles
4. **Assignment Notifications**: Alert assignees when tasks created
5. **Workload View**: See all tasks assigned to specific users
6. **Team Assignment**: Support assigning to teams/groups

## 📚 Files Modified

1. `core/intelligence/workflow-analyzer.js` - Assignment extraction logic
2. `desktop/main/supabase-adapter.js` - Database operations
3. `desktop/renderer/copilot-with-tasks.html` - UI display

## 🚀 Usage

### Creating a Task with Assignment (from code)

```javascript
await dbAdapter.createTask('desktop-user', {
  title: 'Review Q3 report',
  priority: 'high',
  description: 'Financial report needs review',
  assignor: {
    id: 'U987654',
    name: 'Sarah Chen',
    slack_user_id: 'U987654'
  },
  assignee: {
    id: 'U123456',
    name: 'John',
    slack_user_id: 'U123456'
  }
});
```

### From Slack Workflow (automatic)

When workflow intelligence captures a Slack message:
1. Message is analyzed by `WorkflowIntelligenceSystem`
2. `extractAssignmentInfo()` extracts assignor/assignee
3. If task is created, assignment info is automatically included
4. Task appears in desktop UI with assignment badges

---

**Implementation Date:** October 2, 2025  
**Status:** ✅ Complete and Tested

