# Teams Data Assignment Fix

## Issue

When trying to assign data or view team context, the app was failing with:

```
"error":"column app_team_repositories.app_team_id does not exist"
```

## Root Cause

The `app_team_repositories` table has a column called `team_id`, but the code was trying to query it using `app_team_id`. 

This happened because:
- `team_meetings` and `team_updates` use `app_team_id` (to differentiate from any old `team_id` column)
- `app_team_repositories` is a new table, so it just uses `team_id`

## Fix Applied

Updated `TeamSyncSupabaseAdapter.js` in the `getTeamContext` method:

**Before:**
```javascript
const repositoriesQuery = this.supabase
  .from('app_team_repositories')
  .select('*')
  .eq('app_team_id', teamId);  // ❌ Wrong column name
```

**After:**
```javascript
const repositoriesQuery = this.supabase
  .from('app_team_repositories')
  .select('*')
  .eq('team_id', teamId);  // ✅ Correct column name
```

## Testing

After this fix, you should be able to:

1. ✅ Assign meetings to teams
2. ✅ Assign tasks to teams  
3. ✅ Assign repositories to teams
4. ✅ View team context (meetings, tasks, repos)
5. ✅ Ask questions to teams with proper context

## No Database Changes Required

This was purely a code fix - the database schema is correct. Just restart your app to apply the fix.

```bash
# Restart the app
pkill -f "electron"
cd /home/sdalal/test/BeachBaby/extra_feature_desktop
npm start
```

## Summary

- ✅ Code fix applied
- ✅ No database migration needed
- ✅ Restart app to apply
- ✅ Data assignment should now work perfectly!

