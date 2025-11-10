# Debug Confluence 401 Error

## Issue
You re-authenticated with JIRA/Confluence but still getting 401 errors when fetching Confluence pages.

## Root Cause
The Confluence service is using the OAuth token from the database (`integration_settings.jira.access_token`), but this token might:

1. **Not have the new Confluence scopes** (even after re-auth)
2. **Be cached** in the database from before re-authentication
3. **Need to be refreshed** using the refresh token

## Where Tokens Come From

```javascript
// desktop2/main/ipc/reporting-handlers.js (lines 22-32)
const { data: userData } = await services.dbAdapter.supabase
  .from('users')
  .select('integration_settings')
  .eq('id', userId)
  .single();

const jiraSettings = userData?.integration_settings?.jira;

// Lines 56-60
confluenceService.setTokens({
  accessToken: jiraSettings.access_token,  // ← This token
  cloudId: jiraSettings.cloud_id,
  siteUrl: jiraSettings.site_url
});
```

## Solution Options

### Option 1: Force Token Refresh (Recommended)

The token might be expired or cached. Force a refresh:

1. **Disconnect JIRA completely** (this should clear the database tokens)
2. **Restart the app** (to clear any in-memory caches)
3. **Reconnect JIRA** (this will store fresh tokens with new scopes)
4. **Test again**

### Option 2: Check Database Directly

Check what's actually in the database:

```sql
-- In Supabase SQL Editor
SELECT 
  id,
  email,
  integration_settings->'jira'->>'access_token' as jira_token,
  integration_settings->'jira'->>'cloud_id' as cloud_id,
  integration_settings->'jira'->>'site_url' as site_url
FROM users
WHERE email = 'your_email@company.com';
```

The `access_token` should be a JWT. You can decode it at https://jwt.io to see what scopes it has.

### Option 3: Manual Token Refresh

Add a token refresh mechanism. The JIRA service has a refresh token that can get a new access token:

```javascript
// In desktop2/main/ipc/reporting-handlers.js

// Before setting Confluence tokens, refresh the JIRA token
if (jiraSettings.refresh_token) {
  try {
    const newTokens = await jiraCore.refreshAccessToken(jiraSettings.refresh_token);
    
    // Update database with new tokens
    await services.dbAdapter.supabase
      .from('users')
      .update({
        integration_settings: {
          ...userData.integration_settings,
          jira: {
            ...jiraSettings,
            access_token: newTokens.access_token,
            refresh_token: newTokens.refresh_token
          }
        }
      })
      .eq('id', userId);
    
    // Use new token for Confluence
    confluenceService.setTokens({
      accessToken: newTokens.access_token,
      cloudId: jiraSettings.cloud_id,
      siteUrl: jiraSettings.site_url
    });
  } catch (refreshError) {
    logger.error('Token refresh failed', { error: refreshError.message });
  }
}
```

### Option 4: Check Atlassian App Permissions

Your Atlassian OAuth app might not have Confluence API enabled:

1. Go to: https://developer.atlassian.com/console/myapps/
2. Find your app (Client ID: `V8ULacCHZm4mkg98zDY0iuUVKMMkrtD2`)
3. Go to **"Permissions"** tab
4. Ensure these are enabled:
   - ✅ **Confluence API**
   - ✅ **Confluence platform REST API**
5. Under **"Confluence API"**, ensure:
   - ✅ Read content
   - ✅ Read space information
6. Click **"Save changes"**
7. Re-authenticate in the app

## Quick Test

Add logging to see what token is being used:

```javascript
// In core/integrations/confluence-service.js, line 88

this.logger.info('Using access token', {
  tokenPreview: this.accessToken?.substring(0, 20) + '...',
  tokenLength: this.accessToken?.length,
  cloudId: this.cloudId
});
```

Then check the logs to see if:
- Token exists
- CloudId is correct
- Token looks valid (should be ~500+ characters)

## Expected vs Actual

### Expected (working):
```json
{"message":"Making Confluence API request","url":"https://api.atlassian.com/ex/confluence/.../wiki/rest/api/content/3375681"}
{"message":"Confluence page fetched","title":"Product Requirements"}
```

### Actual (your error):
```json
{"error":"Unauthorized; scope does not match","status":401}
```

This means the token **exists** but doesn't have the right **scopes**.

## Most Likely Solution

The issue is probably that your Atlassian OAuth app doesn't have Confluence API permissions enabled. Check Option 4 above.

After enabling Confluence API in your Atlassian app:
1. Disconnect JIRA in HeyJarvis
2. Reconnect JIRA
3. You should see Confluence permissions in the OAuth consent screen
4. Test again

## Verify It Worked

After fixing, you should see these logs:

```json
{"message":"Fetching page","pageId":"3375681"}
{"message":"Confluence page fetched","title":"...","contentLength":2456}
{"message":"Summarizing Confluence page with AI"}
{"message":"AI summary generated","summaryLength":245}
{"message":"Confluence content fetched and summarized","total":1,"withContent":1}
```

And in the report:
```
1. 📎 Product Requirements Document ✨
   https://...
   
   Summary:
   [AI-generated summary here]
```

