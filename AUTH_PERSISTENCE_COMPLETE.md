# Authentication Persistence - Complete Fix

## Problem
After logging in and connecting Google/Microsoft integrations, users had to re-authenticate every time they:
- Logged out and back in
- Closed and reopened the app

Settings showed integrations as "authenticated" but Mission Control would fail with "Not authenticated or token expired."

## Root Causes Identified

### 1. **EventEmitter Errors (Google & Microsoft)**
Both GoogleService.js and MicrosoftService.js were trying to attach event listeners to OAuth handlers that don't extend EventEmitter, causing crashes during initialization:
```javascript
this.oauthHandler.on('token_refreshed', ...) // ❌ ERROR: .on is not a function
```

### 2. **Tokens Not Passed to Service Constructors**
Both GoogleGmailService and MicrosoftGraphService constructors weren't accepting or using the `accessToken` and `tokenExpiry` from options, even though the wrapper services were trying to pass them.

### 3. **Missing tokenExpiry Parameter**
GoogleService.js and MicrosoftService.js weren't passing `tokenExpiry` to their respective service constructors.

## Files Fixed

### 1. `/desktop2/main/services/GoogleService.js`
**Line 73-79**: Added `tokenExpiry` parameter when creating GoogleGmailService
```javascript
// Initialize Gmail service with existing tokens
this.gmailService = new GoogleGmailService({
  accessToken: googleTokens.access_token,
  refreshToken: googleTokens.refresh_token,
  tokenExpiry: googleTokens.token_expiry,  // ✅ ADDED
  logger: this.logger
});
```

**Line 80-81**: Removed invalid event listener (already done in previous fix)

### 2. `/desktop2/main/services/MicrosoftService.js`
**Line 72-77**: Added `tokenExpiry` parameter when creating MicrosoftGraphService
```javascript
// Initialize Graph service with existing tokens
this.graphService = new MicrosoftGraphService({
  accessToken: microsoftTokens.access_token,
  tokenExpiry: microsoftTokens.token_expiry,  // ✅ ADDED
  logger: this.logger
});
```

**Line 78-79**: Removed invalid event listener (already done in previous fix)

### 3. `/core/integrations/google-gmail-service.js`
**Line 71-96**: Modified constructor to accept and use tokens from options
```javascript
this.accessToken = options.accessToken || null;  // ✅ ADDED
this.refreshToken = options.refreshToken || null;  // ✅ ADDED
this.tokenExpiry = options.tokenExpiry || null;  // ✅ ADDED

// If tokens are provided, set them on the OAuth2Client
if (this.accessToken) {
  this.oauth2Client.setCredentials({
    access_token: this.accessToken,
    refresh_token: this.refreshToken,
    expiry_date: this.tokenExpiry ? new Date(this.tokenExpiry).getTime() : null
  });

  // Initialize Gmail and Calendar APIs
  this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

  this.logger.info('Google Gmail Service initialized with existing tokens', {
    hasAccessToken: !!this.accessToken,
    hasRefreshToken: !!this.refreshToken
  });
} else {
  this.logger.info('Google Gmail Service initialized without tokens', {
    redirectUri: this.options.redirectUri,
    scopes: this.options.scopes.length
  });
}
```

### 4. `/core/integrations/microsoft-graph-service.js`
**Line 97-121**: Modified constructor to accept and use tokens from options
```javascript
this.accessToken = options.accessToken || null;  // ✅ ADDED
this.tokenExpiry = options.tokenExpiry ? new Date(options.tokenExpiry).getTime() : null;  // ✅ ADDED

// If access token is provided, initialize the Graph client
if (this.accessToken) {
  this.graphClient = Client.init({
    authProvider: (done) => {
      done(null, this.accessToken);
    }
  });

  this.logger.info('Microsoft Graph Service initialized with existing tokens', {
    hasAccessToken: !!this.accessToken,
    tokenExpiry: this.tokenExpiry
  });
} else {
  this.logger.info('Microsoft Graph Service initialized without tokens', {
    tenantId: this.options.tenantId,
    scopes: this.options.scopes.length
  });
}
```

## How It Works Now

### On Startup (After Login)
1. **AuthService** logs the user in
2. **auth-handlers.js** checks database for existing integration tokens
3. **GoogleService.initialize()** and **MicrosoftService.initialize()** are called
4. Each service:
   - Fetches tokens from database
   - Creates OAuth handler with tokens
   - Creates core service (GoogleGmailService/MicrosoftGraphService) **WITH tokens**
   - Core service immediately initializes APIs with authenticated clients

### When Mission Control Requests Data
1. Mission Control calls `google:getUpcomingEvents` or `microsoft:getUpcomingEvents`
2. mission-control-handlers.js checks if service is initialized
3. If yes, calls `googleService.gmailService.getUpcomingEvents()`
4. Core service's `_ensureAuthenticated()` method checks:
   - ✅ `this.accessToken` exists (was set from constructor options)
   - ✅ Token not expired (or refreshes if needed)
5. API call succeeds using the authenticated client

### Token Persistence
- Tokens ARE saved to Supabase database correctly (this was already working)
- Services now properly USE those saved tokens when initializing
- No re-authentication required across sessions

## Testing Instructions

1. **Restart the desktop2 app** to load the fixed code
2. **Log in** to your account
3. Go to **Settings** - verify Google and Microsoft show as "Connected & Active"
4. Go to **Mission Control**:
   - Try viewing calendar events (should work without re-auth)
   - Try creating a calendar event (should work without re-auth)
5. **Test Persistence**:
   - Close the app completely
   - Reopen the app and log in
   - Go to Mission Control and try using calendar features
   - Should work WITHOUT needing to re-authenticate

## Expected Behavior

✅ **Settings Page**: Shows integrations as "Connected & Active"
✅ **Mission Control**: Calendar events load successfully
✅ **After Logout/Login**: Integrations remain connected
✅ **After App Restart**: Integrations remain connected
✅ **No Error Messages**: "Not authenticated or token expired" should not appear

## Debugging

If issues persist, check these logs:
- `desktop2/logs/google-gmail.log` - Google authentication and API calls
- `desktop2/logs/microsoft-graph.log` - Microsoft authentication and API calls
- Look for:
  - "initialized with existing tokens" - should see hasAccessToken: true
  - "Not authenticated" errors - should NOT appear
  - EventEmitter errors - should NOT appear

## Technical Summary

The core issue was a **disconnect between token storage and token usage**:
- ✅ Tokens were being saved correctly
- ❌ Services weren't using saved tokens when initializing
- ❌ Mission Control got "initialized" services that actually had no credentials

The fix ensures that when services are initialized from saved tokens, they **immediately configure their API clients** with those tokens, making them ready to use without re-authentication.

---

**Status**: ✅ COMPLETE
**Date**: 2025-10-20
**Files Modified**: 4
**Issue**: Authentication not persisting across sessions
**Resolution**: Services now properly initialize with saved tokens
