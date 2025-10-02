# ✓ To Do List Feature Setup

A beautiful task management system integrated into your HeyJarvis desktop app with Supabase backend.

**Smart Design**: Tasks are stored as `conversation_sessions` with `workflow_type='task'`, so you get:
- ✅ Unified data model (conversations AND tasks in one table)
- ✅ Can link tasks to the chat that spawned them
- ✅ All existing session features (timestamps, metadata, completion tracking)
- ✅ No additional tables needed!

## 🚀 Setup Steps

### Step 1: Ensure Workflow Sessions Table Exists

You should have already run the `desktop-tables-workflow-sessions.sql` migration. If not:

1. Go to your Supabase SQL Editor: https://app.supabase.com/project/ydbujcuddfgiubjjajuq/editor

2. Copy the contents of `data/storage/desktop-tables-workflow-sessions.sql`

3. Paste and run in the SQL editor

4. You should see: `✅ Workflow-based conversation tables created successfully!`

### Step 2: Verify Table Supports Tasks

1. Go to **Table Editor** → `conversation_sessions`

2. The table already has everything needed for tasks:
   - `session_title` → task title
   - `workflow_type` → 'task' for to-do items
   - `workflow_metadata` (JSONB) → stores priority, description, tags, due_date
   - `is_completed` → task completion status
   - `completed_at` → when task was completed

### Step 3: Start the Desktop App

```bash
cd /home/sdalal/test/BeachBaby
npx electron desktop/main.js --dev
```

## ✨ Features

### Tab Navigation
- **💬 Copilot Tab**: AI assistant (placeholder for now)
- **✓ To Do Tab**: Full task management system

### Task Management
- ✅ **Create tasks** with title and priority
- ✅ **Priority levels**: Low, Medium, High, Urgent (color-coded)
- ✅ **Toggle completion** by clicking checkbox
- ✅ **Delete tasks** with confirmation
- ✅ **Live stats** showing Todo / In Progress / Completed counts
- ✅ **Badge counter** on tab showing active tasks

### Priority System
- 🔴 **Urgent**: Red badge, highest priority
- 🟠 **High**: Orange badge, high priority
- 🔵 **Medium**: Blue badge (default)
- ⚪ **Low**: Gray badge, lowest priority

### Smart Features
- **Auto-save**: All changes save instantly to Supabase
- **Real-time updates**: Changes reflect immediately
- **Empty state**: Helpful message when no tasks exist
- **Task metadata**: Shows creation time ("2h ago", "just now")
- **Keyboard shortcuts**: Press Enter in input to add task
- **Completed task styling**: Strikethrough and fade effect

## 🎨 UI Design

- **Apple-inspired design**: SF Pro fonts, smooth animations
- **Glass morphism**: Blurred backdrop with transparency
- **Smooth transitions**: All interactions animated
- **Dark mode optimized**: Beautiful contrast and readability
- **Color-coded priorities**: Visual priority indicators
- **Hover effects**: Interactive feedback on all elements

## 🔮 Future Enhancements

### Ready to Implement:
1. **Workflow linking**: Create tasks from workflow sessions
2. **Due dates**: Add date picker for deadlines
3. **Tags**: Add categorization with tag chips
4. **Descriptions**: Expand tasks to add detailed descriptions
5. **In-progress status**: Add button to mark tasks in progress
6. **Filtering**: Filter by priority, status, or tags
7. **Search**: Search tasks by title/description
8. **Sorting**: Sort by priority, due date, or creation time
9. **Bulk actions**: Select multiple tasks for batch operations
10. **Task details modal**: Click task for expanded view with more fields

### Integration Ideas:
- **From Slack**: Convert Slack messages into tasks
- **From Copilot**: AI suggests tasks from conversation
- **From Workflows**: Auto-create tasks for detected workflows
- **Export**: Export tasks to CSV, JSON, or sync to external tools

## 📊 Database Schema

### Tables:
- `conversation_sessions` - Unified table for both conversations AND tasks!
  - When `workflow_type='task'` → it's a to-do item
  - When `workflow_type='task_automation'` (or other) → it's a chat session
  
### Task Data Structure:
```javascript
{
  session_title: "Buy groceries",           // Task title
  workflow_type: "task",                    // Identifies as a task
  workflow_metadata: {                      // JSONB field stores task details
    priority: "high",                       // low, medium, high, urgent
    description: "Milk, eggs, bread",       // Optional description
    tags: ["shopping", "personal"],         // Array of tags
    due_date: "2025-10-05T10:00:00Z",      // Optional due date
    parent_session_id: "uuid..."            // Link to chat that created this task
  },
  is_completed: false,                      // Task completion status
  completed_at: null                        // Timestamp when completed
}
```

### Benefits:
- ✅ **Unified**: All sessions in one place
- ✅ **Linked**: Tasks can reference the chat that spawned them
- ✅ **Flexible**: JSONB metadata can store any task-specific data
- ✅ **Efficient**: Existing indexes already optimize task queries
- ✅ **Scalable**: Easy to add new task fields without migrations

## 🧪 Testing

Try these scenarios:

1. **Create a task**:
   - Type "Write documentation" → Click "Add Task"
   - Should appear in list immediately

2. **Change priority**:
   - Select "Urgent" → Add task
   - Should show red badge

3. **Complete a task**:
   - Click checkbox on any task
   - Should strikethrough and fade

4. **Delete a task**:
   - Click trash icon
   - Confirm deletion

5. **Watch stats update**:
   - Create and complete tasks
   - Stats should update in real-time

## 🔧 API Reference

### Electron API (available in renderer)

```javascript
// Create task
await window.electronAPI.tasks.create({
  title: 'My task',
  priority: 'high',
  description: 'Optional description'
});

// Get all tasks
const result = await window.electronAPI.tasks.getAll();
console.log(result.tasks); // Array of tasks

// Update task
await window.electronAPI.tasks.update(taskId, {
  title: 'Updated title',
  status: 'in_progress'
});

// Delete task
await window.electronAPI.tasks.delete(taskId);

// Toggle completion
await window.electronAPI.tasks.toggle(taskId, currentStatus);

// Get statistics
const stats = await window.electronAPI.tasks.getStats();
console.log(stats); // { todo_count, in_progress_count, completed_count, etc. }
```

### Supabase Adapter Methods

```javascript
// Backend methods (main process)
// All methods use conversation_sessions table with workflow_type='task'

// Create task (inserts into conversation_sessions)
await dbAdapter.createTask(userId, {
  title: 'My task',
  priority: 'high',
  description: 'Optional',
  tags: ['work'],
  parentSessionId: 'link-to-chat-uuid'  // Optional: link to chat that spawned it
});

// Get tasks (queries conversation_sessions WHERE workflow_type='task')
await dbAdapter.getUserTasks(userId, {
  includeCompleted: false,
  priority: 'high',
  limit: 50
});

// Update task (updates session_title and workflow_metadata)
await dbAdapter.updateTask(taskId, {
  title: 'Updated title',
  status: 'completed',  // Sets is_completed=true
  priority: 'urgent'
});

// Delete task (deletes from conversation_sessions)
await dbAdapter.deleteTask(taskId);

// Toggle completion (updates is_completed field)
await dbAdapter.toggleTaskCompletion(taskId, currentStatus);

// Get statistics (counts from conversation_sessions)
await dbAdapter.getTaskStats(userId);
```

## 🎯 Success Criteria

You'll know it's working when:
- ✅ Two tabs visible: Copilot and To Do
- ✅ Can create tasks and they appear in list
- ✅ Tasks save to Supabase `conversation_sessions` table with `workflow_type='task'`
- ✅ In Supabase Table Editor, you'll see tasks mixed with chat sessions (differentiated by workflow_type)
- ✅ Can complete tasks (checkbox toggles `is_completed` field)
- ✅ Can delete tasks
- ✅ Stats update in real-time
- ✅ Badge shows active task count
- ✅ Priority colors display correctly
- ✅ Smooth animations on all interactions
- ✅ Tasks can be linked to the chat that created them (via `parent_session_id` in metadata)

## 🐛 Troubleshooting

### Tasks not saving
- Check Supabase connection in console
- Verify `conversation_sessions` table exists (from workflow sessions migration)
- Check `SUPABASE_SERVICE_ROLE_KEY` in `.env`
- Look for tasks in Supabase Table Editor → `conversation_sessions` WHERE `workflow_type='task'`

### UI not loading
- Make sure `copilot-with-tasks.html` exists
- Check console for JavaScript errors
- Verify preload script loaded correctly

### Stats not updating
- Refresh the tasks list
- Check console for API errors
- Stats are calculated by counting rows in `conversation_sessions` with `workflow_type='task'`

### Tasks showing up as workflows or vice versa
- Check the `workflow_type` field in Supabase
- Tasks should have `workflow_type='task'`
- Chats should have other workflow types like `'task_automation'`, `'general_inquiry'`, etc.

---

**Enjoy your new task management system!** 🎉

