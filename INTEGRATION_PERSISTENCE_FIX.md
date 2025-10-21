# Integration Persistence Fix - Microsoft & Google Auth

## Problem

When users connected Microsoft Teams or Google Workspace through the Settings page, the integrations would show as connected. However, after logging out or closing and reopening the app, these integrations would appear as disconnected, even though the user had previously authenticated.

### Root Cause

The issue was in the authentication flow in `desktop2/main/ipc/mission-control-handlers.js`. When users authenticated with Microsoft or Google:

1. ✅ The OAuth flow completed successfully
2. ✅ The service instances were initialized in memory (`microsoftService.graphService`, `googleService.gmailService`)
3. ❌ **The tokens were NOT being saved to the database properly**

The problem was that the IPC handlers were trying to access `authResult.accessToken` and `authResult.refreshToken`, but these properties **don't exist** in the return value from the OAuth handlers.

### What the OAuth Handlers Actually Return

**Microsoft (`MicrosoftGraphService.authenticateWithCode()`):**
```javascript
{
  success: true,
  account: response.account,  // { username, homeAccountId, ... }
  expiresOn: Date             // Token expiry date
}
```

**Google (`GoogleGmailService.authenticateWithCode()`):**
```javascript
{
  success: true,
  account: {
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture
  },
  expiresOn: Date             // Token expiry date
}
```

The actual tokens (`accessToken`, `refreshToken`) are stored **internally** in the service instances, not returned in the result object.

## The Fix

### 1. Updated Microsoft Graph Service (`core/integrations/microsoft-graph-service.js`)

Added storage of the refresh token in the service instance:

```javascript
async authenticateWithCode(code) {
  const response = await this.msalClient.acquireTokenByCode(tokenRequest);
  
  this.accessToken = response.accessToken;
  this.refreshToken = response.refreshToken || null; // NEW: Store refresh token
  this.tokenExpiry = response.expiresOn;
  this.account = response.account;                    // NEW: Store account info
  
  // ... rest of the method
}
```

### 2. Updated Microsoft Authentication Handler (`desktop2/main/ipc/mission-control-handlers.js`)

Changed from trying to access non-existent properties to getting tokens from the service instance:

**Before (BROKEN):**
```javascript
integrationSettings.microsoft = {
  authenticated: true,
  account: authResult.account?.username,
  access_token: authResult.accessToken,      // ❌ undefined!
  refresh_token: authResult.refreshToken,    // ❌ undefined!
  token_expiry: authResult.expiresOn,
  // ...
};
```

**After (FIXED):**
```javascript
// 🔥 Get tokens from the Graph Service instance (MSAL stores them internally)
const graphService = microsoftOAuthHandler.graphService;
const accessToken = graphService.accessToken;
const refreshToken = graphService.refreshToken || null;

integrationSettings.microsoft = {
  authenticated: true,
  account: authResult.account?.username,
  access_token: accessToken,                 // ✅ From service instance
  refresh_token: refreshToken,               // ✅ From service instance
  token_expiry: authResult.expiresOn,
  connected_at: existingMicrosoft.connected_at || new Date().toISOString(),
  last_authenticated_at: new Date().toISOString(),
  expires_on: authResult.expiresOn
};
```

### 3. Updated Google Authentication Handler

Applied the same fix for Google:

```javascript
// 🔥 Get tokens from the Gmail Service instance (OAuth2Client stores them internally)
const gmailService = googleOAuthHandler.gmailService;
const accessToken = gmailService.accessToken;
const refreshToken = gmailService.refreshToken;

integrationSettings.google = {
  authenticated: true,
  email: authResult.account?.email,
  name: authResult.account?.name,
  access_token: accessToken,                 // ✅ From service instance
  refresh_token: refreshToken,               // ✅ From service instance
  token_expiry: authResult.expiresOn,
  connected_at: existingGoogle.connected_at || new Date().toISOString(),
  last_authenticated_at: new Date().toISOString(),
  expires_on: authResult.expiresOn
};
```

### 4. Added Comprehensive Logging

Added detailed logging to track token persistence:

```javascript
logger.info('💾 Saving Microsoft tokens to database', {
  userId,
  account: authResult.account?.username,
  hasAccessToken: !!accessToken,
  hasRefreshToken: !!refreshToken,
  expiresOn: authResult.expiresOn
});
```

## How It Works Now

### Connection Flow

1. **User clicks "Connect" on Microsoft/Google in Settings**
2. **OAuth flow starts** → Opens browser for authentication
3. **User authenticates** → Microsoft/Google redirects back with auth code
4. **Token exchange** → Service exchanges code for tokens
5. **Tokens stored in service instance** → `graphService.accessToken`, `graphService.refreshToken`
6. **🔥 NEW: Tokens saved to database** → Extracted from service instance and saved to `users.integration_settings`
7. **Service marked as initialized** → `microsoftService.isInitialized = true`

### Persistence Flow (After Logout/Restart)

1. **App starts** → `autoInitializeUserIntegrations()` runs
2. **Checks database** → Looks for tokens in `users.integration_settings.microsoft`
3. **Tokens found** → Calls `microsoftService.initialize(userId)`
4. **Service initializes** → Creates new service instance with stored tokens
5. **✅ Integration shows as connected** → `checkConnection` returns `connected: true`

### Settings Page Check

When Settings page loads, it calls `microsoft:checkConnection`:

```javascript
ipcMain.handle('microsoft:checkConnection', async () => {
  // 1. Check if service is already initialized in memory
  if (microsoftService?.isInitialized && microsoftService?.graphService) {
    return { success: true, connected: true, source: 'memory' };
  }
  
  // 2. Check database for stored tokens
  const microsoftSettings = userData?.integration_settings?.microsoft;
  const hasTokens = microsoftSettings?.access_token && microsoftSettings?.authenticated === true;
  
  // 3. If tokens exist, auto-initialize the service
  if (hasTokens) {
    const initResult = await microsoftService.initialize(userId);
    return {
      success: true,
      connected: initResult.connected,
      source: 'auto-init'
    };
  }
  
  // 4. No tokens = never connected
  return { success: true, connected: false, source: 'no-tokens' };
});
```

## Testing

### Test 1: Fresh Connection
1. Open Settings
2. Click "Connect" on Microsoft Teams
3. Complete OAuth flow
4. ✅ Should show as "Connected & Active"
5. Check database: `users.integration_settings.microsoft` should have `access_token` and `refresh_token`

### Test 2: Persistence After Logout
1. With Microsoft connected, click Logout
2. Log back in with same account
3. Open Settings
4. ✅ Microsoft should still show as "Connected & Active"

### Test 3: Persistence After App Restart
1. With Microsoft connected, close the app
2. Reopen the app
3. Log in
4. Open Settings
5. ✅ Microsoft should still show as "Connected & Active"

### Test 4: Google Workspace
Repeat Tests 1-3 for Google Workspace integration.

## Database Schema

Tokens are stored in the `users` table under `integration_settings` JSONB column:

```javascript
{
  "microsoft": {
    "authenticated": true,
    "account": "user@example.com",
    "access_token": "eyJ0eXAiOiJKV1QiLCJub...",
    "refresh_token": "0.AXoA...",
    "token_expiry": "2025-10-20T12:00:00.000Z",
    "connected_at": "2025-10-20T10:00:00.000Z",
    "last_authenticated_at": "2025-10-20T10:00:00.000Z",
    "expires_on": "2025-10-20T12:00:00.000Z"
  },
  "google": {
    "authenticated": true,
    "email": "user@gmail.com",
    "name": "User Name",
    "access_token": "ya29.a0AfB_by...",
    "refresh_token": "1//0gZ...",
    "token_expiry": "2025-10-20T12:00:00.000Z",
    "connected_at": "2025-10-20T10:00:00.000Z",
    "last_authenticated_at": "2025-10-20T10:00:00.000Z",
    "expires_on": "2025-10-20T12:00:00.000Z"
  }
}
```

## Files Modified

1. **`core/integrations/microsoft-graph-service.js`**
   - Added `this.refreshToken` storage
   - Added `this.account` storage
   - Enhanced logging

2. **`desktop2/main/ipc/mission-control-handlers.js`**
   - Fixed `microsoft:authenticate` to get tokens from service instance
   - Fixed `google:authenticate` to get tokens from service instance
   - Added comprehensive logging
   - Preserved existing settings when updating

## Notes

- **MSAL Token Cache**: Microsoft's MSAL library manages refresh tokens internally in a token cache. The refresh token might not always be exposed, but MSAL will handle token refresh automatically.
- **Google OAuth2Client**: Google's OAuth2Client exposes both access and refresh tokens directly.
- **Token Expiry**: Both services handle token refresh automatically when tokens expire.
- **Backward Compatibility**: The fix preserves existing integration settings when updating, so users won't lose other metadata.

## Success Criteria

✅ Tokens are saved to database after OAuth flow completes
✅ Integrations persist after logout
✅ Integrations persist after app restart
✅ Settings page shows correct connection status
✅ Services can be used immediately after auto-initialization
✅ Comprehensive logging for debugging

---

**Status**: ✅ FIXED
**Date**: October 20, 2025
**Impact**: Microsoft Teams and Google Workspace integrations now persist correctly across sessions

