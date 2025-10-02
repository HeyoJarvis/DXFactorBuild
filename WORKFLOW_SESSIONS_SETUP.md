# Workflow-Based Sessions Setup Guide

This guide walks you through setting up workflow-based conversation sessions in Supabase, where each workflow type (automation, integration, tools, etc.) gets its own separate chat thread.

## 📋 Overview

Instead of one continuous conversation, the system will now:
- **Detect workflow types** from user messages (automation, tool recommendations, integration help, etc.)
- **Create a NEW session for EACH workflow detected** (workflow type is just metadata)
- **Maintain separate conversation history** for each workflow instance
- **Display all sessions as independent chat threads** in the UI

**Important:** Each workflow detection creates a **new session**. The workflow type (e.g., "task_automation") is stored as metadata/context but does NOT group sessions together. You can have multiple "task_automation" sessions - each is a separate workflow.

## 🚀 Step 1: Run the Supabase Migration

### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project: https://app.supabase.com/project/ydbujcuddfgiubjjajuq/editor

2. Click **SQL Editor** in the left sidebar

3. Click **New Query**

4. Open the file `data/storage/desktop-tables-workflow-sessions.sql` and copy all its contents

5. Paste into the SQL editor

6. Click **Run** (or press Ctrl/Cmd + Enter)

7. You should see success messages:
   ```
   ✅ Workflow-based conversation tables created successfully!
   📊 Tables created: conversation_sessions, conversation_messages
   🔧 Helper functions: get_or_create_workflow_session, get_user_workflow_summary
   ```

### Option B: Using Supabase CLI

```bash
cd /home/sdalal/test/BeachBaby
supabase db push data/storage/desktop-tables-workflow-sessions.sql
```

## ✅ Step 2: Verify Tables Were Created

1. In Supabase, click **Table Editor** in the left sidebar

2. You should now see these tables:
   - `conversation_sessions` - Stores workflow-based sessions
   - `conversation_messages` - Stores messages within sessions
   
3. Check the `conversation_sessions` table structure:
   - `id` (UUID) - Primary key
   - `user_id` (VARCHAR) - User identifier
   - `workflow_type` (VARCHAR) - Type of workflow (e.g., "task_automation")
   - `workflow_intent` (VARCHAR) - User intent (e.g., "information_seeking")
   - `session_title` (VARCHAR) - Human-readable title with emoji
   - `workflow_metadata` (JSONB) - Rich metadata (urgency, tools, entities)
   - `message_count` (INTEGER) - Auto-updated count
   - `last_activity_at` (TIMESTAMPTZ) - Auto-updated timestamp
   - `is_active`, `is_completed` (BOOLEAN) - Session state

## 🧪 Step 3: Test the Setup

Run the test script to verify everything works:

```bash
cd /home/sdalal/test/BeachBaby
node test-workflow-sessions.js
```

This will:
1. ✅ Create 4 different workflow sessions (automation, tools, integration, general)
2. ✅ Add messages to each workflow
3. ✅ Retrieve and display sessions grouped by workflow type
4. ✅ Show workflow summary statistics
5. ✅ Test session reuse (same workflow type should reuse existing session)
6. ✅ Test message retrieval for specific workflow
7. ✅ Test completing a workflow session

### Expected Output:

```
🧪 Testing Workflow-Based Sessions

✅ Adapter initialized

📝 Test 1: Creating workflow sessions for different types

Creating session for: task_automation...
  ✅ Session created: abc123-...
     Title: 🤖 Task Automation
     New session: true
     Workflow ID: test-user-workflow_task_automation_1234567890

Creating session for: tool_recommendation...
  ✅ Session created: def456-...
     Title: 🛠️ Tool Recommendations
     ...

💬 Test 2: Adding messages to each workflow
...

📊 Test 3: Retrieving all workflow sessions

Total sessions: 4

Sessions grouped by workflow type:

  task_automation:
    - 🤖 Task Automation
      Messages: 3
      Last activity: 10/2/2025, 3:45:23 PM
      Active: true

  tool_recommendation:
    - 🛠️ Tool Recommendations
      Messages: 2
      ...

🎉 All tests completed!
```

## 🔍 Step 4: View Data in Supabase

1. Go to **Table Editor** → `conversation_sessions`

2. You should see test sessions with different workflow types:
   - `task_automation` - "🤖 Task Automation"
   - `tool_recommendation` - "🛠️ Tool Recommendations"
   - `integration_help` - "🔗 Integration Support"
   - `general_inquiry` - "💬 General Chat"

3. Click on a session to see details including `workflow_metadata`

4. Go to **Table Editor** → `conversation_messages`

5. You'll see messages linked to different sessions via `session_id`

## 🧹 Cleanup Test Data (Optional)

To remove test data after verification:

```sql
-- In Supabase SQL Editor
DELETE FROM conversation_sessions WHERE user_id = 'test-user-workflow';
```

The messages will be automatically deleted due to CASCADE.

## 📊 Available Workflow Types

The system automatically detects and categorizes these workflow types:

| Workflow Type | Icon | Description | Example Triggers |
|--------------|------|-------------|------------------|
| `task_automation` | 🤖 | Automating repetitive tasks | "automate", "workflow", "process" |
| `tool_recommendation` | 🛠️ | Finding the right tools | "tool", "software", "recommend" |
| `integration_help` | 🔗 | Connecting systems | "integrate", "connect", "sync" |
| `workflow_optimization` | ⚡ | Improving processes | "optimize", "improve", "streamline" |
| `problem_solving` | 🔍 | Solving specific issues | "problem", "issue", "fix" |
| `information_seeking` | 💡 | Getting information | "help", "how", "what", "explain" |
| `learning` | 📚 | Learning new skills | "learn", "tutorial", "guide" |
| `reporting_request` | 📊 | Reports and analytics | "report", "dashboard", "metrics" |
| `general_inquiry` | 💬 | General chat | Default fallback |

## 🎯 Next Steps

Now that the database is set up and tested:

1. **Integrate with Copilot** - Update `desktop/main.js` to use workflow sessions
2. **Add UI Tabs** - Create workflow tabs in the copilot interface
3. **Enable Workflow Detection** - Automatically categorize user messages
4. **Test in Real App** - Try sending different types of messages

## 📚 API Methods Available

The `DesktopSupabaseAdapter` now has these new methods:

```javascript
// Create a NEW workflow session (always creates new, never reuses)
const result = await adapter.createWorkflowSession(userId, {
  workflowType: 'task_automation',
  workflowIntent: 'task_automation',
  urgency: 'high',
  toolsMentioned: ['zapier'],
  entities: { actions: ['automate'] }
});
// Returns: { success: true, session: {...}, isNew: true }

// Get user's current active session (most recent, any workflow type)
const activeResult = await adapter.getUserActiveSession(userId, 1); // within last 1 hour
// Returns: { success: true, session: {...} } or { success: true, session: null }

// Get all sessions (optionally grouped by workflow type)
const sessions = await adapter.getUserWorkflowSessions(userId);
// Returns: { success: true, sessions: [...], groupedByWorkflow: {...} }

// Get workflow summary statistics
const summary = await adapter.getUserWorkflowSummary(userId, 7); // last 7 days
// Returns: { success: true, summary: [...] }

// Complete a workflow (mark as done)
await adapter.completeWorkflowSession(sessionId);
```

### Usage Pattern:

```javascript
// When workflow is detected from Slack message
const workflowAnalysis = await workflowIntelligence.captureInboundRequest(userId, channelId, message);

// Create a NEW session for this workflow
const sessionResult = await dbAdapter.createWorkflowSession(userId, {
  workflowType: workflowAnalysis.context.messageType,
  workflowIntent: workflowAnalysis.context.intent.intent,
  urgency: workflowAnalysis.context.urgency,
  toolsMentioned: workflowAnalysis.context.tools_mentioned,
  entities: workflowAnalysis.context.entities
});

// Use the session for conversation
await dbAdapter.saveMessageToSession(sessionResult.session.id, userMessage, 'user');
await dbAdapter.saveMessageToSession(sessionResult.session.id, aiResponse, 'assistant');
```

## ❓ Troubleshooting

### Error: "relation conversation_sessions does not exist"
- The migration didn't run successfully
- Run the SQL migration again in Supabase dashboard

### Error: "permission denied for table conversation_sessions"
- Make sure you're using the service role key in `.env`
- Check: `SUPABASE_SERVICE_ROLE_KEY=...`

### Test script fails to connect
- Verify `.env` has correct Supabase credentials
- Check: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

### Sessions not grouping by workflow type
- Check the `workflow_type` field is being set correctly
- Verify the adapter methods are being called with workflow data

## 🎉 Success Criteria

You'll know everything is working when:
- ✅ Test script runs without errors
- ✅ Tables visible in Supabase dashboard
- ✅ Multiple separate sessions created (5+ for test user)
- ✅ Multiple sessions can have the same workflow_type (e.g., 2+ "task_automation")
- ✅ Each session is independent with its own workflow_id
- ✅ Messages linked to correct sessions
- ✅ Workflow metadata includes urgency, tools, entities
- ✅ Each workflow detection creates a NEW session (not reused)

---

**Ready to proceed?** Once the tests pass, we can integrate this into your desktop copilot! 🚀

