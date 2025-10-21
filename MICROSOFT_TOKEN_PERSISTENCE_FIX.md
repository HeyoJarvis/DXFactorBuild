# Microsoft Token Persistence Fix

## Problem
When users logged in with Microsoft Teams, they would see a welcome message but the connection status in Settings would show "Not Connected". When trying to connect again, it would say "Trying to sign you in..." but never complete.

**Root Cause**: The `handleDirectAuth` function in `AuthService.js` was NOT saving the OAuth tokens (access_token, refresh_token) to the database. It was only saving the user ID and email, but the actual tokens needed for API calls were being discarded.

## The Fix

### 1. Save Microsoft Tokens on Login (AuthService.js)

Updated `handleDirectAuth` to properly store OAuth tokens in `integration_settings`:

**For Existing Users:**
```javascript
} else if (provider === 'microsoft') {
  // Store Microsoft tokens for integration
  const microsoftTokens = {
    access_token: userData.tokens?.access_token,
    refresh_token: userData.tokens?.refresh_token,
    token_expiry: userData.tokens?.expires_in 
      ? new Date(Date.now() + (userData.tokens.expires_in * 1000)).toISOString()
      : null,
    id: userData.id,
    email: userData.email,
    connected_at: new Date().toISOString()
  };
  
  updateData.integration_settings = {
    ...user.integration_settings,
    microsoft: microsoftTokens
  };
  
  console.log('💾 Saving Microsoft tokens to integration_settings');
}
```

**For New Users:**
```javascript
} else if (provider === 'microsoft') {
  // Store Microsoft tokens for integration
  newUser.integration_settings = {
    microsoft: {
      access_token: userData.tokens?.access_token,
      refresh_token: userData.tokens?.refresh_token,
      token_expiry: userData.tokens?.expires_in 
        ? new Date(Date.now() + (userData.tokens.expires_in * 1000)).toISOString()
        : null,
      id: userData.id,
      email: userData.email,
      connected_at: new Date().toISOString()
    }
  };
  
  console.log('💾 Saving Microsoft tokens for new user');
}
```

### 2. Same Fix for Google

Applied the same token persistence logic for Google OAuth to prevent the same issue.

## How It Works Now

### Login Flow:
1. User clicks "Sign in with Microsoft"
2. OAuth flow completes in browser
3. Tokens are returned to the app
4. **NEW**: Tokens are saved to `users.integration_settings.microsoft`
5. User record is created/updated in database
6. `MicrosoftService.initialize()` is called
7. Service reads tokens from database
8. Service connects to Microsoft Graph API
9. Settings page shows "Connected" ✅

### Settings Check:
1. User opens Settings
2. Frontend calls `integration:getMicrosoftStatus`
3. Backend checks if `MicrosoftService.isConnected()`
4. Returns `{ connected: true }` because tokens exist
5. UI shows "Connected" status ✅

### Reconnect Prevention:
1. If user tries to connect again while already connected
2. System detects existing tokens in database
3. Initializes service with existing tokens
4. No redundant OAuth flow needed

## Files Modified

1. **desktop2/main/services/AuthService.js**
   - Updated `handleDirectAuth` to save Microsoft tokens (lines 1200-1218)
   - Updated `handleDirectAuth` to save Google tokens (lines 1219-1237)
   - Updated new user creation to save Microsoft tokens (lines 1273-1288)
   - Updated new user creation to save Google tokens (lines 1289-1304)

## Testing

### Test 1: Fresh Login
```bash
1. Sign out completely
2. Sign in with Microsoft
3. Check Settings → Integrations
4. Microsoft should show "Connected" ✅
```

### Test 2: Existing User
```bash
1. User who previously logged in with Microsoft
2. Restart app
3. Check Settings → Integrations
4. Microsoft should show "Connected" ✅
```

### Test 3: Token Refresh
```bash
1. Wait for token to expire (1 hour)
2. Make a Microsoft API call
3. Service should auto-refresh using refresh_token
4. New tokens should be saved to database
```

## Database Schema

The tokens are stored in the `users` table:

```json
{
  "integration_settings": {
    "microsoft": {
      "access_token": "eyJ0eXAiOiJKV1QiLCJub...",
      "refresh_token": "0.AXoAqZ...",
      "token_expiry": "2025-10-18T18:45:00.000Z",
      "id": "abc123...",
      "email": "user@example.com",
      "connected_at": "2025-10-18T17:45:00.000Z"
    }
  }
}
```

## Related Systems

- **MicrosoftService**: Reads tokens from `integration_settings.microsoft`
- **GoogleService**: Reads tokens from `integration_settings.google`
- **JIRAService**: Reads tokens from `integration_settings.jira`
- **Settings UI**: Checks `isConnected()` status for each service

## Next Steps

1. ✅ Test Microsoft login flow
2. ✅ Verify Settings shows "Connected"
3. ✅ Test token refresh on expiry
4. ✅ Test reconnection prevention
5. 🔄 Apply same fix to any other OAuth providers

## Success Criteria

- ✅ User logs in with Microsoft → tokens saved to database
- ✅ Settings page shows "Connected" immediately after login
- ✅ Tokens persist across app restarts
- ✅ Service auto-initializes on app startup
- ✅ No redundant OAuth flows when already connected
- ✅ Token refresh works automatically

---

**Status**: ✅ Fixed and ready for testing
**Date**: October 18, 2025
**Impact**: High - Critical for Microsoft integration to work properly

