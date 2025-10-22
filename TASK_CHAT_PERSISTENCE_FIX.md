# Task Chat Persistence Fix

## Problem Summary
Task chats weren't saving messages due to two database schema mismatches:

1. **Missing `user_id` column** - Production schema requires it, but code wasn't providing it
2. **Broken trigger** - Database trigger was trying to update `last_activity_at` (which doesn't exist) instead of `last_message_at`

## What Was Fixed

### 1. Code Changes

#### desktop2/main/services/SupabaseAdapter.js
- ✅ Added `userId` parameter to `saveMessageToSession()`
- ✅ Now inserts `user_id` with each message
- ✅ Uses `context_used` column instead of `metadata`
- ✅ Manually updates `last_message_at` to bypass broken trigger

#### desktop2/main/ipc/task-chat-handlers.js
- ✅ Passes `userId` when saving messages

### 2. Database Migration

#### data/storage/fix-chat-persistence.sql
- ✅ Fixes trigger to update `last_message_at` instead of `last_activity_at`
- ✅ Adds `user_id` column to `conversation_messages` if missing
- ✅ Adds `context_used` column if missing
- ✅ Backfills existing messages with user_id from session
- ✅ Creates performance index

## How to Apply the Fix

### Step 1: Run the Database Migration

Go to your Supabase dashboard → SQL Editor → New Query, then paste and run the contents of:

```
/Users/jarvis/Code/HeyJarvis/data/storage/fix-chat-persistence.sql
```

**Expected Output:**
```
✅ Task chat persistence fixed!
Trigger now updates last_message_at correctly
conversation_messages now has user_id column
conversation_messages now has context_used column
```

### Step 2: Restart Your App

```bash
cd /Users/jarvis/Code/HeyJarvis/desktop2
npm run dev
```

### Step 3: Test Task Chat

1. Open a task (Sales or Dev, doesn't matter)
2. Send a message in the task chat
3. Close the task and reopen it
4. **Verify:** Chat history should now persist!

## Verification

### Check Logs - Should See:
```
✅ Message saved to session
✅ No more "column last_activity_at does not exist" errors
✅ No more "user_id required" errors
```

### Check Database - Should Have:
```sql
-- Verify messages are being saved
SELECT
  cm.id,
  cm.session_id,
  cm.user_id,
  cm.role,
  cm.message_text,
  cm.timestamp
FROM conversation_messages cm
JOIN conversation_sessions cs ON cm.session_id = cs.id
WHERE cs.workflow_type = 'task_chat'
ORDER BY cm.timestamp DESC
LIMIT 10;
```

Should return your recent task chat messages!

## Files Changed

1. desktop2/main/services/SupabaseAdapter.js
2. desktop2/main/ipc/task-chat-handlers.js
3. data/storage/fix-chat-persistence.sql (new)

---

**Status:** Ready to test! Run the SQL migration, restart the app, and test task chat.
