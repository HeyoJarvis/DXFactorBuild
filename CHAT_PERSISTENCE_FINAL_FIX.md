# Task Chat Persistence - FINAL FIX

## The Real Problem

Your database schema is missing the `user_id` column in `conversation_messages`, but the code was trying to insert it.

**Error:**
```
Could not find the 'user_id' column of 'conversation_messages' in the schema cache
```

## What Your Schema Actually Has

```sql
CREATE TABLE public.conversation_messages (
  id uuid,
  session_id uuid,
  message_text text,
  role character varying,
  metadata jsonb,  -- NOT context_used!
  timestamp timestamp with time zone
  -- NO user_id column!
);
```

## The Fix (2 Steps)

### Step 1: Run SQL Migration

Open Supabase → SQL Editor → Paste and run:

```bash
# Copy from:
/Users/jarvis/Code/HeyJarvis/data/storage/fix-chat-persistence-simple.sql
```

This will:
- ✅ Add `user_id` column to `conversation_messages`
- ✅ Backfill existing messages with user_id from their sessions
- ✅ Fix the trigger to update `last_message_at`
- ✅ Add performance index

### Step 2: Restart Your App

```bash
cd /Users/jarvis/Code/HeyJarvis/desktop2
npm run dev
```

## Code Changes Made

### Fixed in SupabaseAdapter.js

**Before:**
```javascript
// Tried to insert user_id (column didn't exist)
// Used wrong column name context_used
.insert([{
  session_id: sessionId,
  message_text: message,
  role: role,
  context_used: metadata  // ❌ Wrong column name
}])
```

**After:**
```javascript
// Now correctly inserts user_id and uses right column
.insert([{
  session_id: sessionId,
  user_id: userId,        // ✅ Added (after migration)
  message_text: message,
  role: role,
  metadata: metadata      // ✅ Correct column name
}])
```

## Test It

1. Run the SQL migration
2. Restart the app
3. Open a task
4. Send a chat message
5. Close and reopen the task
6. **Messages should persist!**

## Verify Success

### Check Logs (Should see):
```
✅ Message saved to session
✅ No more "Could not find the 'user_id' column" errors
```

### Check Database:
```sql
-- Should show your messages
SELECT 
  cm.id,
  cm.user_id,
  cm.role,
  LEFT(cm.message_text, 50) as preview,
  cm.timestamp
FROM conversation_messages cm
JOIN conversation_sessions cs ON cm.session_id = cs.id
WHERE cs.workflow_type = 'task_chat'
ORDER BY cm.timestamp DESC
LIMIT 10;
```

## Files Modified

1. `/Users/jarvis/Code/HeyJarvis/desktop2/main/services/SupabaseAdapter.js`
   - Line 134: Added `user_id` to insert
   - Line 137: Fixed column name `context_used` → `metadata`

2. `/Users/jarvis/Code/HeyJarvis/data/storage/fix-chat-persistence-simple.sql` (NEW)
   - Adds missing `user_id` column
   - Fixes trigger

## Why It Failed Before

1. **Missing column**: `conversation_messages` had no `user_id` column
2. **Wrong column name**: Code used `context_used` but schema has `metadata`
3. **Schema cache**: PostgREST didn't know about the column

## What the Migration Does

```sql
-- 1. Add the missing column
ALTER TABLE conversation_messages
  ADD COLUMN user_id character varying;

-- 2. Fill in existing messages
UPDATE conversation_messages cm
SET user_id = cs.user_id
FROM conversation_sessions cs
WHERE cm.session_id = cs.id;

-- 3. Fix the trigger
CREATE OR REPLACE FUNCTION update_session_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversation_sessions
  SET last_message_at = NEW.timestamp,  -- Was last_activity_at (wrong!)
      message_count = COALESCE(message_count, 0) + 1
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Refresh schema cache so PostgREST knows about new column
NOTIFY pgrst, 'reload schema';
```

---

**Status:** Ready to fix! Just run the SQL migration and restart.
