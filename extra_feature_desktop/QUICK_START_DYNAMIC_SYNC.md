# Quick Start: Dynamic JIRA Sync

## What's New? 🎉

JIRA is now **fully dynamic**! When you delete issues in JIRA, they automatically disappear from the app.

## How to Use

### No Setup Required!

The feature works automatically. Just use the app normally:

1. **Sync JIRA** - Click "🔄 Sync Now" in JIRA Tasks page
2. **Delete issues in JIRA** - Remove/archive issues in your JIRA workspace
3. **Sync again** - Deleted issues disappear automatically ✨

### That's it! 

## Example Workflow

```
Step 1: You have 10 JIRA issues in the app
┌─────────────────────────┐
│ PROJ-123 - Bug fix     │
│ PROJ-124 - New feature │
│ PROJ-125 - Update docs │
│ ... 7 more issues       │
└─────────────────────────┘

Step 2: Delete PROJ-123 in JIRA workspace

Step 3: Click "Sync Now" in app

Step 4: PROJ-123 automatically disappears!
┌─────────────────────────┐
│ PROJ-124 - New feature │
│ PROJ-125 - Update docs │
│ ... 7 more issues       │
└─────────────────────────┘

✅ Now you have 9 issues
```

## Background Sync

The app also syncs automatically every **2 minutes** in the background, so deleted issues will disappear even if you don't manually sync.

## Verify It Works

### Quick Test:
1. Open JIRA Tasks page
2. Note a specific issue (e.g., "PROJ-123")
3. Go to JIRA and delete that issue
4. Return to app and click "Sync Now"
5. Issue should be gone! ✅

## Migration (One-Time)

If you installed the app before this update:

### Step 1: Run Database Migration

In Supabase SQL Editor, run:
```sql
\i migrations/003_add_content_text_column.sql
```

Or manually:
```sql
ALTER TABLE team_updates ADD COLUMN content_text TEXT;
```

### Step 2: Restart App

### Step 3: Force Sync

Click "Sync Now" to populate data for all issues.

## What Gets Deleted?

### ✅ Automatically Deleted:
- Issues deleted in JIRA
- Issues moved to archived projects
- Issues that no longer match your permissions

### ❌ NOT Deleted:
- Old issues outside time window (default: 30 days)
- Issues in other time ranges
- Completed issues (unless deleted in JIRA)

## Time Windows

By default, sync looks at the **last 30 days** of JIRA activity.

Issues older than 30 days:
- Stay in database unless explicitly deleted
- Don't affect cleanup logic
- Can be viewed in UI

## Troubleshooting

### Issue still showing after deletion?

**Try:**
1. Click "Sync Now" (manual sync)
2. Wait 2 minutes (background sync)
3. Refresh page (F5)
4. Check JIRA - is it really deleted?

### All issues disappeared?

**Possible causes:**
1. JIRA disconnected → Reconnect in Settings
2. Permission changed → Check JIRA access
3. Token expired → Reconnect in Settings

**Fix:** Click "Connect JIRA" in Settings

### Sync taking too long?

**Normal:** 2-5 seconds including cleanup

**If > 10 seconds:**
- Check internet connection
- Check Supabase status
- Try again in a few minutes

## Technical Details

For developers and power users:

### Architecture
```
User Clicks Sync
     ↓
Fetch from JIRA API
     ↓
Save/Update in Database
     ↓
Compare with Database
     ↓
Delete Orphaned Issues
     ↓
UI Auto-Refreshes
```

### Logs

Check logs for deletion events:
```bash
tail -f logs/task-code-intelligence.log | grep "Deleting removed"
```

### Database Query

Check JIRA issues in Supabase:
```sql
SELECT external_key, title, updated_at 
FROM team_updates 
WHERE update_type = 'jira_issue'
ORDER BY updated_at DESC;
```

## FAQ

**Q: Do I need to do anything?**  
A: No! It works automatically.

**Q: Will old data be deleted?**  
A: Only deleted JIRA issues within the sync time window.

**Q: What if sync fails?**  
A: Cleanup is safe - if it fails, next sync retries.

**Q: Can I undo deletions?**  
A: Sync reflects JIRA state. Restore in JIRA to restore in app.

**Q: Does this affect performance?**  
A: Negligible impact (~50-100ms added to sync).

**Q: What about GitHub?**  
A: GitHub updates work the same way (coming soon for dynamic deletion).

## Support

- **Full Documentation:** `JIRA_DYNAMIC_SYNC_COMPLETE.md`
- **Testing Guide:** `TESTING_DYNAMIC_JIRA_SYNC.md`
- **Test Script:** `node test-dynamic-jira-sync.js`

## Summary

✅ **It just works!**  
✅ **No configuration needed**  
✅ **Automatic cleanup**  
✅ **Always up-to-date**  

Enjoy your dynamically-synced JIRA tasks! 🚀

