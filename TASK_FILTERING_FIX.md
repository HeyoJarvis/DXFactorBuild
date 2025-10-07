# Task Filtering Issue - Diagnosis & Fix

## The Problem

Tasks are being created successfully, but they're not showing up in your task list.

**Symptoms:**
- Task created for Shail (`U09GEFMKGE7`) ✅
- Task has `assignor: U09GJSJLDNW` (you) ✅  
- Task has `assignee: U09GEFMKGE7` (Shail) ✅
- But when you query tasks: `totalTasks: 0` ❌

## Root Cause

The Supabase query in `getUserTasks()` is returning 0 results BEFORE the filtering logic runs. This suggests one of:

1. **Wrong Supabase key**: Using `anon` key instead of `service_role` key
2. **RLS blocking**: Row Level Security is preventing access
3. **Query issue**: The query itself has a problem

## Quick Fix

### Option 1: Verify Supabase Key (Most Likely)

Check `/Users/jarvis/Code/HeyJarvis/data/storage/supabase-client.js`:

```javascript
// Should be using SERVICE_ROLE key, not ANON key
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // ← This one!
  // NOT: process.env.SUPABASE_ANON_KEY
);
```

### Option 2: Add User-Level RLS Policy

If using anon key, add this SQL policy:

```sql
-- Allow users to see tasks where they're involved
CREATE POLICY "Users can see their tasks" 
  ON conversation_sessions 
  FOR SELECT 
  TO authenticated
  USING (
    workflow_type = 'task' AND (
      user_id = auth.uid() OR
      (workflow_metadata->>'assignor')::text IN (
        SELECT slack_user_id FROM users WHERE id = auth.uid()
      ) OR
      (workflow_metadata->>'assignee')::text IN (
        SELECT slack_user_id FROM users WHERE id = auth.uid()
      )
    )
  );
```

### Option 3: Debug the Query

Run this SQL directly in Supabase to see what's there:

```sql
SELECT 
  id,
  session_title,
  user_id,
  workflow_type,
  workflow_metadata->>'assignor' as assignor,
  workflow_metadata->>'assignee' as assignee
FROM conversation_sessions
WHERE workflow_type = 'task'
ORDER BY started_at DESC
LIMIT 10;
```

This will show you:
- Are tasks being created?
- What user_id do they have?
- What assignor/assignee values?

## Expected Behavior

When you query tasks with your user ID (`01108a10-086f-4d7a-8de2-f29d8a0cadc5`):

1. Query fetches ALL tasks with `workflow_type='task'`
2. Filter to tasks where:
   - `user_id = your_supabase_id` OR
   - `assignor = your_slack_id` (U09GJSJLDNW) OR
   - `assignee = your_slack_id` (U09GJSJLDNW)
3. Apply view filter (`assigned_to_me` vs `assigned_by_me`)

## Next Steps

1. **Check which Supabase key is being used** in `supabase-client.js`
2. **Restart HeyJarvis** with debug logging
3. **Send a test Slack message** to create a task
4. **Check terminal logs** for "Raw query result"
5. **Run the SQL query** in Supabase dashboard to verify tasks exist

---

**Most likely fix**: Change to `SUPABASE_SERVICE_ROLE_KEY` in the client initialization.
