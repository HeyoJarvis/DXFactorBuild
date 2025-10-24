# Team Chat Authentication Fix

## Problem
Initial implementation tried to use `dbAdapter.supabase.auth.getSession()` which fails because:
- Supabase auth sessions don't persist on the main process
- The desktop2 app uses `AuthService` to manage authentication
- User ID must come from `services.auth.currentUser.id`

## Error Message
```
Failed to load teams: User not authenticated
```

## Solution Applied

### Changed Authentication Pattern
**Before:**
```javascript
const { data: sessionData, error: sessionError } = await dbAdapter.supabase.auth.getSession();
if (sessionError || !sessionData.session) {
  throw new Error('User not authenticated');
}
const userId = sessionData.session.user.id;
```

**After:**
```javascript
const userId = services.auth?.currentUser?.id;

if (!userId) {
  logger.warn('Cannot load teams: No authenticated user');
  return { success: false, error: 'User not authenticated' };
}
```

### Changed Team Loading Strategy
**Before:**
- Tried to query `app_team_members` and `app_teams` tables
- These were mock tables from `extra_feature_desktop`

**After:**
- Uses `get_user_teams` RPC function (same as onboarding flow)
- Queries `teams` and `team_members` tables from login flow
- Consistent with existing team-handlers.js

### Updated Tables
**team_members** (not app_team_members):
- Used for finding team membership
- Includes `is_active` flag to filter active members

**teams** (not app_teams):
- Main teams table from login flow
- Has proper relationships and RPC functions

## Files Changed

### [team-chat-handlers.js](desktop2/main/ipc/team-chat-handlers.js)
1. **Line 19-24**: Changed `team-chat:load-teams` handler to use `services.auth.currentUser.id`
2. **Line 27-28**: Changed to use `get_user_teams` RPC function
3. **Line 55-60**: Changed `team-chat:get-history` handler authentication
4. **Line 145-150**: Changed `team-chat:send-message` handler authentication
5. **Line 255-258**: Changed `buildTeamContext` to use `team_members` table (not `app_team_members`)

## Testing Instructions

1. **Restart the app** to reload the handlers:
```bash
cd /Users/jarvis/Code/HeyJarvis/desktop2
npm run dev
```

2. **Verify user is authenticated**:
- Check that you're logged in (should see user profile in tab bar)
- User must have teams created during onboarding

3. **Navigate to Team Chat**:
- Click "Team Chat" tab
- Check console for: `📋 Loading teams for user`
- Should see: `✅ Loaded N teams`

4. **Expected Logs**:
```
📋 Loading teams for user
✅ Loaded 2 teams (teams: ["Engineering", "Sales"])
```

## Why This Approach Works

1. **Consistent with Desktop2 Architecture**:
   - All handlers use `services.auth.currentUser.id`
   - See: task-handlers.js:20, task-handlers.js:62, team-handlers.js:47

2. **Reuses Existing Infrastructure**:
   - RPC function `get_user_teams` already tested
   - Same tables/relationships as onboarding flow

3. **Proper Error Handling**:
   - Returns `{ success: false, error: '...' }` instead of throwing
   - Allows frontend to show proper error messages

## Next Steps

If you still see "User not authenticated":
1. Check that `services.auth.currentUser` is populated
2. Verify user completed onboarding and joined teams
3. Check database has records in `teams` and `team_members` tables
4. Look for auth initialization logs in main process console

## Alternative: Create Mock Team

If no teams exist, create one via Settings or add manually:
```sql
-- Create a team
INSERT INTO teams (name, slug, created_by, subscription_tier, subscription_status)
VALUES ('My Team', 'my-team', '<user-id>', 'trial', 'active')
RETURNING id;

-- Add user to team
SELECT add_user_to_team('<user-id>', '<team-id>', 'owner', NULL);
```
