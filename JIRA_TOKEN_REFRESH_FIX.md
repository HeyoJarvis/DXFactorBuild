# JIRA Token Refresh Fix

## Problem
The JIRA service was failing with error: "Token refresh failed: 400 - client_id may not be blank"

## Root Causes Identified

### 1. Missing Environment Variables
The JIRA OAuth credentials (`JIRA_CLIENT_ID`, `JIRA_CLIENT_SECRET`, `JIRA_REDIRECT_URI`) were commented out in `.env` file.

### 2. JIRAService Initialization Without Credentials
The `JIRAService` was being instantiated without passing OAuth credentials:
```javascript
const jiraService = new JIRAService();  // ❌ No credentials passed
```

When the service tried to refresh tokens, it couldn't because `clientId` and `clientSecret` were undefined.

### 3. Hardcoded User UUID
The `triggerJIRASync` function had a fallback that tried to load a hardcoded user UUID when no user was authenticated, causing sync attempts even when user wasn't logged in.

## Fixes Applied

### 1. Enabled JIRA Credentials in .env
✅ Uncommented the JIRA OAuth configuration:
```bash
JIRA_CLIENT_ID=TjIg9dz6rmiUs30oS1rsUhsvGCRkfcOY
JIRA_CLIENT_SECRET=ATOATqxbZJkVsPSO59V2G9VI3sQIXPO_ocbOANACDL6C__R4OaOXQilmLMyfY_K82jX2002017BB
JIRA_REDIRECT_URI=http://localhost:8890/auth/jira/callback
```

### 2. Updated JIRAService Initialization
✅ Modified all 4 instances in `desktop/main.js` to pass credentials:
```javascript
const jiraService = new JIRAService({
  clientId: process.env.JIRA_CLIENT_ID,
  clientSecret: process.env.JIRA_CLIENT_SECRET,
  redirectUri: process.env.JIRA_REDIRECT_URI
});
```

Locations updated:
- Line ~1121 - `jira:getIssues` handler
- Line ~1246 - `jira:executeCommand` handler  
- Line ~1394 - `jira:syncTasks` handler
- Line ~1886 - `triggerJIRASync` function

### 3. Removed Hardcoded User Fallback
✅ Simplified `triggerJIRASync` to properly return early if no user is authenticated:
```javascript
const triggerJIRASync = async () => {
  // Check if user is authenticated
  if (!currentUser) {
    console.log('⚠️ JIRA sync skipped: No user authenticated');
    return { success: false, error: 'No user authenticated' };
  }
  // ... rest of sync logic
};
```

## Expected Behavior After Fix

1. **No More Token Refresh Errors**: The JIRA service now has valid OAuth credentials for token refresh operations.

2. **Graceful Handling of Unauthenticated State**: If no user is authenticated, JIRA sync will be skipped with a clear log message instead of trying to load a hardcoded user.

3. **Proper Token Refresh Flow**: When JIRA tokens expire, the service can now properly refresh them using the OAuth client credentials.

## Testing

### Running with Developer Role (includes JIRA)

To test the JIRA integration with all fixes applied:

```bash
npm run dev:desktop:developer
```

This command:
- Sets `ROLE_OVERRIDE=developer` to activate developer-specific features
- Loads all environment variables including JIRA credentials from `.env`
- Starts the desktop app with JIRA sync enabled

### Verification Steps

1. **Start the app** using `npm run dev:desktop:developer`
2. **Sign in with Slack** (if not already authenticated)
3. **Connect JIRA account** via the integrations settings in the UI
4. **Verify automatic sync** - JIRA will sync after 10 seconds, then every 10 minutes
5. **Check logs** for successful sync messages:
   ```
   ✅ Initial JIRA sync complete: X created, Y updated
   ```
6. **Test token refresh** - Wait for token expiry or manually trigger sync to verify automatic refresh works

## How JIRA Auto-Sync Works

When running with `dev:desktop:developer`, the JIRA integration automatically:

1. **Initial Sync**: Runs 10 seconds after app startup (if user is authenticated and has JIRA connected)
2. **Periodic Sync**: Runs every 10 minutes to fetch new/updated JIRA issues
3. **Creates Tasks**: Automatically creates tasks in HeyJarvis for assigned JIRA issues
4. **Updates Tasks**: Updates existing tasks when JIRA issues change
5. **Token Refresh**: Automatically refreshes OAuth tokens when they expire

The sync only runs for users with:
- Developer or Admin role
- Authenticated JIRA connection
- Valid OAuth tokens stored in `users.integration_settings.jira`

## Related Files Modified

- `.env` - Uncommented JIRA credentials
- `desktop/main.js` - Updated JIRAService initialization (4 places) and triggerJIRASync logic
- `core/integrations/jira-service.js` - No changes needed (already had proper token refresh logic)
- `desktop/package.json` - Already configured with `dev:developer` script

