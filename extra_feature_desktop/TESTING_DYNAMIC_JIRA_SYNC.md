# Testing Dynamic JIRA Sync

## Quick Test (In the App)

### Test Scenario: Delete a JIRA Issue

1. **Open JIRA Tasks page** in the app
   - Navigate to "JIRA Tasks" from sidebar
   - Note the current issues displayed

2. **Delete an issue in JIRA**
   - Go to your JIRA workspace in browser
   - Delete or archive an issue that appears in the app
   - Example: Delete issue `PROJ-123`

3. **Sync in the app**
   - Click "🔄 Sync Now" button
   - Wait for sync to complete

4. **Verify deletion**
   - ✅ The deleted issue should **disappear** from the list
   - ✅ Stats should update (total count decreases)
   - ✅ Other issues remain unchanged

### Expected Behavior

**Before Sync:**
```
📋 JIRA Tasks

Total: 10  Open: 5  In Progress: 3  Done: 2

PROJ-123 - Fix login bug
PROJ-124 - Add dark mode
PROJ-125 - Update docs
...
```

**After Deleting PROJ-123 in JIRA and Syncing:**
```
📋 JIRA Tasks

Total: 9  Open: 4  In Progress: 3  Done: 2

PROJ-124 - Add dark mode
PROJ-125 - Update docs
...
```

## Test with Script

### Prerequisites

1. Set your user ID in `.env`:
   ```bash
   TEST_USER_ID=your-user-id-here
   ```

2. Ensure JIRA is connected in the app

### Run Test

```bash
cd /home/sdalal/test/BeachBaby/extra_feature_desktop
node test-dynamic-jira-sync.js
```

### Sample Output

```
🧪 Testing Dynamic JIRA Sync

📊 Step 1: Get current JIRA issues in database

Found 10 JIRA issues in database
Issues: PROJ-123, PROJ-124, PROJ-125, ...

🔄 Step 2: Fetch from JIRA API (with dynamic cleanup)

✅ Synced 9 issues from JIRA
Issues: PROJ-124, PROJ-125, ...

📊 Step 3: Get updated database state

Now have 9 JIRA issues in database
Issues: PROJ-124, PROJ-125, ...

📈 Summary:

✅ Kept:    9 issues
➕ Added:   0 issues
🗑️  Deleted: 1 issues

🗑️  Deleted issues:
   - PROJ-123: Fix login bug

✅ Dynamic sync test complete!
```

## Advanced Testing

### Test Multiple Deletions

1. Delete 3-5 JIRA issues
2. Sync in app
3. Verify all deleted issues disappear

### Test Time Windows

The sync respects time windows. To test:

```javascript
// In app, modify sync call:
await window.electronAPI.sync.fetchJIRA(userId, { 
  days: 7  // Only sync last 7 days
});

// Issues older than 7 days won't be deleted even if missing from JIRA
```

### Test Edge Cases

#### Case 1: JIRA Connection Lost
- Disconnect JIRA in Settings
- Try sync → Should show connection error
- No deletions should occur

#### Case 2: Empty JIRA Response
- If JIRA returns no issues (rare)
- App should NOT delete all issues
- Only issues in time window are considered

#### Case 3: Partial Sync Failure
- If cleanup fails, sync still succeeds
- Check logs for error messages
- Next sync will retry cleanup

## Monitoring

### Check Logs

**Desktop App Logs:**
```bash
tail -f logs/task-code-intelligence.log
```

**Look for:**
```json
{
  "message": "Deleting removed JIRA issues",
  "userId": "...",
  "count": 3,
  "issues": ["PROJ-123", "PROJ-124", "PROJ-125"]
}
```

### Database Verification

**Check in Supabase:**
```sql
-- Count JIRA issues
SELECT COUNT(*) 
FROM team_updates 
WHERE update_type = 'jira_issue' 
AND user_id = 'your-user-id';

-- List recent JIRA issues
SELECT external_key, title, status, updated_at
FROM team_updates
WHERE update_type = 'jira_issue' 
AND user_id = 'your-user-id'
ORDER BY updated_at DESC
LIMIT 20;
```

## Troubleshooting

### Issue: Deleted issues still showing

**Possible causes:**
1. Sync hasn't run yet → Click "Sync Now"
2. Cache in UI → Refresh the page (F5)
3. Issue outside time window → Increase days parameter
4. Cleanup failed → Check logs for errors

**Solution:**
```bash
# Force sync
node test-dynamic-jira-sync.js

# Check logs
tail -20 logs/task-code-intelligence.log
```

### Issue: All issues deleted

**Possible causes:**
1. JIRA disconnected → Reconnect in Settings
2. Permission issue → Check JIRA OAuth scopes
3. Query returned empty → Check JQL in logs

**Solution:**
```bash
# Check JIRA connection
SELECT * FROM team_sync_integrations 
WHERE service_name = 'jira' 
AND user_id = 'your-user-id';

# Reconnect JIRA in app Settings
```

### Issue: Cleanup taking too long

**Normal:** 100-500ms for typical workloads

**If slow (>5s):**
1. Check database indexes
2. Reduce time window (use 7 days instead of 30)
3. Check Supabase performance metrics

## Migration for Existing Installations

If you had issues before this update:

### Step 1: Add content_text Column

In Supabase SQL Editor:
```sql
\i migrations/003_add_content_text_column.sql
```

### Step 2: Restart App

```bash
# Stop app
pkill -f "extra_feature_desktop"

# Start app
npm start
```

### Step 3: Force Full Sync

1. Open JIRA Tasks
2. Click "Sync Now"
3. Wait for completion
4. Verify all issues have content_text

## Performance Benchmarks

- **Small workspace (10-50 issues):** ~100-200ms cleanup
- **Medium workspace (50-200 issues):** ~200-500ms cleanup
- **Large workspace (200+ issues):** ~500-1000ms cleanup

## Summary Checklist

Test that:
- ✅ Deleted JIRA issues disappear after sync
- ✅ Remaining issues stay unchanged
- ✅ Stats update correctly
- ✅ Search/filter works with deleted issues gone
- ✅ No errors in logs
- ✅ UI refreshes automatically
- ✅ Background sync (every 2 min) works

## Questions?

Check the main documentation: `JIRA_DYNAMIC_SYNC_COMPLETE.md`

