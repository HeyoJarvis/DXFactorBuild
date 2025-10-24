# JIRA Update Fix - UUID vs JIRA Key Issue ✅

## Problem Identified

When trying to edit JIRA tasks, you got this error:
```
Failed to update title: JIRA API error: 404 - {"errorMessages":["Issue does not exist or you do not have permission to see it."],"errors":{}}
The issue exists (cfac5763-a1d6-44d6-b5b3-6a892090bb94)
```

### Root Cause

The code was using the **database UUID** (`cfac5763-a1d6-44d6-b5b3-6a892090bb94`) as the JIRA issue key, but JIRA expects keys like `PROJ-123`, not UUIDs!

**Two types of IDs in play:**
1. **Database ID (UUID)**: `cfac5763-a1d6-44d6-b5b3-6a892090bb94` - Our internal Supabase primary key
2. **JIRA Key**: `PROJ-123`, `DEV-456` - The actual JIRA issue identifier

## How Tasks Are Stored

### In Supabase (conversation_sessions table):
```javascript
{
  id: "cfac5763-a1d6-44d6-b5b3-6a892090bb94",  // ← UUID primary key
  workflow_metadata: {
    external_key: "PROJ-123",  // ← JIRA issue key!
    external_id: "10234",      // ← JIRA internal ID
    external_source: "jira",
    external_url: "https://..."
  }
}
```

### When Fetched to UI:
```javascript
{
  id: "cfac5763-a1d6-44d6-b5b3-6a892090bb94",  // Database UUID
  external_key: "PROJ-123",                     // JIRA key (extracted from metadata)
  title: "Implement feature X",
  // ... other fields
}
```

## The Bug

**TaskChat.jsx line 101 (BEFORE):**
```javascript
const response = await window.electronAPI.jira.updateIssue(task.id, {
  summary: editedTitle
});
```

This sent the UUID to JIRA API, which returned 404 because UUIDs aren't valid JIRA keys!

## The Fix

**TaskChat.jsx (AFTER):**
```javascript
// CRITICAL: Use JIRA key (external_key) not the database UUID (id)
// Task IDs from database are UUIDs like cfac5763-a1d6-44d6-b5b3-6a892090bb94
// JIRA keys are like PROJ-123
const jiraKey = task.external_key || task.jira_key || task.id;

console.log('🔧 Updating JIRA issue:', {
  taskId: task.id,
  jiraKey: jiraKey,
  title: editedTitle
});

const response = await window.electronAPI.jira.updateIssue(jiraKey, {
  summary: editedTitle
});
```

### Fallback Chain:
1. First try `task.external_key` (JIRA key from metadata)
2. Then try `task.jira_key` (alternative field name)
3. Finally fallback to `task.id` (for tasks directly from JIRA sync)

## Flow Diagram

### Task Creation (JIRA → Supabase):
```
1. JIRA issue created: PROJ-123
   ↓
2. Sync to Supabase via JIRAService.syncTasks()
   ↓
3. Store in conversation_sessions:
   {
     id: UUID (new),
     workflow_metadata: {
       external_key: "PROJ-123"  ← Store JIRA key here
     }
   }
```

### Task Retrieval (Supabase → UI):
```
1. Fetch from conversation_sessions
   ↓
2. Transform in SupabaseAdapter.getUserTasks() (line 754)
   {
     id: UUID,
     external_key: workflow_metadata.external_key  ← Extract JIRA key
   }
   ↓
3. Pass to TaskChat component
```

### Task Update (UI → JIRA):
```
1. User edits title in TaskChat
   ↓
2. Extract JIRA key: task.external_key (BEFORE: used task.id ❌)
   ↓
3. Call JIRA API with correct key
   ↓
4. JIRA updates successfully ✅
```

## Why This Happened

**Two different task sources:**

1. **Direct from JIRA** (TasksDeveloper.jsx line 504):
   ```javascript
   return {
     id: issue.key,  // ← Uses JIRA key as ID
     external_key: issue.key
   };
   ```
   Works fine because `id === JIRA key`

2. **From Supabase** (SupabaseAdapter.js line 739-754):
   ```javascript
   {
     id: session.id,  // ← UUID!
     external_key: session.workflow_metadata?.external_key  // ← JIRA key
   };
   ```
   Needs to use `external_key` not `id`

## Enhanced Error Messages

Now when update fails, you'll see:
```
Failed to update title: JIRA API error: ...

Make sure:
1. You're connected to JIRA
2. You have permission to edit this issue
3. The issue exists

Task ID: cfac5763-a1d6-44d6-b5b3-6a892090bb94
JIRA Key: PROJ-123
```

This shows BOTH IDs so you can debug which one is being used.

## Files Modified

1. ✅ `desktop2/renderer2/src/components/Tasks/TaskChat.jsx`
   - Added logic to use `external_key` instead of `id`
   - Added console logging to show which key is being used
   - Enhanced error messages to show both IDs

2. ✅ `desktop2/main/ipc/jira-handlers.js`
   - Enhanced logging to track issue keys and user IDs
   - Better error messages

## Testing

Now when you edit a JIRA task:

1. **Check console logs:**
   ```
   🔧 Updating JIRA issue: {
     taskId: "cfac5763-a1d6-44d6-b5b3-6a892090bb94",
     jiraKey: "PROJ-123",
     title: "New title"
   }
   ```

2. **Verify the update:**
   - If it succeeds: Title updates in both UI and JIRA
   - If it fails: Error shows both the UUID and JIRA key for debugging

3. **Check JIRA directly:**
   - Go to your JIRA instance
   - Find the issue by its key (e.g., PROJ-123)
   - Verify the title was updated

## Key Takeaway

**Always use `external_key` when calling external APIs (JIRA, GitHub, etc.)!**

The `id` field is for internal database operations only.
The `external_key` field is for syncing with external services.

---

✅ **Status**: FIXED
- Using correct JIRA key instead of UUID ✓
- Enhanced error messages ✓
- Added debug logging ✓
- Fallback chain for different task sources ✓

**JIRA updates should now work correctly!** 🎉
