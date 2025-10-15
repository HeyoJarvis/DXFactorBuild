# JIRA Authentication Fix

## Issue
The "Connect JIRA" button was failing with error:
```
TypeError: jiraOAuthHandler.authenticate is not a function
```

## Root Cause
The JIRA OAuth handler method is called `startAuthFlow()`, not `authenticate()`. Additionally, the response structure from `startAuthFlow()` returns tokens directly, not wrapped in a `tokens` object.

## Fix Applied

### File: `desktop2/main/ipc/jira-handlers.js`

**Changed:**
```javascript
// Before
const authResult = await jiraOAuthHandler.authenticate();
integrationSettings.jira = {
  access_token: authResult.tokens.access_token,
  refresh_token: authResult.tokens.refresh_token,
  ...
};

// After
const authResult = await jiraOAuthHandler.startAuthFlow();
integrationSettings.jira = {
  access_token: authResult.access_token,
  refresh_token: authResult.refresh_token,
  ...
};
```

## Response Structure

### `startAuthFlow()` returns:
```javascript
{
  access_token: '...',
  refresh_token: '...',
  expires_in: 3600,
  cloud_id: '...',
  site_url: 'https://your-domain.atlassian.net'
}
```

## Testing
1. Click "Connect JIRA" button
2. Browser should open with Atlassian OAuth page
3. Authorize the app
4. Browser should show success message
5. Return to app - should show connected status
6. Issues should load automatically

## Status
✅ **Fixed and Ready for Testing**

The app is now running with the corrected OAuth flow.

