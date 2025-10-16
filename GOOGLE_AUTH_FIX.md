# Google OAuth Authentication Fix

## Problem
Google authentication was failing with "Failed to get access token" error, even though the OAuth flow completed successfully.

## Root Cause
Same issue as Microsoft - the IPC handler was expecting `access_token` and `refresh_token` in the OAuth response, but Google's OAuth2Client (like Microsoft's MSAL) manages tokens internally and doesn't expose them directly.

```javascript
// BEFORE - Expected this format:
const authResult = await googleOAuthHandler.startAuthFlow();
if (!authResult || !authResult.access_token) {  // ❌ This fails!
  throw new Error('Failed to get access token');
}

// ACTUAL format returned:
{
  success: true,
  account: {
    email: "user@example.com",
    name: "User Name",
    picture: "https://..."
  },
  expiresOn: Date
}
```

## Solution
Applied the same pattern as Microsoft OAuth fix - store the authenticated service instance instead of trying to manage tokens manually.

### 1. Updated Authentication Handler
**File:** `desktop2/main/ipc/mission-control-handlers.js`

```javascript
ipcMain.handle('google:authenticate', async (event) => {
  const authResult = await googleOAuthHandler.startAuthFlow();

  if (!authResult || !authResult.success) {
    throw new Error('Authentication failed');
  }

  // Save authentication metadata (OAuth2Client handles tokens internally)
  integrationSettings.google = {
    authenticated: true,
    email: authResult.account?.email,
    name: authResult.account?.name,
    connected_at: new Date().toISOString(),
    expires_on: authResult.expiresOn
  };

  // Store the Gmail Service instance with the authenticated session
  googleService.gmailService = googleOAuthHandler.gmailService;
  googleService.isInitialized = true;

  return {
    success: true,
    connected: true,
    email: authResult.account?.email
  };
});
```

### 2. Updated Connection Check
```javascript
ipcMain.handle('google:checkConnection', async (event) => {
  // Check if Gmail Service is initialized
  const connected = googleService.isInitialized && googleService.gmailService;

  return {
    success: true,
    connected: connected || false
  };
});
```

### 3. Direct API Access
All API calls now use the authenticated Gmail Service directly:

```javascript
// Create calendar event
const createdEvent = await googleService.gmailService.createCalendarEvent(eventData);

// Get calendar events
const events = await googleService.gmailService.getUpcomingEvents(
  timeMin,
  timeMax,
  50
);
```

### 4. Added isConnected Helper
**File:** `desktop2/main/services/GoogleService.js`

```javascript
isConnected() {
  return this.isInitialized && this.gmailService !== null;
}
```

## How It Works

### Authentication Flow
1. User clicks "Connect Google" in Mission Control
2. `googleOAuthHandler.startAuthFlow()` is called
3. Browser opens for OAuth consent
4. User authorizes the app
5. OAuth callback receives authorization code
6. `gmailService.authenticateWithCode(code)` exchanges code for tokens
7. OAuth2Client stores tokens internally
8. Returns `{ success, account, expiresOn }`
9. IPC handler stores the authenticated gmailService instance
10. UI can now make API calls

### Token Management
- **Google OAuth2Client** handles all token storage and refresh
- Tokens are stored securely by the OAuth2Client library
- Automatic token refresh when expired
- No manual token management needed

## Files Changed

1. `desktop2/main/ipc/mission-control-handlers.js`
   - Fixed `google:authenticate` to accept OAuth2Client format
   - Updated `google:checkConnection` to check service instance
   - Modified `google:createEvent` to use gmailService directly
   - Modified `google:getUpcomingEvents` to use gmailService directly

2. `desktop2/main/services/GoogleService.js`
   - Added `isConnected()` helper method
   - Added comments about gmailService being set by OAuth handler

## Testing

### Test Google Authentication
1. **Restart desktop2 app**
   ```bash
   cd desktop2
   npm start
   ```

2. **Navigate to Mission Control**
   - Click on "Calendar" tab
   - You should see integration buttons

3. **Connect Google**
   - Click "Connect Google" button
   - Browser should open for OAuth
   - Authorize the app
   - Should return to app with success message

4. **Verify Connection**
   - Status indicator should show green "Connected"
   - Calendar events should load (if you have any)

### Debug if Issues Persist

1. **Check Browser Console**
   ```javascript
   // Check connection status
   const result = await window.electronAPI.google.checkConnection();
   console.log('Google connection:', result);
   ```

2. **Check Main Process Logs**
   ```bash
   tail -f desktop2/logs/google-oauth.log
   tail -f desktop2/logs/google-gmail.log
   ```

3. **Test Event Fetching**
   ```javascript
   const events = await window.electronAPI.google.getUpcomingEvents({
     timeMin: new Date().toISOString(),
     timeMax: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
   });
   console.log('Events:', events);
   ```

## Google vs Microsoft Differences

| Feature | Microsoft | Google |
|---------|-----------|--------|
| **Auth Library** | MSAL | OAuth2Client |
| **Service Class** | MicrosoftGraphService | GoogleGmailService |
| **OAuth Port** | 8889 | 8890 |
| **Meeting Link Field** | `onlineMeeting.joinUrl` | `hangoutLink` or `htmlLink` |
| **Account Info** | `username` | `email` |
| **Calendar API** | Microsoft Graph | Google Calendar API |

## Environment Variables Required

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8890/auth/google/callback

# Scopes (in code)
- https://www.googleapis.com/auth/calendar
- https://www.googleapis.com/auth/gmail.send
- https://www.googleapis.com/auth/userinfo.email
- https://www.googleapis.com/auth/userinfo.profile
```

## Next Steps

1. ✅ Google OAuth working
2. ✅ Microsoft OAuth working  
3. 🔲 Test calendar event creation with both services
4. 🔲 Implement email sending via Gmail
5. 🔲 Add calendar sync between Microsoft and Google
6. 🔲 Implement AI meeting suggestions

---

## Quick Reference

### Auth Status Check
```javascript
// Browser console
const ms = await window.electronAPI.microsoft.checkConnection();
const google = await window.electronAPI.google.checkConnection();
console.log({ microsoft: ms.connected, google: google.connected });
```

### Force Re-authentication
```javascript
// If connection is stuck, restart app and re-authenticate
await window.electronAPI.microsoft.authenticate();
await window.electronAPI.google.authenticate();
```

### Calendar Event Format

**Microsoft:**
```javascript
{
  subject: "Meeting Title",
  startTime: "2025-10-16T09:00:00Z",
  endTime: "2025-10-16T10:00:00Z",
  attendees: ["email@example.com"],
  isOnlineMeeting: true,
  timeZone: "America/Denver"
}
```

**Google:**
```javascript
{
  summary: "Meeting Title",
  start: { dateTime: "2025-10-16T09:00:00-06:00" },
  end: { dateTime: "2025-10-16T10:00:00-06:00" },
  attendees: [{ email: "email@example.com" }],
  conferenceData: { createRequest: { requestId: "uuid" } }
}
```

